"""
Root schemas shim for backward compatibility.
Exposes all Pydantic schemas from app.schemas.
"""
from app.schemas import *

__all__ = [
    "SignUpModel",
    "LoginModel",
    "AddressCreateSchema",
    "AddressResponseSchema",
    "WalletTopupSchema",
    "WalletTransactionResponseSchema",
    "UserResponseModel",
    "UserProfileUpdateModel",
    "TokenResponseModel",
    "OrderModel",
    "OrderStatusModel",
    "OrderUpdateModel",
    "OrderResponseModel",
    "OrderStatsResponseModel",
    "CouponValidateSchema",
    "CouponResponseSchema",
    "PizzaMenuItemSchema",
    "Settings"
]
