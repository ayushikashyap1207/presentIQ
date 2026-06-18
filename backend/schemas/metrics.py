from pydantic import BaseModel
from datetime import datetime

class MetricsBase(BaseModel):
    eye_contact_percentage: float = 0.0
    posture_score: float = 0.0
    head_stability_score: float = 0.0
    fidget_score: float = 0.0
    pitch_variance: float = 0.0
    pitch_label: str = "Medium"
    volume_consistency: float = 0.0
    average_wpm: float = 0.0
    filler_words_count: int = 0
    pauses_count: int = 0

class MetricsCreate(MetricsBase):
    session_id: str

class MetricsResponse(MetricsBase):
    id: str
    session_id: str
    created_at: datetime

    class Config:
        from_attributes = True
