from pydantic import BaseModel, field_validator
from typing import List, Optional
import datetime

class QuestionBase(BaseModel):
    text: str
    options: List[str]
    correct_answer: str

class QuestionCreate(QuestionBase):
    pass

class Question(QuestionBase):
    id: int

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    name: str

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int

    class Config:
        from_attributes = True

class AnsweredQuestion(BaseModel):
    question_id: int
    user_answer: str
    is_correct: bool
    time_taken_seconds: int

class ExamAttemptBase(BaseModel):
    user_id: int

class ExamAttemptCreate(ExamAttemptBase):
    pass

class ExamAttempt(ExamAttemptBase):
    id: int
    start_time: datetime.datetime
    end_time: Optional[datetime.datetime] = None
    duration_seconds: Optional[int] = None
    alt_tab_count: int
    score: Optional[int] = None
    average_time_per_question_seconds: Optional[float] = None
    answered_questions: List[AnsweredQuestion]

    class Config:
        from_attributes = True

    @field_validator('duration_seconds', mode='before')
    @classmethod
    def round_duration(cls, v):
        if v is not None:
            return round(v)
        return v 