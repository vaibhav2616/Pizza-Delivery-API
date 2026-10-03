from fastapi import APIRouter, status, Depends
from fastapi.exceptions import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from fastapi_jwt_auth import AuthJWT

from app.core.database import get_db
from app.schemas.auth import SignUpModel, LoginModel, UserProfileUpdateModel
from app.models.user import User
from app.services.auth_service import AuthService
from app.api.deps import get_current_user

auth_router = APIRouter(
    prefix="/auth",
    tags=["Authentication & Users"]
)

@auth_router.get("/", summary="Auth Service Status Check")
def hello(Authorize: AuthJWT = Depends()):
    """
    ## Protected Auth Health Check
    Validates that the client provides a valid JWT access token.
    """
    try:
        Authorize.jwt_required()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing access token"
        )
    current_user = Authorize.get_jwt_subject()
    return {"message": f"Hello {current_user}, authentication service is operational."}


@auth_router.post("/signup", status_code=status.HTTP_201_CREATED, summary="Register a New User")
@auth_router.post("/signup/", status_code=status.HTTP_201_CREATED, include_in_schema=False)
def signup(user: SignUpModel, db: Session = Depends(get_db)):
    """
    ## Register a New User Account
    - **username**: 3-25 alphanumeric characters
    - **email**: Valid email address
    - **password**: Min 6 characters (hashed with PBKDF2:SHA256)
    - **is_staff**: Staff / Kitchen Manager flag (default: false)
    - **is_active**: Account status (default: true)
    """
    new_user = AuthService.register_user(db, user)
    return jsonable_encoder({
        "success": True,
        "message": "User registered successfully",
        "user": new_user.to_dict()
    })


@auth_router.post("/login", status_code=status.HTTP_200_OK, summary="User Login & Token Issuance")
@auth_router.post("/login/", status_code=status.HTTP_200_OK, include_in_schema=False)
def login(
    user: LoginModel,
    db: Session = Depends(get_db),
    Authorize: AuthJWT = Depends()
):
    """
    ## Authenticate User & Issue JWT Tokens
    Returns access token, refresh token, and user profile data.
    """
    db_user = AuthService.authenticate_user(db, user)

    access_token = Authorize.create_access_token(subject=db_user.username)
    refresh_token = Authorize.create_refresh_token(subject=db_user.username)

    return jsonable_encoder({
        "success": True,
        "access": access_token,
        "refresh": refresh_token,
        "token_type": "Bearer",
        "user": db_user.to_dict()
    })


@auth_router.get("/refresh", summary="Refresh Expired Access Token")
@auth_router.get("/refresh/", include_in_schema=False)
def refresh_token(Authorize: AuthJWT = Depends()):
    """
    ## Refresh Access Token
    Requires a valid refresh token in the `Authorization: Bearer <refresh_token>` header.
    """
    try:
        Authorize.jwt_refresh_token_required()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please provide a valid refresh token"
        )

    current_user = Authorize.get_jwt_subject()
    new_access_token = Authorize.create_access_token(subject=current_user)

    return jsonable_encoder({
        "success": True,
        "access": new_access_token,
        "token_type": "Bearer"
    })


@auth_router.get("/me", summary="Get Current Authenticated User Profile")
@auth_router.get("/me/", include_in_schema=False)
def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """
    ## Retrieve Current User Profile
    Used by client application on startup to verify session persistence.
    """
    return jsonable_encoder(current_user.to_dict())


@auth_router.put("/me", summary="Update User Profile")
@auth_router.put("/me/", include_in_schema=False)
def update_profile(
    update_data: UserProfileUpdateModel,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    ## Update Customer Profile
    Allows updating default delivery address, phone, or email.
    """
    updated_user = AuthService.update_profile(db, current_user, update_data)
    return jsonable_encoder({
        "success": True,
        "message": "Profile updated successfully.",
        "user": updated_user.to_dict()
    })

