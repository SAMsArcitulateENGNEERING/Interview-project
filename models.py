import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, JSON, Date, Time, Boolean, Text
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="participant")  # "host" or "participant"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    attempts = relationship("ExamAttempt", back_populates="user")

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(String, nullable=False)
    options = Column(String, nullable=False)  # JSON string
    correct_answer = Column(String, nullable=False)
    points = Column(Integer, default=1)
    question_type = Column(String, default="multiple_choice")
    exam_session_id = Column(Integer, ForeignKey("exam_sessions.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    order_index = Column(Integer, nullable=True)  # order within an exam

class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    duration_minutes = Column(Integer, default=60)
    status = Column(String, default="draft")  # draft, active, completed, cancelled
    start_date = Column(DateTime, nullable=True)  # When the exam becomes available
    end_date = Column(DateTime, nullable=True)    # When the exam expires
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    attempts = relationship("ExamAttempt", back_populates="exam_session")
    questions = relationship("Question", back_populates="exam_session")

# Update Question to include relationship
Question.exam_session = relationship("ExamSession", back_populates="questions")

class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    exam_session_id = Column(Integer, ForeignKey("exam_sessions.id"))
    score = Column(Float, nullable=True)
    total_questions = Column(Integer, default=0)
    start_time = Column(DateTime, default=datetime.datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    # Fields used throughout the app
    alt_tab_count = Column(Integer, default=0)
    answered_questions = Column(JSON, default=list)  # stored as JSON/TEXT in SQLite
    duration_seconds = Column(Integer, nullable=True)
    average_time_per_question_seconds = Column(Float, nullable=True)
    status = Column(String, default="in_progress")  # in_progress, completed, abandoned
    violations_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="attempts")
    exam_session = relationship("ExamSession", back_populates="attempts")

class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    exam_attempt_id = Column(Integer, ForeignKey("exam_attempts.id"))
    violation_type = Column(String, nullable=False)  # alt_tab, window_resize, etc.
    description = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    exam_attempt_id = Column(Integer, ForeignKey("exam_attempts.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    selected_answer = Column(String, nullable=False)
    is_correct = Column(Boolean, default=False)
    time_taken_seconds = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow) 