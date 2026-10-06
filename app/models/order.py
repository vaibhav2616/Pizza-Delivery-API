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
        ('CHEESE-BURST', 'Gourmet Cheese-Burst'),
        ('WHEAT-THIN', '100% Whole Wheat Thin Crust')
    )

    __tablename__ = 'orders'
    
    id = Column(Integer, primary_key=True, index=True)
    quantity = Column(Integer, nullable=False, default=1)
    order_status = Column(String(50), default="PENDING", nullable=False, index=True)
    pizza_size = Column(String(50), default="SMALL", nullable=False)
    
    # Core Order Details (Values in ₹ INR)
    pizza_name = Column(String(100), default="Margherita Speciale", nullable=False, index=True)
    unit_price = Column(Float, default=299.0, nullable=False)
    subtotal = Column(Float, default=299.0, nullable=False)
    discount_amount = Column(Float, default=0.0, nullable=False)
    coupon_code = Column(String(50), nullable=True)
    delivery_fee = Column(Float, default=0.0, nullable=False)
    tax_amount = Column(Float, default=0.0, nullable=False)
    total_price = Column(Float, default=299.0, nullable=False)
    
    # Delivery & Payment Logistics
    order_type = Column(String(30), default="DELIVERY") # DELIVERY or TAKEAWAY
    customer_address = Column(String(255), nullable=True)
    customer_phone = Column(String(30), nullable=True)
    payment_method = Column(String(50), default="WALLET") # WALLET, UPI, COD, CARD
    payment_status = Column(String(50), default="PAID") # PAID, PENDING, REFUNDED
    delivery_partner_name = Column(String(100), default="Ramesh Kumar (Speedy Courier)")
    delivery_partner_phone = Column(String(30), default="+91 98765 43210")
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=utc_now, index=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user_id = Column(Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    user = relationship('User', back_populates='orders')

    def __repr__(self):
        return f"<Order #{self.id} - {self.pizza_name} (₹{self.total_price})>"

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
        """Serialize order cleanly with itemized Indian Rupee ₹ breakdown."""
        return {
            "id": self.id,
            "pizza_name": self.pizza_name or "Margherita Speciale",
            "pizza_size": self.get_size_code(),
            "quantity": int(self.quantity or 1),
            "unit_price": round(float(self.unit_price or 299.0), 2),
            "subtotal": round(float(self.subtotal or ((self.unit_price or 299.0) * (self.quantity or 1))), 2),
            "coupon_code": self.coupon_code or "",
            "discount_amount": round(float(self.discount_amount or 0.0), 2),
            "delivery_fee": round(float(self.delivery_fee or 0.0), 2),
            "tax_amount": round(float(self.tax_amount or 0.0), 2),
            "total_price": round(float(self.total_price or 299.0), 2),
            "order_status": self.get_status_code(),
            "order_type": self.order_type or "DELIVERY",
            "customer_address": self.customer_address or "Counter Pickup / Dine-in",
            "customer_phone": self.customer_phone or "N/A",
            "payment_method": self.payment_method or "WALLET",
            "payment_status": self.payment_status or "PAID",
            "delivery_partner_name": self.delivery_partner_name or "Ramesh Kumar (Speedy Courier)",
            "delivery_partner_phone": self.delivery_partner_phone or "+91 98765 43210",
            "notes": self.notes or "",
            "user_id": self.user_id,
            "user_username": self.user.username if self.user else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
