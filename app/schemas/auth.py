from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime

class SignUpModel(BaseModel):
    id: Optional[int] = None
    username: str = Field(..., min_length=3, max_length=25, description="Unique alphanumeric username")
    email: str = Field(..., min_length=5, max_length=80, description="Valid email address")
    password: str = Field(..., min_length=6, max_length=128, description="User password (min 6 chars)")
    is_staff: Optional[bool] = False
    is_active: Optional[bool] = True

    class Config:
        orm_mode = True
        schema_extra = {
            'example': {
                "username": "johndoe",
                "email": "johndoe@gmail.com",
                "password": "Password123!",
                "is_staff": False,
                "is_active": True
            }
        }


class LoginModel(BaseModel):
    username: str = Field(..., description="Registered username")
    password: str = Field(..., description="Account password")

    class Config:
        schema_extra = {
            'example': {
                "username": "johndoe",
                "password": "Password123!"
            }
        }


class UserResponseModel(BaseModel):
    id: int
    username: str
    email: str
    phone: Optional[str] = ""
    default_address: Optional[str] = ""
    is_staff: bool
    is_active: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        orm_mode = True


class UserProfileUpdateModel(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    default_address: Optional[str] = None


class TokenResponseModel(BaseModel):
    success: bool = True
    access: str
    refresh: str
    token_type: str = "Bearer"
    user: UserResponseModel

