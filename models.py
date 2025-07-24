import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, JSON, Date, Time, Boolean
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    
    attempts = relationship("ExamAttempt", back_populates="user")

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(String, nullable=False)
    options = Column(JSON, nullable=False)
    correct_answer = Column(String, nullable=False)

class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    start_time = Column(DateTime, default=datetime.datetime.utcnow)
    end_time = Column(DateTime)
    duration_seconds = Column(Integer)
    alt_tab_count = Column(Integer, default=0)
    score = Column(Integer)
    average_time_per_question_seconds = Column(Float)
    answered_questions = Column(JSON, default=[])

    user = relationship("User", back_populates="attempts")
    exam_session_id = Column(Integer, ForeignKey("exam_sessions.id"), nullable=True)

class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    duration_minutes = Column(Integer, default=60)
    question_count = Column(Integer, default=10)
    start_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    password = Column(String, nullable=True)
    enable_monitoring = Column(Boolean, default=True)
    status = Column(String, default="scheduled")  # scheduled, active, completed, cancelled
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    attempts = relationship("ExamAttempt", back_populates="exam_session")

# Update ExamAttempt to include relationship
ExamAttempt.exam_session = relationship("ExamSession", back_populates="attempts") 