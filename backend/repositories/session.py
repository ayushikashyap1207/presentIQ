from sqlalchemy.orm import Session
from database.models import Session as SessionModel, Metrics, Feedback, Timeline
from schemas.session import SessionCreate
from schemas.metrics import MetricsBase
from schemas.feedback import FeedbackBase
from schemas.timeline import TimelineBase
from typing import List

class SessionRepository:
    @staticmethod
    def get_by_id(db: Session, session_id: str, user_id: str) -> SessionModel | None:
        return db.query(SessionModel).filter(
            SessionModel.id == session_id,
            SessionModel.user_id == user_id
        ).first()

    @staticmethod
    def list_by_user(db: Session, user_id: str, limit: int = 100, skip: int = 0) -> List[SessionModel]:
        return db.query(SessionModel).filter(
            SessionModel.user_id == user_id
        ).order_by(SessionModel.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def create(db: Session, user_id: str, session_in: SessionCreate) -> SessionModel:
        session_db = SessionModel(
            user_id=user_id,
            title=session_in.title,
            duration_seconds=session_in.duration_seconds,
            status="created"
        )
        db.add(session_db)
        db.commit()
        db.refresh(session_db)
        return session_db

    @staticmethod
    def update_status(db: Session, session_id: str, status: str) -> SessionModel | None:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if session:
            session.status = status
            db.commit()
            db.refresh(session)
        return session

    @staticmethod
    def update_audio_and_transcript(db: Session, session_id: str, audio_file_path: str, transcript_text: str) -> SessionModel | None:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if session:
            session.audio_file_path = audio_file_path
            session.transcript_text = transcript_text
            db.commit()
            db.refresh(session)
        return session

    @staticmethod
    def delete(db: Session, session_id: str, user_id: str) -> bool:
        session = db.query(SessionModel).filter(
            SessionModel.id == session_id,
            SessionModel.user_id == user_id
        ).first()
        if session:
            db.delete(session)
            db.commit()
            return True
        return False

    @staticmethod
    def save_metrics(db: Session, session_id: str, metrics_in: MetricsBase) -> Metrics:
        # Check if already exists to update
        metrics_db = db.query(Metrics).filter(Metrics.session_id == session_id).first()
        if not metrics_db:
            metrics_db = Metrics(session_id=session_id)
            db.add(metrics_db)
            
        metrics_db.eye_contact_percentage = metrics_in.eye_contact_percentage
        metrics_db.posture_score = metrics_in.posture_score
        metrics_db.head_stability_score = metrics_in.head_stability_score
        metrics_db.fidget_score = metrics_in.fidget_score
        metrics_db.pitch_variance = metrics_in.pitch_variance
        metrics_db.pitch_label = metrics_in.pitch_label
        metrics_db.volume_consistency = metrics_in.volume_consistency
        metrics_db.average_wpm = metrics_in.average_wpm
        metrics_db.filler_words_count = metrics_in.filler_words_count
        metrics_db.pauses_count = metrics_in.pauses_count
        
        db.commit()
        db.refresh(metrics_db)
        return metrics_db

    @staticmethod
    def save_feedback(db: Session, session_id: str, feedback_in: FeedbackBase) -> Feedback:
        feedback_db = db.query(Feedback).filter(Feedback.session_id == session_id).first()
        if not feedback_db:
            feedback_db = Feedback(session_id=session_id)
            db.add(feedback_db)
            
        feedback_db.strengths = feedback_in.strengths
        feedback_db.areas_to_improve = feedback_in.areas_to_improve
        feedback_db.exercises = feedback_in.exercises
        feedback_db.suggestions = feedback_in.suggestions
        feedback_db.summary = feedback_in.summary
        
        db.commit()
        db.refresh(feedback_db)
        return feedback_db

    @staticmethod
    def save_timeline(db: Session, session_id: str, timeline_items: List[TimelineBase]) -> List[Timeline]:
        # Delete old timeline items
        db.query(Timeline).filter(Timeline.session_id == session_id).delete()
        
        db_items = []
        for item in timeline_items:
            db_item = Timeline(
                session_id=session_id,
                start_seconds=item.start_seconds,
                end_seconds=item.end_seconds,
                observation=item.observation,
                category=item.category
            )
            db.add(db_item)
            db_items.append(db_item)
            
        db.commit()
        return db_items
