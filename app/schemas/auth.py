from pydantic import BaseModel, Field
from typing import Optional, List

class SignUpModel(BaseModel):
    id: Optional[int] = None
    username: str = Field(..., min_length=3, max_length=25, description="Unique alphanumeric username")
    email: str = Field(..., min_length=5, max_length=80, description="Valid email address")
    password: str = Field(..., min_length=6, max_length=128, description="User password (min 6 chars)")
    phone: Optional[str] = Field("+91 98765 43210", description="10-digit mobile number")
    is_staff: Optional[bool] = False
    is_active: Optional[bool] = True

    class Config:
        orm_mode = True
        schema_extra = {
            'example': {
                "username": "johndoe",
                "email": "johndoe@gmail.com",
                "password": "Password123!",
                "phone": "+91 98765 43210",
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


class AddressCreateSchema(BaseModel):
    label: str = Field("Home", description="Home, Work, or Other")
    receiver_name: str = Field(..., min_length=2, max_length=100, description="Contact name")
    receiver_phone: str = Field(..., min_length=10, max_length=15, description="Contact phone")
    street_address: str = Field(..., min_length=5, max_length=255, description="Flat/House No, Building, Street")
    landmark: Optional[str] = Field("", description="Nearby landmark")
    city: str = Field("Bengaluru", description="City")
    pincode: str = Field(..., min_length=6, max_length=10, description="Postal PIN Code")
    is_default: Optional[bool] = False


class AddressResponseSchema(BaseModel):
    id: int
    user_id: int
    label: str
    receiver_name: str
    receiver_phone: str
    street_address: str
    landmark: Optional[str] = ""
    city: str
    pincode: str
    is_default: bool
    created_at: Optional[str] = None

    class Config:
        orm_mode = True


class WalletTopupSchema(BaseModel):
    amount: float = Field(..., gt=0, le=10000, description="Amount in ₹ to add to SliceWallet (₹10 - ₹10,000)")


class WalletTransactionResponseSchema(BaseModel):
    id: int
    amount: float
    transaction_type: str
    description: str
    balance_after: float
    created_at: Optional[str] = None

    class Config:
        orm_mode = True


class UserResponseModel(BaseModel):
    id: int
    username: str
    email: str
    phone: Optional[str] = ""
    default_address: Optional[str] = ""
    wallet_balance: float = 500.0
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
