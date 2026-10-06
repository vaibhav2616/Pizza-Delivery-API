from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Boolean, String, Float, DateTime, Text
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Coupon(Base):
    """Promotional discount coupons (e.g., FIRSTBITE, SLICE100, CHEESELOVER)"""
    __tablename__ = 'coupons'

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=False)
    discount_type = Column(String(20), default="PERCENTAGE")  # PERCENTAGE or FLAT
    discount_value = Column(Float, nullable=False)            # e.g., 20% or ₹100
    min_order_amount = Column(Float, default=0.0)            # Minimum cart subtotal in ₹
    max_discount = Column(Float, default=500.0)              # Max cap for percentage discounts
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=utc_now)

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "description": self.description,
            "discount_type": self.discount_type,
            "discount_value": self.discount_value,
            "min_order_amount": self.min_order_amount,
            "max_discount": self.max_discount,
            "is_active": bool(self.is_active)
        }

