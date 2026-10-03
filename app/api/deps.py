from fastapi import Depends, status
from fastapi.exceptions import HTTPException
from fastapi_jwt_auth import AuthJWT
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User

def get_current_user(
    Authorize: AuthJWT = Depends(),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to authenticate request and return the active User object.
    Raises HTTP 401 if token is missing or invalid.
    """
    try:
        Authorize.jwt_required()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or missing Bearer access token."
        )

    username = Authorize.get_jwt_subject()
    user = db.query(User).filter(User.username == username).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with this token was not found."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated."
        )

    return user

def get_current_staff(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency ensuring the caller has staff/admin permissions.
    """
    if not current_user.is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff / Kitchen Manager privileges required."
        )
    return current_user

