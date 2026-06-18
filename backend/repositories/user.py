from sqlalchemy.orm import Session
from database.models import User
from schemas.auth import UserCreate

class UserRepository:
    @staticmethod
    def get_by_id(db: Session, user_id: str) -> User | None:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_by_email(db: Session, email: str) -> User | None:
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def create(db: Session, user_in: UserCreate, hashed_password: str) -> User:
        user_db = User(
            email=user_in.email,
            hashed_password=hashed_password,
            full_name=user_in.full_name,
            is_active=True
        )
        db.add(user_db)
        db.commit()
        db.refresh(user_db)
        return user_db
