import os
from typing import List
from pydantic import BaseModel

class Settings(BaseModel):
    """
    High-Level Application Configuration and Environment Settings.
    Adheres to 12-factor application design principles.
    """
    app_name: str = "SliceCraft Artisanal Pizza Delivery API"
    app_version: str = "2.2.0"
    debug: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")
    
    # Currency configuration
    currency_symbol: str = "₹"
    currency_code: str = "INR"

    # Database Configuration:
    database_url: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./pizza_delivery.db"
    )
    
    # JWT Security Configuration:
    authjwt_secret_key: str = os.getenv(
        "JWT_SECRET_KEY", 
        "855b67d73cb0d368d9a811e0ad19327d4f3a1029db173444496d585408cdd11e"
    )
    authjwt_token_location: set = {"headers"}
    authjwt_header_name: str = "Authorization"
    authjwt_header_type: str = "Bearer"
    authjwt_access_token_expires: int = int(os.getenv("JWT_ACCESS_EXPIRES_MINUTES", "1440")) # 24 hours
    authjwt_refresh_token_expires: int = int(os.getenv("JWT_REFRESH_EXPIRES_DAYS", "30")) # 30 days
    
    # CORS Configuration:
    cors_origins: List[str] = ["*"]
    
    # Real-world Indian Food Delivery rules (Values in ₹ INR)
    free_delivery_threshold: float = 399.0     # Free delivery on orders ₹399+
    standard_delivery_fee: float = 49.0       # Standard delivery fee ₹49
    tax_rate: float = 0.05                     # 5% Restaurant GST
    welcome_wallet_bonus: float = 500.0        # ₹500 welcome wallet bonus
    order_cashback_rate: float = 0.05          # 5% cashback on completed orders

    class Config:
        case_sensitive = True

settings = Settings()
