import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

# Database imports
from database.connection import engine, Base, get_db
from database.models import User, Session as SessionModel
from repositories.user import UserRepository
from repositories.session import SessionRepository

# Schema imports
from schemas.auth import UserCreate, UserResponse, Token
from schemas.session import SessionCreate, SessionResponse, SessionDetailResponse
from schemas.metrics import MetricsBase, MetricsResponse
from schemas.feedback import FeedbackBase, FeedbackResponse
from schemas.timeline import TimelineResponse

# Auth utilities
from utils.auth import verify_password, get_password_hash, create_access_token, decode_access_token
from utils.logger import get_logger

# Service and Agent imports
from services.transcription import TranscriptionService
from services.signal_processing import SignalProcessingService
from services.speech_metrics import SpeechMetricsService
from services.timeline_builder import TimelineBuilderService
from agents.fusion import MetricFusionAgent
from agents.coaching import CoachingAgent
from agents.trend import TrendAnalysisAgent

# Initialize logging
logger = get_logger(__name__)

# Ensure directories exist
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PresentIQ API",
    description="Multimodal presentation coaching API with signal processing and AI feedback.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_default_user(db: Session) -> User:
    """Helper to seed and retrieve a default developer/demo user."""
    default_email = "alex@presentiq.com"
    user = UserRepository.get_by_email(db, default_email)
    if not user:
        logger.info("Seeding default user Alex...")
        user_in = UserCreate(email=default_email, full_name="Alex", password="password123")
        hashed = get_password_hash("password123")
        user = UserRepository.create(db, user_in, hashed)
    return user

def get_current_user(
    db: Session = Depends(get_db), 
    token: Optional[str] = Depends(oauth2_scheme),
    authorization: Optional[str] = Header(None)
) -> User:
    """
    Decodes JWT token to get current user. 
    If token is missing/invalid, falls back to the default user Alex.
    """
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        
    if not token:
        # Fallback to default user to allow frontend integration to run out-of-the-box
        return get_default_user(db)
        
    payload = decode_access_token(token)
    if payload is None:
        return get_default_user(db)
        
    email: str = payload.get("sub")
    if email is None:
        return get_default_user(db)
        
    user = UserRepository.get_by_email(db, email=email)
    if user is None:
        return get_default_user(db)
        
    return user

# ----------------- AUTH ENDPOINTS -----------------

@app.post("/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = UserRepository.get_by_email(db, user_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = get_password_hash(user_in.password)
    return UserRepository.create(db, user_in, hashed)

@app.post("/auth/login", response_model=Token)
def login_for_access_token(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    user = UserRepository.get_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

# ----------------- SESSION ENDPOINTS -----------------

@app.post("/session", response_model=SessionResponse)
def create_session(
    session_in: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logger.info(f"Creating session for user {current_user.email}")
    return SessionRepository.create(db, current_user.id, session_in)

@app.get("/session", response_model=List[SessionDetailResponse])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logger.info(f"Listing sessions for user {current_user.email}")
    sessions = SessionRepository.list_by_user(db, current_user.id)
    return sessions

@app.get("/session/{id}", response_model=SessionDetailResponse)
def get_session_details(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = SessionRepository.get_by_id(db, id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@app.delete("/session/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success = SessionRepository.delete(db, id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return

# ----------------- MULTIMODAL PIPELINE ENDPOINTS -----------------

@app.post("/session/{id}/upload-audio", response_model=SessionResponse)
async def upload_audio(
    id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = SessionRepository.get_by_id(db, id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    file_extension = os.path.splitext(file.filename)[1]
    safe_filename = f"{id}{file_extension}"
    dest_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    try:
        with open(dest_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        logger.info(f"Saved audio file to {dest_path}")
    except Exception as e:
        logger.error(f"Failed to save audio file: {e}")
        raise HTTPException(status_code=500, detail="Could not save audio file")
        
    updated = SessionRepository.update_audio_and_transcript(db, id, dest_path, session.transcript_text or "")
    SessionRepository.update_status(db, id, "uploaded")
    return updated

@app.post("/session/{id}/transcribe", response_model=SessionResponse)
def transcribe_session(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = SessionRepository.get_by_id(db, id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if not session.audio_file_path or not os.path.exists(session.audio_file_path):
        # If no audio file, we will run mock transcription
        logger.warning(f"No audio file path found for session {id}. Running mock transcription.")
        audio_path = "mock.wav"
    else:
        audio_path = session.audio_file_path
        
    SessionRepository.update_status(db, id, "transcribing")
    
    # Run transcription service
    transcriber = TranscriptionService()
    transcription_result = transcriber.transcribe(audio_path)
    
    # Save transcription details (words, etc) to a local JSON cache
    cache_path = os.path.join(UPLOAD_DIR, f"{id}_transcription.json")
    with open(cache_path, "w") as f:
        json.dump(transcription_result, f, indent=2)
        
    transcript_text = transcription_result.get("text", "")
    duration = int(transcription_result.get("duration", 0))
    
    # Update session text, duration, and status
    session.transcript_text = transcript_text
    if duration > 0:
        session.duration_seconds = duration
    session.status = "transcribing"
    db.commit()
    db.refresh(session)
    
    return session

@app.post("/session/{id}/analyze-metrics", response_model=MetricsResponse)
def analyze_metrics(
    id: str,
    visual_metrics: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = SessionRepository.get_by_id(db, id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    audio_path = session.audio_file_path
    
    # 1. Run signal processing (pitch + volume)
    if audio_path and os.path.exists(audio_path):
        audio_metrics = SignalProcessingService.analyze_audio(audio_path)
    else:
        logger.warning(f"No audio file found for signal processing. Running fallback mock.")
        audio_metrics = SignalProcessingService.analyze_audio("mock.wav")
        
    # 2. Run speech analytics (WPM, fillers, pauses) from cached transcription
    cache_path = os.path.join(UPLOAD_DIR, f"{id}_transcription.json")
    if os.path.exists(cache_path):
        with open(cache_path, "r") as f:
            trans_data = json.load(f)
    else:
        # Fallback transcription if not run yet
        transcriber = TranscriptionService()
        trans_data = transcriber._mock_transcribe()
        
    words = trans_data.get("words", [])
    duration = trans_data.get("duration", session.duration_seconds or 30.0)
    
    speech_metrics = SpeechMetricsService.analyze_speech(words, duration)
    
    # 3. Fuse visual (from frontend client), acoustic, and speech metrics
    fused = MetricFusionAgent.fuse_metrics(
        video_metrics=visual_metrics,
        audio_metrics=audio_metrics,
        speech_metrics=speech_metrics
    )
    
    # Save metrics to DB
    saved_metrics = SessionRepository.save_metrics(db, id, fused)
    SessionRepository.update_status(db, id, "analyzing")
    return saved_metrics

@app.post("/session/{id}/generate-feedback", response_model=FeedbackResponse)
def generate_feedback(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = SessionRepository.get_by_id(db, id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if not session.metrics:
        raise HTTPException(status_code=400, detail="Metrics must be analyzed before generating feedback")
        
    # 1. Generate coaching feedback
    coach = CoachingAgent()
    feedback = coach.generate_feedback(session.metrics, session.transcript_text or "")
    saved_feedback = SessionRepository.save_feedback(db, id, feedback)
    
    # 2. Build timeline
    cache_path = os.path.join(UPLOAD_DIR, f"{id}_transcription.json")
    if os.path.exists(cache_path):
        with open(cache_path, "r") as f:
            trans_data = json.load(f)
        words = trans_data.get("words", [])
    else:
        words = []
        
    # Recalculate speech details for timeline builder
    duration = session.duration_seconds or 30.0
    speech_info = SpeechMetricsService.analyze_speech(words, duration)
    pauses_list = speech_info.get("pauses_list", [])
    
    timeline_items = TimelineBuilderService.build_timeline(
        words=words,
        pauses=pauses_list,
        pitch_label=session.metrics.pitch_label
    )
    SessionRepository.save_timeline(db, id, timeline_items)
    
    SessionRepository.update_status(db, id, "feedback_ready")
    return saved_feedback

# ----------------- ANALYTICS & TRENDS -----------------

@app.get("/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logger.info(f"Retrieving analytics trend report for user {current_user.email}")
    sessions = SessionRepository.list_by_user(db, current_user.id)
    trends = TrendAnalysisAgent.analyze_trends(sessions)
    return trends
