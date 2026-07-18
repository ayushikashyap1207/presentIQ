import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Database imports
from database.connection import engine, Base, get_db
from database.models import User, Session as SessionModel
from repositories.user import UserRepository
from repositories.session import SessionRepository

# Schema imports
from schemas.auth import UserCreate, UserResponse, Token, LoginRequest
from schemas.session import SessionCreate, SessionResponse, SessionDetailResponse
from schemas.metrics import MetricsBase, MetricsResponse
from schemas.feedback import FeedbackBase, FeedbackResponse
from schemas.timeline import TimelineResponse

# Auth utilities
from core.security import decode_access_token
from routers.auth import router as auth_router
from utils.logger import get_logger

# Service and Agent imports
from services.transcription import TranscriptionService
from services.signal_processing import SignalProcessingService
from services.speech_metrics import SpeechMetricsService
from services.timeline_builder import TimelineBuilderService
from agents.fusion import MetricFusionAgent
from agents.coaching import CoachingAgent
from agents.trend import TrendAnalysisAgent

# RAG imports
from backend.rag.indexer import build_index, get_collection
from backend.rag.retriever import pull_relevant_chunks

# Initialize logging
logger = get_logger(__name__)

# Ensure directories exist
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize database tables
Base.metadata.create_all(bind=engine)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler — runs startup tasks before serving requests."""
    # Build the RAG vector index on startup (idempotent — skips if already indexed)
    logger.info("[Startup] Building RAG knowledge index...")
    try:
        build_index()
        logger.info("[Startup] RAG index ready.")
    except Exception as e:
        logger.warning(f"[Startup] RAG index build failed (non-fatal): {e}")
    yield  # app runs here

app = FastAPI(
    title="PresentIQ API",
    description="Multimodal presentation coaching API with signal processing and AI feedback.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

security = HTTPBearer()

def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Decodes JWT token to get current user by ID. 
    Strictly requires credentials and throws 401 if missing/invalid.
    """
    user_id = decode_access_token(creds.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
        
    user = UserRepository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    return user

# Auth endpoints are handled by auth_router included above.

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


# ----------------- RAG KNOWLEDGE Q&A ENDPOINT -----------------

class AskRequest(BaseModel):
    question: str
    metrics: Optional[Dict[str, Any]] = None

class AskResponse(BaseModel):
    answer: str
    sources: List[str]
    chunks_used: int

@app.post("/api/v1/ask", response_model=AskResponse)
def ask_coach(
    body: AskRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Free-form coaching Q&A endpoint.

    If `metrics` are provided the pull agent identifies weak areas and
    retrieves knowledge targeted to those weaknesses.  Otherwise, a
    direct embedding search is performed against the full knowledge base.

    Example questions:
      - "How do I stop saying um?"
      - "What is a good WPM for job interviews?"
      - "How can I improve my eye contact on camera?"
    """
    logger.info(f"[Ask] '{body.question[:60]}' — user {current_user.email}")

    # ── Step 1: Retrieve relevant chunks ─────────────────────────────────
    if body.metrics:
        chunks = pull_relevant_chunks(body.metrics, n_results=6)
    else:
        try:
            collection = get_collection()
            result = collection.query(
                query_texts=[body.question],
                n_results=min(6, max(collection.count(), 1)),
                include=["documents"],
            )
            chunks = result["documents"][0] if result and result.get("documents") else []
        except Exception as e:
            logger.error(f"[Ask] ChromaDB query failed: {e}")
            chunks = []

    if not chunks:
        return AskResponse(
            answer="I don't have specific knowledge on that topic yet. Try asking about filler words, speaking pace, posture, eye contact, or vocal variety.",
            sources=[],
            chunks_used=0,
        )

    context = "\n\n---\n\n".join(chunks)

    # ── Step 2: Extract unique source names from metadata ─────────────────
    # Source names are inferred from chunk content headers (quick heuristic)
    source_map = {
        "filler": "filler_words_research",
        "wpm": "wpm_norms",
        "words per minute": "wpm_norms",
        "pitch": "speech_coaching",
        "volume": "speech_coaching",
        "breathing": "speech_coaching",
        "posture": "posture_eye_contact",
        "eye contact": "posture_eye_contact",
        "gesture": "body_language",
        "head": "body_language",
        "mirror": "body_language",
    }
    detected_sources: set[str] = set()
    context_lower = context.lower()
    for keyword, source in source_map.items():
        if keyword in context_lower:
            detected_sources.add(source)

    sources_list = sorted(detected_sources) if detected_sources else ["speech_coaching"]

    # ── Step 3: Call OpenAI with retrieved context ─────────────────────────
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        # Graceful degradation without API key
        return AskResponse(
            answer=(
                "(OpenAI API key not configured — showing raw knowledge)\n\n"
                + context[:800]
            ),
            sources=sources_list,
            chunks_used=len(chunks),
        )

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a presentation coach. Answer the question using only "
                        "the provided knowledge. Be specific and practical. "
                        "Cite technique names and numbers where available."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"KNOWLEDGE:\n{context}\n\n"
                        f"QUESTION: {body.question}"
                    ),
                },
            ],
            temperature=0.3,
            max_tokens=512,
        )
        answer = response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"[Ask] OpenAI call failed: {e}")
        raise HTTPException(status_code=502, detail="Coaching service temporarily unavailable.")

    return AskResponse(
        answer=answer,
        sources=sources_list,
        chunks_used=len(chunks),
    )
