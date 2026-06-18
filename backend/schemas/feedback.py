from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class FeedbackBase(BaseModel):
    strengths: List[str] = Field(default_factory=list)
    areas_to_improve: List[str] = Field(default_factory=list)
    exercises: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    summary: Optional[str] = None

class FeedbackCreate(FeedbackBase):
    session_id: str

class FeedbackResponse(FeedbackBase):
    id: str
    session_id: str
    created_at: datetime

    class Config:
        from_attributes = True
