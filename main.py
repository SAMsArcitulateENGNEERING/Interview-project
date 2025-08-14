from fastapi import FastAPI, Depends, HTTPException, Form, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy import text
import random
import datetime
import json
from typing import List

import models
import schemas
from database import SessionLocal, engine
from auth import get_password_hash, verify_password, create_access_token, get_current_user, get_current_host, get_current_participant
import os
from pynput import keyboard
import threading
import time
import requests
import re

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Professional Exam System",
    description="A secure, monitored, and professional online examination platform",
    version="1.0.0"
)

app.mount("/static", StaticFiles(directory="static"), name="static")

# Global variables for native monitoring
native_monitor_active = False
native_monitor_listener = None
native_monitor_thread = None
current_exam_attempt_id = None
native_violations = []

# --- Lightweight SQLite migrations ---
def run_sqlite_migrations():
    try:
        with engine.begin() as connection:
            def table_has_column(table_name: str, column_name: str) -> bool:
                rows = connection.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
                for row in rows:
                    try:
                        # SQLite returns: cid, name, type, notnull, dflt_value, pk
                        if row[1] == column_name or getattr(row, "name", None) == column_name:
                            return True
                    except Exception:
                        pass
                return False

            # exam_sessions: add start_date, end_date
            if not table_has_column("exam_sessions", "start_date"):
                connection.execute(text("ALTER TABLE exam_sessions ADD COLUMN start_date DATETIME"))
            if not table_has_column("exam_sessions", "end_date"):
                connection.execute(text("ALTER TABLE exam_sessions ADD COLUMN end_date DATETIME"))

            # exam_attempts: add alt_tab_count, answered_questions, duration_seconds, average_time_per_question_seconds
            if not table_has_column("exam_attempts", "alt_tab_count"):
                connection.execute(text("ALTER TABLE exam_attempts ADD COLUMN alt_tab_count INTEGER DEFAULT 0"))
                connection.execute(text("UPDATE exam_attempts SET alt_tab_count = 0 WHERE alt_tab_count IS NULL"))
            if not table_has_column("exam_attempts", "answered_questions"):
                connection.execute(text("ALTER TABLE exam_attempts ADD COLUMN answered_questions TEXT"))
                connection.execute(text("UPDATE exam_attempts SET answered_questions = '[]' WHERE answered_questions IS NULL"))
            if not table_has_column("exam_attempts", "duration_seconds"):
                connection.execute(text("ALTER TABLE exam_attempts ADD COLUMN duration_seconds INTEGER"))
            if not table_has_column("exam_attempts", "average_time_per_question_seconds"):
                connection.execute(text("ALTER TABLE exam_attempts ADD COLUMN average_time_per_question_seconds FLOAT"))
            # questions: add order_index
            try:
                rows = connection.execute(text("PRAGMA table_info(questions)")).fetchall()
                has_order = any((row[1] if len(row) > 1 else getattr(row, "name", None)) == "order_index" for row in rows)
                if not has_order:
                    connection.execute(text("ALTER TABLE questions ADD COLUMN order_index INTEGER"))
            except Exception:
                pass
    except Exception as e:
        print(f"⚠️ Migration warning: {e}")

# Native monitoring class
class NativeExamMonitor:
    def __init__(self):
        self.violations = []
        self.is_active = False
        self.listener = None
        self.exam_attempt_id = None
        
    def on_press(self, key):
        if not self.is_active:
            return
            
        try:
            # Detect Alt+Tab
            if key == keyboard.Key.tab and hasattr(key, '_modifiers') and keyboard.Key.alt in key._modifiers:
                self.record_violation("Alt+Tab detected", "System window switching")
                return
                
            # Detect Windows key
            if key == keyboard.Key.cmd or key == keyboard.Key.cmd_r:
                self.record_violation("Windows key pressed", "System menu access")
                return
                
            # Detect Ctrl+Alt+Delete
            if (key == keyboard.Key.delete and 
                hasattr(key, '_modifiers') and 
                keyboard.Key.ctrl in key._modifiers and 
                keyboard.Key.alt in key._modifiers):
                self.record_violation("Ctrl+Alt+Delete detected", "Task manager access")
                return
                
            # Detect function keys
            if hasattr(key, 'char') and key.char is None:
                if hasattr(key, 'name') and key.name and key.name.startswith('f'):
                    self.record_violation(f"Function key {key.name} pressed", "System shortcut")
                    return
                    
        except AttributeError:
            pass
            
    def record_violation(self, violation_type, description):
        violation = {
            "timestamp": datetime.datetime.now().isoformat(),
            "type": violation_type,
            "description": description,
            "exam_attempt_id": self.exam_attempt_id
        }
        self.violations.append(violation)
        print(f"🚨 NATIVE VIOLATION: {violation_type} - {description}")
        
    def start_monitoring(self, exam_attempt_id):
        if self.is_active:
            return
            
        self.exam_attempt_id = exam_attempt_id
        self.is_active = True
        self.violations = []
        
        # Start keyboard listener
        self.listener = keyboard.Listener(on_press=self.on_press)
        self.listener.start()
        
        print(f"🔍 Native monitoring started for exam attempt {exam_attempt_id}")
        
    def stop_monitoring(self):
        if not self.is_active:
            return
            
        self.is_active = False
        if self.listener:
            self.listener.stop()
            self.listener = None
            
        print(f"🛑 Native monitoring stopped. Total violations: {len(self.violations)}")
        return self.violations

# Create global monitor instance
native_monitor = NativeExamMonitor()

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

@app.get("/start.html")
async def read_start():
    return FileResponse('static/start.html')

@app.get("/index.html")
async def read_index():
    return FileResponse('static/index.html')

@app.get("/test_exam.html")
async def read_test_exam():
    return FileResponse('static/test_exam.html')

@app.get("/debug_exam.html")
async def read_debug_exam():
    return FileResponse('static/debug_exam.html')

@app.get("/select_exam.html")
async def read_select_exam():
    return FileResponse('static/select_exam.html')

@app.get("/exam_analysis.html")
async def read_exam_analysis():
    return FileResponse('static/exam_analysis.html')

# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Remove add_initial_questions and its call in on_startup
# (No code here, just delete the function and the call)

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

@app.get("/get_random_questions")
def get_random_questions(count: int = 5, db: Session = Depends(get_db)):
    try:
        print(f"Fetching {count} random questions...")
        
        questions = db.query(models.Question).all()
        print(f"Found {len(questions)} questions in database")
        
        if not questions:
            print("No questions found in database")
            raise HTTPException(status_code=404, detail="No questions available in the database")
        
        # If we have fewer questions than requested, return all available questions
        if len(questions) < count:
            selected = questions
        else:
            selected = random.sample(questions, count)
        
        # Serialize with options as an array
        serialized = []
        for q in selected:
            opts = q.options
            try:
                opts = json.loads(opts) if isinstance(opts, str) else opts
            except Exception:
                pass
            serialized.append({
                "id": q.id,
                "text": q.text,
                "options": opts,
                "correct_answer": q.correct_answer,
                "points": q.points,
                "question_type": q.question_type,
                "created_at": q.created_at.isoformat() if q.created_at else None
            })
        print(f"Returning {len(serialized)} random questions")
        return serialized
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_random_questions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch questions: {str(e)}")

@app.post("/start_exam", response_model=schemas.ExamAttempt)
def start_exam(exam: schemas.ExamAttemptCreate, db: Session = Depends(get_db)):
    # For now, we'll use the user_id from the request
    # In a production system, you'd get this from the JWT token
    db_exam = models.ExamAttempt(
        user_id=exam.user_id, 
        start_time=datetime.datetime.utcnow()
    )
    db.add(db_exam)
    db.commit()
    db.refresh(db_exam)
    return db_exam

@app.post("/start_exam_simple")
def start_exam_simple(
    name: str = Form(),
    email: str = Form(),
    phone: str = Form(default=""),
    exam_id: int = Form(...),
    db: Session = Depends(get_db)
):
    """Simplified exam start that creates user and exam attempt in one go, for a selected exam."""
    try:
        print(f"Starting exam for: {name} ({email}), exam_id={exam_id}")
        
        # Validate inputs
        if not name or not email or not exam_id:
            raise HTTPException(status_code=400, detail="Name, email, and exam_id are required")
        
        # Validate email format
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Validate exam exists
        exam = db.query(models.ExamSession).filter(models.ExamSession.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Selected exam not found")
        
        # Check exam status - allow both draft and active exams
        if exam.status not in ["active", "draft"]:
            raise HTTPException(status_code=400, detail="This exam is not available for taking")
        
        # Check exam timing if start_date and end_date are set
        now = datetime.datetime.utcnow()
        if exam.start_date and now < exam.start_date:
            time_diff = exam.start_date - now
            hours = int(time_diff.total_seconds() // 3600)
            minutes = int((time_diff.total_seconds() % 3600) // 60)
            raise HTTPException(
                status_code=400, 
                detail=f"Exam has not started yet. Please wait {hours}h {minutes}m until {exam.start_date.strftime('%Y-%m-%d %H:%M UTC')}"
            )
        
        if exam.end_date and now > exam.end_date:
            raise HTTPException(
                status_code=400, 
                detail=f"Exam has ended on {exam.end_date.strftime('%Y-%m-%d %H:%M UTC')}"
            )
        
        # Create or get user (check for existing email)
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            print(f"Creating new user: {name}")
            user = models.User(
                name=name,
                email=email,
                password_hash="temporary",
                role="participant"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"User created with ID: {user.id}")
        else:
            print(f"Using existing user: {user.id}")
            # Update user name if it changed
            if user.name != name:
                user.name = name
                db.commit()
        
        # Check if user already has an active attempt for this exam
        existing_attempt = db.query(models.ExamAttempt).filter(
            models.ExamAttempt.user_id == user.id,
            models.ExamAttempt.exam_session_id == exam_id,
            models.ExamAttempt.end_time.is_(None)
        ).first()
        
        if existing_attempt:
            # Return existing attempt if it's still active
            return {
                "success": True,
                "exam_attempt_id": existing_attempt.id,
                "user_id": user.id,
                "user_name": user.name,
                "message": "Resuming existing exam attempt"
            }
        
        # Create exam attempt, associate with exam
        exam_attempt = models.ExamAttempt(
            user_id=user.id,
            exam_session_id=exam_id,
            start_time=datetime.datetime.utcnow()
        )
        db.add(exam_attempt)
        db.commit()
        db.refresh(exam_attempt)
        
        print(f"Exam attempt created with ID: {exam_attempt.id}")
        
        # 🔍 AUTOMATICALLY START NATIVE MONITORING
        try:
            native_monitor.start_monitoring(exam_attempt.id)
            print(f"✅ Native monitoring automatically started for exam {exam_attempt.id}")
        except Exception as monitor_error:
            print(f"⚠️ Warning: Could not start native monitoring: {monitor_error}")
        
        return {
            "success": True,
            "exam_attempt_id": exam_attempt.id,
            "user_id": user.id,
            "user_name": user.name
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in start_exam_simple: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to start exam: {str(e)}")

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
        "correct_answer": question.correct_answer,
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
    
    # 🛑 AUTOMATICALLY STOP NATIVE MONITORING
    try:
        violations = native_monitor.stop_monitoring()
        if violations:
            print(f"📊 Native monitoring stopped. Found {len(violations)} violations during exam {attempt_id}")
            # You could save these violations to the database here if needed
        else:
            print(f"✅ Native monitoring stopped. No violations detected during exam {attempt_id}")
    except Exception as monitor_error:
        print(f"⚠️ Warning: Could not stop native monitoring: {monitor_error}")
    
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

@app.get("/api/check_email/{email}")
def check_email_exists(email: str, db: Session = Depends(get_db)):
    """Check if an email already exists in the system"""
    user = db.query(models.User).filter(models.User.email == email).first()
    return {
        "exists": user is not None,
        "user_id": user.id if user else None,
        "user_name": user.name if user else None
    }

@app.get("/get_question/{question_id}", response_model=schemas.Question)
def get_question(question_id: int, db: Session = Depends(get_db)):
    question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question

@app.post("/api/create_question", response_model=schemas.Question)
def create_question(
    text: str = Form(),
    options: str = Form(),  # JSON string of options array
    correct_answer: str = Form(),
    points: int = Form(default=1),
    exam_id: int = Form(default=None),
    db: Session = Depends(get_db)
):
    """Create a new question"""
    try:
        options_list = json.loads(options)
        if correct_answer not in options_list:
            raise HTTPException(status_code=400, detail="Correct answer must be one of the options")
        # Determine order_index within exam if provided
        order_index = None
        if exam_id:
            max_order = db.query(models.Question).filter(models.Question.exam_session_id == exam_id).with_entities(func.max(models.Question.order_index)).scalar()
            order_index = (max_order or 0) + 1
        question = models.Question(
            text=text,
            options=json.dumps(options_list),
            correct_answer=correct_answer,
            points=points,
            exam_session_id=exam_id,
            order_index=order_index,
        )
        db.add(question)
        db.commit()
        db.refresh(question)
        return question
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid options format")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/question/{question_id}")
async def update_question(question_id: int, request: Request, db: Session = Depends(get_db)):
    """Update question text/options/correct_answer/points"""
    try:
        body = await request.json()
        q = db.query(models.Question).filter(models.Question.id == question_id).first()
        if not q:
            raise HTTPException(status_code=404, detail="Question not found")
        if "text" in body:
            q.text = body["text"]
        if "options" in body:
            if not isinstance(body["options"], list) or len(body["options"]) < 2:
                raise HTTPException(status_code=400, detail="Options must be an array with at least 2 items")
            q.options = json.dumps(body["options"])
        if "correct_answer" in body:
            opts = json.loads(q.options) if isinstance(q.options, str) else q.options
            if body["correct_answer"] not in opts:
                raise HTTPException(status_code=400, detail="Correct answer must be one of the options")
            q.correct_answer = body["correct_answer"]
        if "points" in body:
            q.points = int(body["points"])
        db.commit()
        db.refresh(q)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/exam/{exam_id}/reorder")
async def reorder_questions(exam_id: int, request: Request, db: Session = Depends(get_db)):
    """Reorder questions by array of question IDs in desired order"""
    data = await request.json()
    order = data.get("order", [])
    if not isinstance(order, list) or not order:
        raise HTTPException(status_code=400, detail="Order must be a non-empty array of question IDs")
    # Validate all IDs belong to this exam
    questions = db.query(models.Question).filter(models.Question.exam_session_id == exam_id).all()
    qids = {q.id for q in questions}
    if not set(order).issubset(qids):
        raise HTTPException(status_code=400, detail="Order contains invalid question IDs for this exam")
    try:
        for idx, qid in enumerate(order, start=1):
            db.query(models.Question).filter(models.Question.id == qid).update({models.Question.order_index: idx})
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Improve /api/exam/{exam_id}/questions to return ordered list with index
@app.get("/api/exam/{exam_id}/questions")
def get_exam_questions(exam_id: int, db: Session = Depends(get_db)):
    try:
        exam = db.query(models.ExamSession).filter(models.ExamSession.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        questions = db.query(models.Question).filter(models.Question.exam_session_id == exam_id).order_by(models.Question.order_index.asc().nulls_last(), models.Question.created_at.asc()).all()
        result = []
        for idx, q in enumerate(questions, start=1):
            try:
                options_list = json.loads(q.options) if isinstance(q.options, str) else q.options
            except Exception:
                options_list = q.options
            result.append({
                "id": q.id,
                "text": q.text,
                "options": options_list,
                "correct_answer": q.correct_answer,
                "points": q.points,
                "question_type": q.question_type,
                "created_at": q.created_at.isoformat() if q.created_at else None,
                "order_index": q.order_index or idx
            })
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get exam questions: {str(e)}")

@app.delete("/api/question/{question_id}")
def delete_question(question_id: int, db: Session = Depends(get_db)):
    """Delete a question"""
    question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    db.delete(question)
    db.commit()
    return {"message": "Question deleted successfully"}

# ==================== HOST DASHBOARD APIs ====================

@app.post("/api/create_exam")
async def create_exam(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        
        # Parse dates if provided
        start_date = None
        end_date = None
        
        if data.get("start_date"):
            start_date = datetime.datetime.fromisoformat(data["start_date"].replace('Z', '+00:00'))
        
        if data.get("end_date"):
            end_date = datetime.datetime.fromisoformat(data["end_date"].replace('Z', '+00:00'))
        
        # Create a new exam session with date fields
        exam_session = models.ExamSession(
            title=data.get("title", "Untitled Exam"),
            description=data.get("description", ""),
            duration_minutes=data.get("duration", 60),
            status="draft",  # Start as draft, can be activated later
            start_date=start_date,
            end_date=end_date
        )
        
        db.add(exam_session)
        db.commit()
        db.refresh(exam_session)
        
        return {"success": True, "exam_id": exam_session.id}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/cleanup_exams")
def cleanup_exams_manual(db: Session = Depends(get_db)):
    """Manually trigger exam cleanup"""
    try:
        cleanup_invalid_exams(db)
        return {"success": True, "message": "Exam cleanup completed"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/active_exams")
def get_active_exams(db: Session = Depends(get_db)):
    try:
        current_time = datetime.datetime.utcnow()
        
        # Get all exam sessions that are not expired
        exams = db.query(models.ExamSession).filter(
            (models.ExamSession.end_date.is_(None)) |  # No end date (always valid)
            (models.ExamSession.end_date > current_time)  # End date in the future
        ).all()
        
        return [
            {
                "id": exam.id,
                "title": exam.title,
                "description": exam.description,
                "duration": exam.duration_minutes,
                "question_count": db.query(models.Question).filter(
                    models.Question.exam_session_id == exam.id
                ).count(),  # Calculate from actual questions
                "start_date": exam.start_date.date().isoformat() if exam.start_date else None,
                "end_date": exam.end_date.date().isoformat() if exam.end_date else None,
                "start_time": exam.start_date.time().isoformat() if exam.start_date else None,
                "end_time": exam.end_date.time().isoformat() if exam.end_date else None,
                "status": exam.status,
                "participant_count": db.query(models.ExamAttempt).filter(
                    models.ExamAttempt.exam_session_id == exam.id
                ).count(),
                "is_valid": True,  # All exams in this list are valid
                "days_until_expiry": (exam.end_date - current_time).days if exam.end_date else None
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
            "question_count": db.query(models.Question).filter(
                models.Question.exam_session_id == exam.id
            ).count(),
            "start_date": exam.start_date.isoformat() if exam.start_date else None,
            "end_date": exam.end_date.isoformat() if exam.end_date else None,
            "created_at": exam.created_at.isoformat() if exam.created_at else None,
            "status": exam.status,
            "participant_count": participant_count,
            "violation_count": violation_count,
            "completion_rate": completion_rate,
            "is_expired": exam.end_date < datetime.datetime.utcnow() if exam.end_date else False
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/exam/{exam_id}")
async def update_exam(exam_id: int, request: Request, db: Session = Depends(get_db)):
    """Update exam details"""
    try:
        exam = db.query(models.ExamSession).filter(models.ExamSession.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        
        data = await request.json()
        
        # Update allowed fields
        if "title" in data:
            exam.title = data["title"]
        if "description" in data:
            exam.description = data["description"]
        if "duration_minutes" in data:
            exam.duration_minutes = data["duration_minutes"]
        if "status" in data:
            exam.status = data["status"]
        if "start_date" in data and data["start_date"]:
            exam.start_date = datetime.datetime.fromisoformat(data["start_date"].replace('Z', '+00:00'))
        if "end_date" in data and data["end_date"]:
            exam.end_date = datetime.datetime.fromisoformat(data["end_date"].replace('Z', '+00:00'))
        
        db.commit()
        db.refresh(exam)
        
        return {"success": True, "message": "Exam updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating exam: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update exam")

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

@app.delete("/api/exam/{exam_id}")
def delete_exam(exam_id: int, db: Session = Depends(get_db)):
    """Delete an exam session and its associated questions"""
    try:
        # Find the exam
        exam = db.query(models.ExamSession).filter(models.ExamSession.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        
        # Check if exam is currently active
        if exam.status == "active":
            raise HTTPException(status_code=400, detail="Cannot delete an active exam")
        
        # Delete all questions associated with this exam
        questions = db.query(models.Question).filter(models.Question.exam_session_id == exam_id).all()
        for question in questions:
            db.delete(question)
        
        # Delete the exam session
        db.delete(exam)
        db.commit()
        
        return {"success": True, "message": "Exam deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete exam: {str(e)}")

@app.get("/api/exam/{exam_id}/participants")
def get_exam_participants(exam_id: int, db: Session = Depends(get_db)):
    """Get all participants for a specific exam"""
    try:
        attempts = db.query(models.ExamAttempt).filter(
            models.ExamAttempt.exam_session_id == exam_id
        ).all()
        
        participants = []
        for attempt in attempts:
            user = db.query(models.User).filter(models.User.id == attempt.user_id).first()
            if user:
                status = "completed" if attempt.end_time else "active"
                participants.append({
                    "id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "status": status,
                    "start_time": attempt.start_time.isoformat() if attempt.start_time else None,
                    "end_time": attempt.end_time.isoformat() if attempt.end_time else None,
                    "score": attempt.score,
                    "alt_tab_count": attempt.alt_tab_count
                })
        
        return participants
    except Exception as e:
        return []

@app.get("/api/exam/{exam_id}/violations")
def get_exam_violations(exam_id: int, db: Session = Depends(get_db)):
    """Get all violations for a specific exam"""
    try:
        attempts = db.query(models.ExamAttempt).filter(
            models.ExamAttempt.exam_session_id == exam_id,
            models.ExamAttempt.alt_tab_count > 0
        ).all()
        
        violations = []
        for attempt in attempts:
            user = db.query(models.User).filter(models.User.id == attempt.user_id).first()
            if user and attempt.alt_tab_count > 0:
                violations.append({
                    "participant_name": user.name,
                    "participant_email": user.email,
                    "count": attempt.alt_tab_count,
                    "timestamp": attempt.start_time.isoformat() if attempt.start_time else None,
                    "attempt_id": attempt.id
                })
        
        return violations
    except Exception as e:
        return []

@app.get("/api/exam/{exam_id}/activity")
def get_exam_activity(exam_id: int, db: Session = Depends(get_db)):
    """Get recent activity for a specific exam"""
    try:
        attempts = db.query(models.ExamAttempt).filter(
            models.ExamAttempt.exam_session_id == exam_id
        ).order_by(models.ExamAttempt.start_time.desc()).limit(20).all()
        
        activities = []
        for attempt in attempts:
            user = db.query(models.User).filter(models.User.id == attempt.user_id).first()
            if user:
                # Start activity
                activities.append({
                    "type": "start",
                    "description": f"{user.name} started the exam",
                    "timestamp": attempt.start_time.isoformat() if attempt.start_time else None
                })
                
                # Violation activity
                if attempt.alt_tab_count > 0:
                    activities.append({
                        "type": "violation",
                        "description": f"{user.name} had {attempt.alt_tab_count} Alt+Tab violations",
                        "timestamp": attempt.start_time.isoformat() if attempt.start_time else None
                    })
                
                # Completion activity
                if attempt.end_time:
                    activities.append({
                        "type": "complete",
                        "description": f"{user.name} completed the exam with score {attempt.score}",
                        "timestamp": attempt.end_time.isoformat() if attempt.end_time else None
                    })
        
        # Sort by timestamp (newest first)
        activities.sort(key=lambda x: x["timestamp"] or "", reverse=True)
        return activities[:20]  # Return last 20 activities
    except Exception as e:
        return []

@app.get("/api/exam/{exam_id}/stats")
def get_exam_stats(exam_id: int, db: Session = Depends(get_db)):
    """Get real-time statistics for a specific exam"""
    try:
        attempts = db.query(models.ExamAttempt).filter(
            models.ExamAttempt.exam_session_id == exam_id
        ).all()
        
        total_participants = len(attempts)
        active_participants = sum(1 for attempt in attempts if not attempt.end_time)
        total_violations = sum(attempt.alt_tab_count for attempt in attempts)
        completed_attempts = sum(1 for attempt in attempts if attempt.end_time)
        
        completion_rate = 0
        if total_participants > 0:
            completion_rate = int((completed_attempts / total_participants) * 100)
        
        return {
            "total_participants": total_participants,
            "active_participants": active_participants,
            "total_violations": total_violations,
            "completion_rate": completion_rate,
            "completed_attempts": completed_attempts
        }
    except Exception as e:
        return {
            "total_participants": 0,
            "active_participants": 0,
            "total_violations": 0,
            "completion_rate": 0,
            "completed_attempts": 0
        }

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
        
        # Add native monitoring violations
        if native_monitor.violations:
            for violation in native_monitor.violations[-5:]:  # Last 5 violations
                violations.append({
                    "participant_name": "System Monitor",
                    "reason": f"{violation.get('type', 'Native')} - {violation.get('description', '')}",
                    "timestamp": violation.get("timestamp", "Unknown"),
                    "exam_id": violation.get("exam_attempt_id", "Unknown")
                })
        
        return violations
    except Exception as e:
        return []

@app.get("/api/native_violations")
def get_native_violations():
    """Get current native monitoring violations"""
    return {
        "is_active": native_monitor.is_active,
        "current_exam_id": native_monitor.exam_attempt_id,
        "violations": native_monitor.violations,
        "total_violations": len(native_monitor.violations)
    } 

@app.get("/get_exam_analysis/{attempt_id}")
def get_exam_analysis(attempt_id: int, db: Session = Depends(get_db)):
    """Get detailed analysis of an exam attempt including question-by-question breakdown"""
    exam_attempt = db.query(models.ExamAttempt).filter(models.ExamAttempt.id == attempt_id).first()
    if not exam_attempt:
        raise HTTPException(status_code=404, detail="Exam attempt not found")
    
    user = db.query(models.User).filter(models.User.id == exam_attempt.user_id).first()
    
    # Get detailed question information
    detailed_questions = []
    for answer in exam_attempt.answered_questions:
        question = db.query(models.Question).filter(models.Question.id == answer["question_id"]).first()
        if question:
            detailed_questions.append({
                "question_id": answer["question_id"],
                "question_text": question.text,
                "options": question.options,
                "user_answer": answer["user_answer"],
                "correct_answer": answer.get("correct_answer", question.correct_answer),
                "is_correct": answer["is_correct"],
                "time_taken_seconds": answer["time_taken_seconds"],
                "time_taken_formatted": f"{answer['time_taken_seconds'] // 60}m {answer['time_taken_seconds'] % 60}s"
            })
    
    analysis = {
        "attempt_id": exam_attempt.id,
        "user_name": user.name if user else "Unknown",
        "user_email": user.email if user else "Unknown",
        "start_time": exam_attempt.start_time.isoformat(),
        "end_time": exam_attempt.end_time.isoformat() if exam_attempt.end_time else None,
        "duration_seconds": exam_attempt.duration_seconds,
        "duration_formatted": f"{exam_attempt.duration_seconds // 60}m {exam_attempt.duration_seconds % 60}s" if exam_attempt.duration_seconds else "N/A",
        "score": exam_attempt.score,
        "total_questions": len(exam_attempt.answered_questions),
        "average_time_per_question_seconds": exam_attempt.average_time_per_question_seconds,
        "average_time_formatted": f"{int(exam_attempt.average_time_per_question_seconds // 60)}m {int(exam_attempt.average_time_per_question_seconds % 60)}s" if exam_attempt.average_time_per_question_seconds else "N/A",
        "alt_tab_count": exam_attempt.alt_tab_count,
        "detailed_questions": detailed_questions
    }
    
    return analysis 

@app.post("/api/ai_generate_questions")
async def ai_generate_questions(request: Request):
    """Generate questions using AI via local Ollama when available, with fallback to smart generation."""
    data = await request.json()
    prompt = data.get("prompt", "").strip()
    num_questions = int(data.get("num_questions", 5))

    if not prompt:
        return {"error": "Prompt is required."}

    # Prefer local Ollama (open-source) if running
    try:
        base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
        model = os.getenv("OLLAMA_MODEL", "llama3")
        ai_prompt = build_ai_prompt(prompt, num_questions)
        response = requests.post(
            f"{base_url}/api/generate",
            json={
                "model": model,
                "prompt": ai_prompt,
                "stream": False,
                "options": {"temperature": 0.2}
            },
            timeout=30,
        )
        if response.ok:
            data = response.json()
            text = data.get("response", "")
            questions = extract_questions_from_text(text, num_questions)
            if questions:
                return {"questions": questions, "source": "ollama"}
    except Exception as e:
        print(f"Ollama error: {e}")

    # Fallback: Smart question generation based on topic
    try:
        questions = generate_smart_questions(prompt.lower(), num_questions)
        return {"questions": questions, "source": "smart"}
    except Exception as e:
        return {"error": f"Error generating questions: {str(e)}"}

def generate_smart_questions(topic, num_questions):
    """Generate questions based on common topics using predefined templates"""
    
    # Question templates for different topics
    templates = {
        "python": [
            {
                "question": "What is the correct way to create a list in Python?",
                "options": ["list = []", "list = {}", "list = ()", "list = <<>>"],
                "correct_answer": "list = []"
            },
            {
                "question": "Which method is used to add an element to a list?",
                "options": ["add()", "append()", "insert()", "push()"],
                "correct_answer": "append()"
            },
            {
                "question": "What does the 'self' keyword represent in Python classes?",
                "options": ["The class name", "The instance of the class", "A reserved word", "The module name"],
                "correct_answer": "The instance of the class"
            },
            {
                "question": "How do you create a virtual environment in Python?",
                "options": ["python -m venv env", "pip install venv", "python create env", "venv create"],
                "correct_answer": "python -m venv env"
            },
            {
                "question": "What is the output of print(type([]))?",
                "options": ["<class 'list'>", "<class 'array'>", "<class 'tuple'>", "<class 'set'>"],
                "correct_answer": "<class 'list'>"
            }
        ],
        "javascript": [
            {
                "question": "How do you declare a variable in JavaScript?",
                "options": ["var x = 5;", "variable x = 5;", "let x = 5;", "const x = 5;"],
                "correct_answer": "let x = 5;"
            },
            {
                "question": "What is the correct way to write an array in JavaScript?",
                "options": ["var colors = (red, green, blue);", "var colors = [red, green, blue];", "var colors = {red, green, blue};", "var colors = <red, green, blue>;"],
                "correct_answer": "var colors = [red, green, blue];"
            },
            {
                "question": "Which method removes the last element from an array?",
                "options": ["pop()", "push()", "shift()", "unshift()"],
                "correct_answer": "pop()"
            },
            {
                "question": "What is the correct way to write a conditional statement?",
                "options": ["if i == 5 then", "if i = 5", "if (i == 5)", "if i == 5"],
                "correct_answer": "if (i == 5)"
            },
            {
                "question": "How do you create a function in JavaScript?",
                "options": ["function myFunction()", "function:myFunction()", "function = myFunction()", "function => myFunction()"],
                "correct_answer": "function myFunction()"
            }
        ],
        "java": [
            {
                "question": "What is the correct way to declare a variable in Java?",
                "options": ["int x = 5;", "variable x = 5;", "let x = 5;", "var x = 5;"],
                "correct_answer": "int x = 5;"
            },
            {
                "question": "Which keyword is used to create a class in Java?",
                "options": ["class", "Class", "className", "type"],
                "correct_answer": "class"
            },
            {
                "question": "What is the main method signature in Java?",
                "options": ["public static void main(String[] args)", "public void main()", "static void main()", "public main()"],
                "correct_answer": "public static void main(String[] args)"
            },
            {
                "question": "How do you create an object in Java?",
                "options": ["new MyClass();", "create MyClass();", "object MyClass();", "MyClass.create();"],
                "correct_answer": "new MyClass();"
            },
            {
                "question": "Which data type is used for whole numbers in Java?",
                "options": ["int", "float", "double", "string"],
                "correct_answer": "int"
            }
        ],
        "database": [
            {
                "question": "What does SQL stand for?",
                "options": ["Structured Query Language", "Simple Query Language", "Standard Query Language", "System Query Language"],
                "correct_answer": "Structured Query Language"
            },
            {
                "question": "Which SQL command is used to retrieve data?",
                "options": ["SELECT", "GET", "RETRIEVE", "FETCH"],
                "correct_answer": "SELECT"
            },
            {
                "question": "What is a primary key?",
                "options": ["A key that opens the database", "A unique identifier for each record", "The first column in a table", "A foreign key reference"],
                "correct_answer": "A unique identifier for each record"
            },
            {
                "question": "Which SQL clause is used to filter results?",
                "options": ["WHERE", "FILTER", "HAVING", "SELECT"],
                "correct_answer": "WHERE"
            },
            {
                "question": "What does JOIN do in SQL?",
                "options": ["Combines rows from two or more tables", "Creates a new table", "Deletes duplicate rows", "Sorts the results"],
                "correct_answer": "Combines rows from two or more tables"
            }
        ],
        "web": [
            {
                "question": "What does HTML stand for?",
                "options": ["HyperText Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyperlink and Text Markup Language"],
                "correct_answer": "HyperText Markup Language"
            },
            {
                "question": "Which tag is used for creating a hyperlink?",
                "options": ["<link>", "<a>", "<href>", "<url>"],
                "correct_answer": "<a>"
            },
            {
                "question": "What does CSS stand for?",
                "options": ["Cascading Style Sheets", "Computer Style Sheets", "Creative Style Sheets", "Colorful Style Sheets"],
                "correct_answer": "Cascading Style Sheets"
            },
            {
                "question": "Which HTTP method is used to send data to a server?",
                "options": ["GET", "POST", "PUT", "DELETE"],
                "correct_answer": "POST"
            },
            {
                "question": "What is the purpose of JavaScript?",
                "options": ["To style web pages", "To create web pages", "To add interactivity to web pages", "To store data"],
                "correct_answer": "To add interactivity to web pages"
            }
        ]
    }
    
    # Determine which template to use based on the topic
    selected_topic = "python"  # default
    for key in templates.keys():
        if key in topic:
            selected_topic = key
            break
    
    # Get questions for the selected topic
    topic_questions = templates.get(selected_topic, templates["python"])
    
    # Return the requested number of questions (or all if fewer available)
    return topic_questions[:min(num_questions, len(topic_questions))]

def parse_ai_response(response, topic, num_questions):
    """Parse AI response and extract questions"""
    try:
        # This is a simplified parser - in a real implementation, you'd have more robust parsing
        if isinstance(response, list):
            return response[:num_questions]
        elif isinstance(response, dict) and "generated_text" in response:
            # Try to extract JSON from the generated text
            text = response["generated_text"]
            # Simple extraction - look for JSON-like structure
            start = text.find('[')
            end = text.rfind(']') + 1
            if start != -1 and end > start:
                json_str = text[start:end]
                return json.loads(json_str)[:num_questions]
    except:
        pass
    
    # Fallback to smart generation
    return generate_smart_questions(topic, num_questions) 

@app.get("/api/exam/{exam_id}/attempts")
def get_exam_attempts(exam_id: int, db: Session = Depends(get_db)):
    """Get all exam attempts for a specific exam session"""
    try:
        # Verify exam exists
        exam = db.query(models.ExamSession).filter(models.ExamSession.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        
        # Get attempts for this exam
        attempts = db.query(models.ExamAttempt).filter(models.ExamAttempt.exam_session_id == exam_id).all()
        
        result = []
        for attempt in attempts:
            user = db.query(models.User).filter(models.User.id == attempt.user_id).first()
            result.append({
                "id": attempt.id,
                "user_id": attempt.user_id,
                "user_name": user.name if user else "Unknown User",
                "user_email": user.email if user else "Unknown Email",
                "start_time": attempt.start_time.isoformat() if attempt.start_time else None,
                "end_time": attempt.end_time.isoformat() if attempt.end_time else None,
                "duration_seconds": attempt.duration_seconds,
                "alt_tab_count": attempt.alt_tab_count,
                "score": attempt.score,
                "total_questions": len(attempt.answered_questions) if attempt.answered_questions else 0,
                "average_time_per_question_seconds": attempt.average_time_per_question_seconds,
                "status": "completed" if attempt.end_time else "in_progress"
            })
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get exam attempts: {str(e)}")

def add_sample_questions(db: Session):
    """Add sample questions for testing violations"""
    try:
        # Check if questions already exist
        if db.query(models.Question).count() > 0:
            print("Sample questions already exist, skipping...")
            return
        
        sample_questions = [
            # General Knowledge Questions
            {
                "text": "What is the capital of France?",
                "options": ["London", "Berlin", "Paris", "Madrid"],
                "correct_answer": "Paris",
                "points": 1
            },
            {
                "text": "Which programming language is known as the 'language of the web'?",
                "options": ["Python", "Java", "JavaScript", "C++"],
                "correct_answer": "JavaScript",
                "points": 1
            },
            {
                "text": "What is the largest planet in our solar system?",
                "options": ["Earth", "Mars", "Jupiter", "Saturn"],
                "correct_answer": "Jupiter",
                "points": 1
            },
            {
                "text": "Who wrote 'Romeo and Juliet'?",
                "options": ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
                "correct_answer": "William Shakespeare",
                "points": 1
            },
            {
                "text": "What is the chemical symbol for gold?",
                "options": ["Ag", "Au", "Fe", "Cu"],
                "correct_answer": "Au",
                "points": 1
            },
            # Computer Science Questions
            {
                "text": "What does CPU stand for?",
                "options": ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Computer Processing Unit"],
                "correct_answer": "Central Processing Unit",
                "points": 2
            },
            {
                "text": "Which data structure operates on LIFO principle?",
                "options": ["Queue", "Stack", "Tree", "Graph"],
                "correct_answer": "Stack",
                "points": 2
            },
            {
                "text": "What is the time complexity of binary search?",
                "options": ["O(1)", "O(log n)", "O(n)", "O(n²)"],
                "correct_answer": "O(log n)",
                "points": 2
            },
            {
                "text": "Which protocol is used for secure web browsing?",
                "options": ["HTTP", "HTTPS", "FTP", "SMTP"],
                "correct_answer": "HTTPS",
                "points": 2
            },
            {
                "text": "What is the primary function of RAM?",
                "options": ["Long-term storage", "Temporary storage", "Processing data", "Displaying graphics"],
                "correct_answer": "Temporary storage",
                "points": 2
            }
        ]
        
        for q_data in sample_questions:
            question = models.Question(
                text=q_data["text"],
                options=json.dumps(q_data["options"]),  # Convert list to JSON string
                correct_answer=q_data["correct_answer"],
                points=q_data["points"],
                question_type="multiple_choice"
            )
            db.add(question)
        
        db.commit()
        print(f"✅ Added {len(sample_questions)} sample questions for testing")
        
    except Exception as e:
        print(f"❌ Error adding sample questions: {e}")
        db.rollback()

def cleanup_invalid_exams(db: Session):
    """Automatically delete exams with invalid dates"""
    try:
        current_time = datetime.datetime.utcnow()
        
        # Find exams that have expired (end_date is in the past)
        expired_exams = db.query(models.ExamSession).filter(
            models.ExamSession.end_date.isnot(None),
            models.ExamSession.end_date < current_time
        ).all()
        
        deleted_count = 0
        for exam in expired_exams:
            # Delete associated questions first
            questions = db.query(models.Question).filter(
                models.Question.exam_session_id == exam.id
            ).all()
            for question in questions:
                db.delete(question)
            
            # Delete the exam session
            db.delete(exam)
            deleted_count += 1
        
        if deleted_count > 0:
            db.commit()
            print(f"🗑️ Cleaned up {deleted_count} expired exams")
        else:
            print("✅ No expired exams found")
            
    except Exception as e:
        print(f"❌ Error cleaning up invalid exams: {e}")
        db.rollback()

def create_default_trial_exam(db: Session):
    """Create a default trial exam for new users"""
    try:
        # Check if trial exam already exists
        existing_trial = db.query(models.ExamSession).filter(
            models.ExamSession.title == "Trial Sample Exam"
        ).first()
        
        if existing_trial:
            print("✅ Default trial exam already exists")
            return existing_trial.id
        
        # Create trial exam session
        trial_exam = models.ExamSession(
            title="Trial Sample Exam",
            description="A sample exam to help you get familiar with the exam system. This exam includes various types of questions and demonstrates all features.",
            duration_minutes=15,
            status="active",
            start_date=datetime.datetime.utcnow(),
            end_date=datetime.datetime.utcnow() + datetime.timedelta(days=365)  # Valid for 1 year
        )
        
        db.add(trial_exam)
        db.commit()
        db.refresh(trial_exam)
        
        # Add sample questions to the trial exam
        trial_questions = [
            {
                "text": "Welcome to the Trial Exam! What is the capital of France?",
                "options": ["London", "Berlin", "Paris", "Madrid"],
                "correct_answer": "Paris",
                "points": 1
            },
            {
                "text": "Which programming language is known as the 'language of the web'?",
                "options": ["Python", "Java", "JavaScript", "C++"],
                "correct_answer": "JavaScript",
                "points": 1
            },
            {
                "text": "What does CPU stand for?",
                "options": ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Computer Processing Unit"],
                "correct_answer": "Central Processing Unit",
                "points": 2
            },
            {
                "text": "Which data structure operates on LIFO principle?",
                "options": ["Queue", "Stack", "Tree", "Graph"],
                "correct_answer": "Stack",
                "points": 2
            },
            {
                "text": "What is the largest planet in our solar system?",
                "options": ["Earth", "Mars", "Jupiter", "Saturn"],
                "correct_answer": "Jupiter",
                "points": 1
            }
        ]
        
        for q_data in trial_questions:
            question = models.Question(
                text=q_data["text"],
                options=json.dumps(q_data["options"]),
                correct_answer=q_data["correct_answer"],
                points=q_data["points"],
                question_type="multiple_choice",
                exam_session_id=trial_exam.id
            )
            db.add(question)
        
        db.commit()
        print(f"✅ Created default trial exam with {len(trial_questions)} questions")
        return trial_exam.id
        
    except Exception as e:
        print(f"❌ Error creating trial exam: {e}")
        db.rollback()
        return None

@app.on_event("startup")
async def on_startup():
    """Initialize the application on startup"""
    print("Starting Professional Exam System...")
    
    # Create database tables
    models.Base.metadata.create_all(bind=engine)
    
    # Initialize database
    db = SessionLocal()
    try:
        # Run lightweight migrations
        run_sqlite_migrations()

        # Clean up invalid/expired exams
        cleanup_invalid_exams(db)
        
        # Add sample questions (for general use)
        add_sample_questions(db)
        
        # Create default trial exam
        trial_exam_id = create_default_trial_exam(db)
        if trial_exam_id:
            print(f"🎯 Default trial exam available with ID: {trial_exam_id}")
        
    finally:
        db.close()
    
    print("Application startup complete!") 

def build_ai_prompt(topic: str, num_questions: int) -> str:
    """Construct a deterministic prompt asking for strict JSON output."""
    return (
        "You are an exam question generator. "
        "Generate strictly JSON with no prose before or after. "
        f"Return exactly {num_questions} items in a JSON array. Each item must be an object with keys: "
        "question (string), options (array of exactly 4 distinct strings), correct_answer (string and must exactly match one of options). "
        "Questions must be multiple-choice and clear for the topic: '" + topic + "'.\n\n"
        "Output format example (do not add comments):\n"
        "[\n"
        "  {\n"
        "    \"question\": \"What is X?\",\n"
        "    \"options\": [\"A\", \"B\", \"C\", \"D\"],\n"
        "    \"correct_answer\": \"B\"\n"
        "  }\n"
        "]"
    )

def extract_questions_from_text(text: str, num_questions: int):
    """Extract and validate a JSON array of questions from model text output."""
    if not text:
        return None
    try:
        start = text.find('[')
        end = text.rfind(']') + 1
        if start == -1 or end <= start:
            return None
        json_str = text[start:end]
        data = json.loads(json_str)
        if not isinstance(data, list):
            return None
        cleaned = []
        for item in data[:num_questions]:
            if not isinstance(item, dict):
                continue
            q = item.get("question")
            opts = item.get("options")
            ca = item.get("correct_answer")
            if not q or not isinstance(opts, list) or len(opts) != 4 or not ca:
                continue
            # Ensure strings and correct_answer matches one option
            opts = [str(o) for o in opts]
            if str(ca) not in opts:
                # attempt case-insensitive match
                lower_map = {o.lower(): o for o in opts}
                if str(ca).lower() in lower_map:
                    ca = lower_map[str(ca).lower()]
                else:
                    continue
            cleaned.append({
                "question": str(q),
                "options": opts,
                "correct_answer": str(ca),
            })
        return cleaned if cleaned else None
    except Exception:
        return None 

@app.post("/api/ai_generate_questions_unique")
async def ai_generate_questions_unique(request: Request, db: Session = Depends(get_db)):
    """Generate unique questions using AI with better prompt engineering and duplicate prevention"""
    data = await request.json()
    prompt = data.get("prompt", "").lower()
    num_questions = data.get("num_questions", 5)
    exam_id = data.get("exam_id")
    
    if not prompt:
        return {"error": "Prompt is required."}

    # Check if exam exists and get existing questions to avoid duplicates
    existing_questions = []
    if exam_id:
        exam = db.query(models.ExamSession).filter(models.ExamSession.id == exam_id).first()
        if exam:
            existing_questions = db.query(models.Question).filter(
                models.Question.exam_session_id == exam_id
            ).all()
    
    # Build a more specific prompt with context
    ai_prompt = build_ai_prompt(prompt, num_questions)
    
    # Add existing questions to avoid duplicates
    if existing_questions:
        existing_texts = [q.text for q in existing_questions[:10]]  # Limit to avoid too long prompt
        ai_prompt += f"\n\nIMPORTANT: Avoid generating questions similar to these existing ones:\n"
        ai_prompt += "\n".join([f"- {text}" for text in existing_texts])
    
    try:
        # Try multiple AI services for better reliability
        questions = None
        
        # Service 1: Hugging Face Inference API with DialoGPT-large
        try:
            api_url = "https://api-inference.huggingface.co/models/microsoft/DialoGPT-large"
            headers = {"Authorization": "Bearer hf_demo"}
            
            response = requests.post(
                api_url,
                headers=headers,
                json={
                    "inputs": ai_prompt,
                    "parameters": {
                        "max_length": 500,
                        "temperature": 0.7,
                        "do_sample": True,
                        "num_return_sequences": 1
                    }
                },
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                if isinstance(result, list) and len(result) > 0:
                    generated_text = result[0].get('generated_text', '')
                    questions = extract_questions_from_text(generated_text, num_questions)
        except Exception as e:
            print(f"DialoGPT API error: {e}")
        
        # Service 2: Try GPT2 if first one fails
        if not questions:
            try:
                api_url = "https://api-inference.huggingface.co/models/gpt2"
                headers = {"Authorization": "Bearer hf_demo"}
                
                response = requests.post(
                    api_url,
                    headers=headers,
                    json={
                        "inputs": f"Generate {num_questions} multiple choice questions about {prompt}:",
                        "parameters": {
                            "max_length": 300,
                            "temperature": 0.8,
                            "do_sample": True
                        }
                    },
                    timeout=15
                )
                
                if response.status_code == 200:
                    result = response.json()
                    if isinstance(result, list) and len(result) > 0:
                        generated_text = result[0].get('generated_text', '')
                        questions = extract_questions_from_text(generated_text, num_questions)
            except Exception as e:
                print(f"GPT2 API error: {e}")
        
        # If AI generation worked, filter out duplicates and create questions
        if questions:
            # Remove duplicates based on question text similarity
            unique_questions = []
            existing_texts = [q.text.lower() for q in existing_questions]
            
            for question in questions:
                question_text_lower = question.get("question", "").lower()
                is_duplicate = False
                
                # Check against existing questions
                for existing_text in existing_texts:
                    if question_text_lower in existing_text or existing_text in question_text_lower:
                        is_duplicate = True
                        break
                
                # Check against already added questions
                for added_question in unique_questions:
                    if question_text_lower in added_question.get("question", "").lower():
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    unique_questions.append(question)
                
                if len(unique_questions) >= num_questions:
                    break
            
            if unique_questions:
                # Create questions in database
                success_count = 0
                for question_data in unique_questions[:num_questions]:
                    try:
                        question = models.Question(
                            text=question_data['question'],
                            options=json.dumps(question_data['options']),
                            correct_answer=question_data['correct_answer'],
                            points=question_data.get('points', 1),
                            exam_session_id=exam_id
                        )
                        db.add(question)
                        success_count += 1
                    except Exception as e:
                        print(f"Error creating question: {e}")
                        continue
                
                db.commit()
                return {
                    "success": True,
                    "message": f"Generated {success_count} unique questions",
                    "source": "AI Generated"
                }
        
        # Fallback to smart generation with topic-specific questions
        questions = generate_smart_questions(prompt, num_questions)
        
        # Filter out duplicates from smart generation too
        unique_questions = []
        existing_texts = [q.text.lower() for q in existing_questions]
        
        for question in questions:
            question_text_lower = question.get("question", "").lower()
            is_duplicate = False
            
            for existing_text in existing_texts:
                if question_text_lower in existing_text or existing_text in question_text_lower:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                unique_questions.append(question)
            
            if len(unique_questions) >= num_questions:
                break
        
        # Create smart questions in database
        success_count = 0
        for question_data in unique_questions[:num_questions]:
            try:
                question = models.Question(
                    text=question_data['question'],
                    options=json.dumps(question_data['options']),
                    correct_answer=question_data['correct_answer'],
                    points=question_data.get('points', 1),
                    exam_session_id=exam_id
                )
                db.add(question)
                success_count += 1
            except Exception as e:
                print(f"Error creating smart question: {e}")
                continue
        
        db.commit()
        return {
            "success": True,
            "message": f"Generated {success_count} unique questions",
            "source": "Smart Generated"
        }
        
    except Exception as e:
        print(f"AI generation error: {e}")
        # Final fallback to smart generation
        try:
            questions = generate_smart_questions(prompt, num_questions)
            success_count = 0
            for question_data in questions[:num_questions]:
                try:
                    question = models.Question(
                        text=question_data['question'],
                        options=json.dumps(question_data['options']),
                        correct_answer=question_data['correct_answer'],
                        points=question_data.get('points', 1),
                        exam_session_id=exam_id
                    )
                    db.add(question)
                    success_count += 1
                except Exception as e:
                    print(f"Error creating fallback question: {e}")
                    continue
            
            db.commit()
            return {
                "success": True,
                "message": f"Generated {success_count} questions using fallback",
                "source": "Smart Generated"
            }
        except Exception as e2:
            print(f"Fallback generation error: {e2}")
            return {"success": False, "error": "Failed to generate questions"} 