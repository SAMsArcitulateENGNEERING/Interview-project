from fastapi import FastAPI, Depends, HTTPException, Form, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
import random
import datetime
from typing import List
import json

import models
import schemas
from database import SessionLocal, engine
from auth import get_password_hash, verify_password, create_access_token, get_current_user, get_current_host, get_current_participant
import os

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Professional Exam System",
    description="A secure, monitored, and professional online examination platform",
    version="1.0.0"
)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse('static/index.html')

@app.get("/exam.html")
async def read_exam():
    return FileResponse('static/exam.html')

@app.get("/results.html")
async def read_results():
    return FileResponse('static/results.html')

@app.get("/sorting.html")
async def read_sorting():
    return FileResponse('static/sorting.html')

@app.get("/host.html")
async def read_host():
    return FileResponse('static/host.html')

@app.get("/login.html")
async def read_login():
    return FileResponse('static/login.html')

# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Temporary questions
def add_initial_questions(db: Session):
    if db.query(models.Question).count() == 0:
        questions = [
            models.Question(
                text="What is the capital of France?",
                options=["Berlin", "Madrid", "Paris", "Lisbon"],
                correct_answer="Paris",
            ),
            models.Question(
                text="What is 2 + 2?",
                options=["3", "4", "5", "6"],
                correct_answer="4",
            ),
            models.Question(
                text="Which planet is known as the Red Planet?",
                options=["Earth", "Mars", "Jupiter", "Saturn"],
                correct_answer="Mars",
            ),
             models.Question(
                text="What is the largest mammal?",
                options=["Elephant", "Blue Whale", "Giraffe", "Great White Shark"],
                correct_answer="Blue Whale",
            ),
            models.Question(
                text="Who wrote 'To Kill a Mockingbird'?",
                options=["Harper Lee", "Mark Twain", "F. Scott Fitzgerald", "Ernest Hemingway"],
                correct_answer="Harper Lee",
            ),
        ]
        db.add_all(questions)
        db.commit()

@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    add_initial_questions(db)
    db.close()

@app.post("/register_user", response_model=schemas.User)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password and create user
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        name=user.name,
        email=user.email,
        password_hash=hashed_password,
        role=user.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/login", response_model=schemas.Token)
def login(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == user_credentials.email).first()
    if not user or not verify_password(user_credentials.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = datetime.timedelta(minutes=30)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.get("/get_random_questions", response_model=List[schemas.Question])
def get_random_questions(count: int = 5, db: Session = Depends(get_db)):
    questions = db.query(models.Question).all()
    return random.sample(questions, count)

@app.post("/start_exam", response_model=schemas.ExamAttempt)
def start_exam(exam: schemas.ExamAttemptCreate, db: Session = Depends(get_db)):
    db_exam = models.ExamAttempt(user_id=exam.user_id, start_time=datetime.datetime.utcnow())
    db.add(db_exam)
    db.commit()
    db.refresh(db_exam)
    return db_exam

@app.post("/submit_answer")
def submit_answer(
    attempt_id: int = Form(),
    question_id: int = Form(),
    user_answer: str = Form(),
    time_taken_seconds: int = Form(),
    db: Session = Depends(get_db),
):
    exam_attempt = db.query(models.ExamAttempt).filter(models.ExamAttempt.id == attempt_id).first()
    if not exam_attempt:
        raise HTTPException(status_code=404, detail="Exam attempt not found")

    question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    is_correct = user_answer == question.correct_answer
    
    answered_question = {
        "question_id": question_id,
        "user_answer": user_answer,
        "is_correct": is_correct,
        "time_taken_seconds": time_taken_seconds,
    }

    # Use a mutable list to ensure changes are tracked
    current_answers = list(exam_attempt.answered_questions)
    current_answers.append(answered_question)
    exam_attempt.answered_questions = current_answers
    
    db.add(exam_attempt)
    db.commit()
    db.refresh(exam_attempt)
    return {"message": "Answer submitted successfully"}

@app.post("/increment_alt_tab", response_model=dict)
def increment_alt_tab(attempt_id: int = Form(), db: Session = Depends(get_db)):
    exam_attempt = db.query(models.ExamAttempt).filter(models.ExamAttempt.id == attempt_id).first()
    if not exam_attempt:
        raise HTTPException(status_code=404, detail="Exam attempt not found")
    
    exam_attempt.alt_tab_count += 1
    db.commit()
    db.refresh(exam_attempt)
    
    exam_ended = False
    # If alt_tab_count reaches 3, end the exam
    if exam_attempt.alt_tab_count >= 3 and not exam_attempt.end_time:
        import datetime
        exam_attempt.end_time = datetime.datetime.utcnow()
        exam_attempt.duration_seconds = int((exam_attempt.end_time - exam_attempt.start_time).total_seconds())
        score = 0
        total_time = 0
        for answer in exam_attempt.answered_questions:
            if answer["is_correct"]:
                score += 1
            total_time += answer["time_taken_seconds"]
        exam_attempt.score = score
        if len(exam_attempt.answered_questions) > 0:
            exam_attempt.average_time_per_question_seconds = total_time / len(exam_attempt.answered_questions)
        else:
            exam_attempt.average_time_per_question_seconds = 0
        db.commit()
        db.refresh(exam_attempt)
        exam_ended = True
    
    return {
        "alt_tab_count": exam_attempt.alt_tab_count,
        "exam_ended": exam_ended
    }

@app.post("/end_exam", response_model=schemas.ExamAttempt)
def end_exam(attempt_id: int, db: Session = Depends(get_db)):
    exam_attempt = db.query(models.ExamAttempt).filter(models.ExamAttempt.id == attempt_id).first()
    if not exam_attempt:
        raise HTTPException(status_code=404, detail="Exam attempt not found")

    exam_attempt.end_time = datetime.datetime.utcnow()
    exam_attempt.duration_seconds = int((exam_attempt.end_time - exam_attempt.start_time).total_seconds())
    
    score = 0
    total_time = 0
    for answer in exam_attempt.answered_questions:
        if answer["is_correct"]:
            score += 1
        total_time += answer["time_taken_seconds"]
    
    exam_attempt.score = score
    if len(exam_attempt.answered_questions) > 0:
        exam_attempt.average_time_per_question_seconds = total_time / len(exam_attempt.answered_questions)
    else:
        exam_attempt.average_time_per_question_seconds = 0

    db.commit()
    db.refresh(exam_attempt)
    return exam_attempt

@app.get("/get_exam_result/{attempt_id}", response_model=schemas.ExamAttempt)
def get_exam_result(attempt_id: int, db: Session = Depends(get_db)):
    exam_attempt = db.query(models.ExamAttempt).filter(models.ExamAttempt.id == attempt_id).first()
    if not exam_attempt:
        raise HTTPException(status_code=404, detail="Exam attempt not found")
    return exam_attempt

@app.get("/get_user_results/{user_id}", response_model=List[schemas.ExamAttempt])
def get_user_results(user_id: int, db: Session = Depends(get_db)):
    exam_attempts = db.query(models.ExamAttempt).filter(models.ExamAttempt.user_id == user_id).all()
    if not exam_attempts:
        raise HTTPException(status_code=404, detail="No exam attempts found for this user")
    return exam_attempts

@app.get("/get_all_exam_attempts", response_model=List[schemas.ExamAttempt])
def get_all_exam_attempts(db: Session = Depends(get_db)):
    return db.query(models.ExamAttempt).all()

@app.get("/get_user/{user_id}", response_model=schemas.User)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/get_question/{question_id}", response_model=schemas.Question)
def get_question(question_id: int, db: Session = Depends(get_db)):
    question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question

# ==================== HOST DASHBOARD APIs ====================

@app.post("/api/create_exam")
async def create_exam(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        
        # Create a new exam session
        exam_session = models.ExamSession(
            title=data.get("title", "Untitled Exam"),
            description=data.get("description", ""),
            duration_minutes=data.get("duration", 60),
            question_count=data.get("questionCount", 10),
            start_date=datetime.datetime.strptime(data.get("startDate"), "%Y-%m-%d").date(),
            start_time=datetime.datetime.strptime(data.get("startTime"), "%H:%M").time(),
            password=data.get("password", ""),
            enable_monitoring=data.get("enableMonitoring", True),
            status="scheduled"
        )
        
        db.add(exam_session)
        db.commit()
        db.refresh(exam_session)
        
        return {"success": True, "exam_id": exam_session.id}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/active_exams")
def get_active_exams(db: Session = Depends(get_db)):
    try:
        # Get all exam sessions
        exams = db.query(models.ExamSession).all()
        return [
            {
                "id": exam.id,
                "title": exam.title,
                "description": exam.description,
                "duration": exam.duration_minutes,
                "question_count": exam.question_count,
                "start_date": exam.start_date.isoformat(),
                "start_time": exam.start_time.isoformat(),
                "status": exam.status,
                "participant_count": db.query(models.ExamAttempt).filter(
                    models.ExamAttempt.exam_session_id == exam.id
                ).count()
            }
            for exam in exams
        ]
    except Exception as e:
        return []

@app.get("/api/exam/{exam_id}")
def get_exam_details(exam_id: int, db: Session = Depends(get_db)):
    try:
        exam = db.query(models.ExamSession).filter(models.ExamSession.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        
        # Get statistics
        attempts = db.query(models.ExamAttempt).filter(
            models.ExamAttempt.exam_session_id == exam_id
        ).all()
        
        participant_count = len(attempts)
        violation_count = sum(attempt.alt_tab_count for attempt in attempts)
        completion_rate = 0
        if participant_count > 0:
            completed = sum(1 for attempt in attempts if attempt.end_time)
            completion_rate = int((completed / participant_count) * 100)
        
        return {
            "id": exam.id,
            "title": exam.title,
            "description": exam.description,
            "duration": exam.duration_minutes,
            "question_count": exam.question_count,
            "start_date": exam.start_date.isoformat(),
            "start_time": exam.start_time.isoformat(),
            "status": exam.status,
            "participant_count": participant_count,
            "violation_count": violation_count,
            "completion_rate": completion_rate
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/exam/{exam_id}/start")
def start_exam_session(exam_id: int, db: Session = Depends(get_db)):
    try:
        exam = db.query(models.ExamSession).filter(models.ExamSession.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        
        exam.status = "active"
        db.commit()
        
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    try:
        total_participants = db.query(models.ExamAttempt).count()
        active_participants = db.query(models.ExamAttempt).filter(
            models.ExamAttempt.end_time.is_(None)
        ).count()
        total_violations = db.query(models.ExamAttempt).with_entities(
            func.sum(models.ExamAttempt.alt_tab_count)
        ).scalar() or 0
        
        return {
            "totalParticipants": total_participants,
            "activeParticipants": active_participants,
            "totalViolations": total_violations
        }
    except Exception as e:
        return {
            "totalParticipants": 0,
            "activeParticipants": 0,
            "totalViolations": 0
        }

@app.get("/api/participants")
def get_active_participants(db: Session = Depends(get_db)):
    try:
        active_attempts = db.query(models.ExamAttempt).filter(
            models.ExamAttempt.end_time.is_(None)
        ).all()
        
        participants = []
        for attempt in active_attempts:
            user = db.query(models.User).filter(models.User.id == attempt.user_id).first()
            progress = int((len(attempt.answered_questions) / 5) * 100)  # Assuming 5 questions
            
            participants.append({
                "name": user.name if user else "Unknown",
                "status": "online",
                "exam_title": "Current Exam",  # You can enhance this
                "progress": progress
            })
        
        return participants
    except Exception as e:
        return []

@app.get("/api/recent_violations")
def get_recent_violations(db: Session = Depends(get_db)):
    try:
        # Get recent attempts with violations
        recent_attempts = db.query(models.ExamAttempt).filter(
            models.ExamAttempt.alt_tab_count > 0
        ).order_by(models.ExamAttempt.start_time.desc()).limit(10).all()
        
        violations = []
        for attempt in recent_attempts:
            user = db.query(models.User).filter(models.User.id == attempt.user_id).first()
            violations.append({
                "participant_name": user.name if user else "Unknown",
                "reason": f"Alt-Tab violation (Count: {attempt.alt_tab_count})",
                "timestamp": attempt.start_time.isoformat()
            })
        
        return violations
    except Exception as e:
        return [] 