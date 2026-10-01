from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Text, String, ForeignKey, Float, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Order(Base):
    ORDER_STATUSES = (
        ('PENDING', 'pending'),
        ('IN-TRANSIT', 'in-transit'),
        ('DELIVERED', 'delivered'),
        ('CANCELLED', 'cancelled')
    )

    PIZZA_SIZES = (
        ('SMALL', 'small'),
        ('MEDIUM', 'medium'),
        ('LARGE', 'large'),
        ('EXTRA-LARGE', 'extra-large')
    )

    CRUST_TYPES = (
        ('HAND-TOSSED', 'Hand-Tossed Classic'),
        ('THIN-CRUST', 'Crispy Thin Crust'),
        ('CHEESE-STUFFED', 'Gourmet Cheese-Stuffed'),
        ('GLUTEN-FREE', 'Cauliflower Gluten-Free')
    )

    __tablename__ = 'orders'
    
    id = Column(Integer, primary_key=True, index=True)
    quantity = Column(Integer, nullable=False, default=1)
    order_status = Column(String(50), default="PENDING", nullable=False, index=True)
    pizza_size = Column(String(50), default="SMALL", nullable=False)
    
    # Extended fields for full real-world pizza delivery functionality
    pizza_name = Column(String(100), default="Margherita Speciale", nullable=False, index=True)
    unit_price = Column(Float, default=12.99, nullable=False)
    total_price = Column(Float, default=12.99, nullable=False)
    customer_address = Column(String(255), nullable=True)
    customer_phone = Column(String(30), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user_id = Column(Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    user = relationship('User', back_populates='orders')

    def __repr__(self):
        return f"<Order #{self.id} - {self.pizza_name} ({self.get_status_code()})>"

    def get_status_code(self) -> str:
        if hasattr(self.order_status, 'code'):
            return str(self.order_status.code).upper()
        if hasattr(self.order_status, 'value'):
            return str(self.order_status.value).upper()
        return str(self.order_status or "PENDING").upper()

    def get_size_code(self) -> str:
        if hasattr(self.pizza_size, 'code'):
            return str(self.pizza_size.code).upper()
        if hasattr(self.pizza_size, 'value'):
            return str(self.pizza_size.value).upper()
        return str(self.pizza_size or "SMALL").upper()

    def to_dict(self):
        """Serialize order cleanly without ChoiceType object serialization issues."""
        return {
            "id": self.id,
            "pizza_name": self.pizza_name or "Margherita Speciale",
            "pizza_size": self.get_size_code(),
            "quantity": int(self.quantity or 1),
            "unit_price": round(float(self.unit_price or 12.99), 2),
            "total_price": round(float(self.total_price or ((self.unit_price or 12.99) * (self.quantity or 1))), 2),
            "order_status": self.get_status_code(),
            "customer_address": self.customer_address or "Counter Pickup / Dine-in",
            "customer_phone": self.customer_phone or "N/A",
            "notes": self.notes or "",
            "user_id": self.user_id,
            "user_username": self.user.username if self.user else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
