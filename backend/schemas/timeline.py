from pydantic import BaseModel
from datetime import datetime

class TimelineBase(BaseModel):
    start_seconds: float
    end_seconds: float
    observation: str
    category: str  # pace, pause, filler, pitch

class TimelineCreate(TimelineBase):
    session_id: str

class TimelineResponse(TimelineBase):
    id: str
    session_id: str
    created_at: datetime

    class Config:
        from_attributes = True
