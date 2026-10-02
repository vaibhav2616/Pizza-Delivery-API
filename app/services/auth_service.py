from sqlalchemy.orm import Session
from fastapi.exceptions import HTTPException
from fastapi import status
from app.models.user import User
from app.schemas.auth import SignUpModel, LoginModel, UserProfileUpdateModel
from app.core.security import hash_password, verify_password

class AuthService:
    @staticmethod
    def register_user(db: Session, user: SignUpModel) -> User:
        clean_username = user.username.strip()
        clean_email = user.email.strip().lower()

        # Check duplicate email
        if db.query(User).filter(User.email == clean_email).first() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists."
            )

        # Check duplicate username
        if db.query(User).filter(User.username == clean_username).first() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this username already exists."
            )

        new_user = User(
            username=clean_username,
            email=clean_email,
            password=hash_password(user.password),
            is_active=True if user.is_active is None else user.is_active,
            is_staff=False if user.is_staff is None else user.is_staff
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user

    @staticmethod
    def authenticate_user(db: Session, login_data: LoginModel) -> User:
        clean_username = login_data.username.strip()
        user = db.query(User).filter(User.username == clean_username).first()

        if not user or not verify_password(login_data.password, user.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid username or password."
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated. Please contact support."
            )

        return user

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> User:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User '{username}' was not found."
            )
        return user

    @staticmethod
    def update_profile(db: Session, user: User, update_data: UserProfileUpdateModel) -> User:
        if update_data.email:
            existing = db.query(User).filter(User.email == update_data.email.strip().lower(), User.id != user.id).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This email address is already registered to another account."
                )
            user.email = update_data.email.strip().lower()

        if update_data.phone is not None:
            user.phone = update_data.phone.strip()

        if update_data.default_address is not None:
            user.default_address = update_data.default_address.strip()

        db.commit()
        db.refresh(user)
        return user

