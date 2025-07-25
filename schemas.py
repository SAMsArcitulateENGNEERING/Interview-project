from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# User schemas
class UserBase(BaseModel):
    name: str
    email: str  # Changed from EmailStr to str to avoid dependency issues

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    role: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Authentication schemas
class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# Question schemas
class QuestionBase(BaseModel):
    text: str
    options: str  # JSON string
    correct_answer: str
    points: int = 1
    question_type: str = "multiple_choice"
    exam_session_id: Optional[int] = None

class QuestionCreate(QuestionBase):
    pass

class Question(QuestionBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Exam Session schemas
class ExamSessionBase(BaseModel):
    title: str
    description: Optional[str] = None
    duration_minutes: int = 60
    status: str = "draft"

class ExamSessionCreate(ExamSessionBase):
    pass

class ExamSession(ExamSessionBase):
    id: int
    created_at: Optional[datetime] = None
    questions: List[Question] = []

    class Config:
        from_attributes = True

# Exam Attempt schemas
class ExamAttemptBase(BaseModel):
    user_id: int
    exam_session_id: int
    score: Optional[float] = None
    total_questions: int = 0
    status: str = "in_progress"
    violations_count: int = 0

class ExamAttemptCreate(ExamAttemptBase):
    pass

class ExamAttempt(ExamAttemptBase):
    id: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Violation schemas
class ViolationBase(BaseModel):
    exam_attempt_id: int
    violation_type: str
    description: str
    timestamp: datetime

class ViolationCreate(ViolationBase):
    pass

class Violation(ViolationBase):
    id: int

    class Config:
        from_attributes = True

# Answer schemas
class AnswerBase(BaseModel):
    exam_attempt_id: int
    question_id: int
    selected_answer: str
    is_correct: bool = False
    time_taken_seconds: Optional[float] = None

class AnswerCreate(AnswerBase):
    pass

class Answer(AnswerBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# API Response schemas
class ExamResult(BaseModel):
    attempt_id: int
    user_name: str
    user_email: str
    score: float
    total_questions: int
    correct_answers: int
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    duration_minutes: Optional[float]
    violations_count: int

class ExamAttemptDetail(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str
    score: Optional[float]
    total_questions: int
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    status: str
    violations_count: int
    exam_session_id: int

class StatsResponse(BaseModel):
    total_exams: int
    total_attempts: int
    total_violations: int
    average_score: float
    active_exams: int

class ViolationResponse(BaseModel):
    id: int
    exam_attempt_id: int
    user_name: str
    user_email: str
    violation_type: str
    description: str
    timestamp: datetime 