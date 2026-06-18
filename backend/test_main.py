import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.connection import Base, get_db
from main import app

# Create a file-based SQLite database for integration testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override database dependency
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    # Force clean start
    if os.path.exists("./test.db"):
        os.remove("./test.db")
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    # Clean up file
    if os.path.exists("./test.db"):
        os.remove("./test.db")

client = TestClient(app)

def test_auth_flow():
    # 1. Register User
    register_response = client.post(
        "/auth/register",
        json={"email": "test@presentiq.com", "full_name": "Test User", "password": "password123"}
    )
    assert register_response.status_code == 201
    assert register_response.json()["email"] == "test@presentiq.com"

    # 2. Login User
    login_response = client.post(
        "/auth/login",
        data={"username": "test@presentiq.com", "password": "password123"}
    )
    assert login_response.status_code == 200
    token_data = login_response.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"

def test_session_lifecycle():
    # Helper header for login
    headers = {"Authorization": "Bearer dummy_token"}  # Auth defaults to seeded Alex when invalid/missing

    # 1. Create Session
    create_response = client.post(
        "/session",
        json={"title": "Practice Pitch 1", "duration_seconds": 60, "mode": "presentation"},
        headers=headers
    )
    assert create_response.status_code == 200
    session = create_response.json()
    assert session["title"] == "Practice Pitch 1"
    session_id = session["id"]

    # 2. List Sessions
    list_response = client.get("/session", headers=headers)
    assert list_response.status_code == 200
    sessions = list_response.json()
    assert len(sessions) > 0

    # 3. Upload Audio
    # Simulate a dummy wav file
    dummy_file = b"RIFF....WAVEfmt ...."
    upload_response = client.post(
        f"/session/{session_id}/upload-audio",
        files={"file": ("test.wav", dummy_file, "audio/wav")},
        headers=headers
    )
    assert upload_response.status_code == 200
    assert upload_response.json()["status"] == "uploaded"

    # 4. Transcribe Session
    transcribe_response = client.post(
        f"/session/{session_id}/transcribe",
        headers=headers
    )
    assert transcribe_response.status_code == 200
    assert transcribe_response.json()["status"] == "transcribing"
    assert "transcript_text" in transcribe_response.json()

    # 5. Analyze Metrics
    analyze_response = client.post(
        f"/session/{session_id}/analyze-metrics",
        json={"eyeContact": 78, "postureScore": 84, "headStability": 89, "fidgetScore": 8},
        headers=headers
    )
    assert analyze_response.status_code == 200
    metrics = analyze_response.json()
    assert metrics["eye_contact_percentage"] == 78.0
    assert metrics["posture_score"] == 84.0

    # 6. Generate Feedback
    feedback_response = client.post(
        f"/session/{session_id}/generate-feedback",
        headers=headers
    )
    assert feedback_response.status_code == 200
    feedback = feedback_response.json()
    assert "strengths" in feedback
    assert "areas_to_improve" in feedback
    assert feedback["summary"] is not None

    # 7. Get Analytics/Trends (need 2 sessions for trends)
    # Create second session
    create_response2 = client.post(
        "/session",
        json={"title": "Practice Pitch 2", "duration_seconds": 120, "mode": "interview"},
        headers=headers
    )
    session_id2 = create_response2.json()["id"]
    # Transcribe and analyze second session
    client.post(f"/session/{session_id2}/transcribe", headers=headers)
    client.post(
        f"/session/{session_id2}/analyze-metrics",
        json={"eyeContact": 85, "postureScore": 90, "headStability": 91, "fidgetScore": 5},
        headers=headers
    )
    client.post(f"/session/{session_id2}/generate-feedback", headers=headers)

    analytics_response = client.get("/analytics", headers=headers)
    assert analytics_response.status_code == 200
    analytics = analytics_response.json()
    assert "trends" in analytics
    assert "eye_contact" in analytics["trends"]
    assert analytics["trends"]["eye_contact"]["direction"] == "improving"

    # 8. Delete session
    delete_response = client.delete(f"/session/{session_id}", headers=headers)
    assert delete_response.status_code == 204
