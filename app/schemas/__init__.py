from app.schemas.auth import (
    SignUpModel,
    LoginModel,
    UserResponseModel,
    UserProfileUpdateModel,
    TokenResponseModel
)
from app.schemas.order import (
    OrderModel,
    OrderStatusModel,
    OrderUpdateModel,
    OrderResponseModel,
    OrderStatsResponseModel
)
from app.schemas.menu import PizzaMenuItemSchema
from app.core.config import settings
from pydantic import BaseModel

class Settings(BaseModel):
    """fastapi-jwt-auth configuration schema adapter"""
    authjwt_secret_key: str = settings.authjwt_secret_key
    authjwt_token_location: set = settings.authjwt_token_location
    authjwt_header_name: str = settings.authjwt_header_name
    authjwt_header_type: str = settings.authjwt_header_type

__all__ = [
    "SignUpModel",
    "LoginModel",
    "UserResponseModel",
    "UserProfileUpdateModel",
    "TokenResponseModel",
    "OrderModel",
    "OrderStatusModel",
    "OrderUpdateModel",
    "OrderResponseModel",
    "OrderStatsResponseModel",
    "PizzaMenuItemSchema",
    "Settings"
]

