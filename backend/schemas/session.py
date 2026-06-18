from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from .metrics import MetricsResponse
from .feedback import FeedbackResponse
from .timeline import TimelineResponse

class SessionBase(BaseModel):
    title: str
    duration_seconds: int = 0

class SessionCreate(SessionBase):
    mode: str = "interview"  # interview, technical, presentation, elevator

class SessionResponse(SessionBase):
    id: str
    user_id: str
    status: str
    audio_file_path: Optional[str] = None
    transcript_text: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SessionDetailResponse(SessionResponse):
    metrics: Optional[MetricsResponse] = None
    feedback: Optional[FeedbackResponse] = None
    timeline_items: List[TimelineResponse] = []

    class Config:
        from_attributes = True
