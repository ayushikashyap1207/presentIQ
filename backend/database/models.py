import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, Boolean, JSON, Enum
from sqlalchemy.orm import relationship
from .connection import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    status = Column(
        Enum("created", "uploaded", "transcribing", "analyzing", "feedback_ready", name="session_status"),
        default="created",
        nullable=False
    )
    audio_file_path = Column(String(1024), nullable=True)
    duration_seconds = Column(Integer, default=0)
    transcript_text = Column(String, nullable=True)
    mode = Column(String(50), default="interview")
    question = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="sessions")
    metrics = relationship("Metrics", uselist=False, back_populates="session", cascade="all, delete-orphan")
    feedback = relationship("Feedback", uselist=False, back_populates="session", cascade="all, delete-orphan")
    timeline_items = relationship("Timeline", back_populates="session", cascade="all, delete-orphan")

class Metrics(Base):
    __tablename__ = "metrics"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # Video metrics
    eye_contact_percentage = Column(Float, default=0.0)
    posture_score = Column(Float, default=0.0)
    head_stability_score = Column(Float, default=0.0)
    fidget_score = Column(Float, default=0.0)

    # Audio/Speech metrics
    pitch_variance = Column(Float, default=0.0)
    pitch_label = Column(String(50), default="Medium")
    volume_consistency = Column(Float, default=0.0)
    average_wpm = Column(Float, default=0.0)
    filler_words_count = Column(Integer, default=0)
    pauses_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("Session", back_populates="metrics")

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    strengths = Column(JSON, default=list)  # JSON list of strings
    areas_to_improve = Column(JSON, default=list)  # JSON list of strings
    exercises = Column(JSON, default=list)  # JSON list of strings
    suggestions = Column(JSON, default=list)  # JSON list of strings
    summary = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("Session", back_populates="feedback")

class Timeline(Base):
    __tablename__ = "timeline"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    
    start_seconds = Column(Float, nullable=False)
    end_seconds = Column(Float, nullable=False)
    observation = Column(String(1024), nullable=False)
    category = Column(String(50), nullable=False)  # pace, pause, filler, pitch

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("Session", back_populates="timeline_items")
