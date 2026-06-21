from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database.connection import get_db
from repositories.user import UserRepository
from schemas.auth import SignupRequest, LoginRequest, TokenResponse, UserSchema, UserCreate
from core.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

@router.post("/signup", response_model=TokenResponse, status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing = UserRepository.get_by_email(db, payload.email)
    if existing:
        raise HTTPException(409, "An account with this email already exists")
    
    user_in = UserCreate(email=payload.email, full_name=payload.full_name, password=payload.password)
    user = UserRepository.create(
        db,
        user_in=user_in,
        hashed_password=hash_password(payload.password)
    )
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=UserSchema.model_validate(user))

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = UserRepository.get_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "Incorrect email or password")
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=UserSchema.model_validate(user))

@router.post("/logout", status_code=204)
def logout():
    # Stateless JWT: nothing to invalidate server-side.
    # The frontend just drops the token. Returning 204 keeps the contract clean.
    return None
