from datetime import datetime
from sqlalchemy import Column, Integer, Boolean, Text, String, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

from datetime import datetime, timezone

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = 'user'
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password = Column(Text, nullable=False)
    phone = Column(String(30), nullable=True)
    default_address = Column(String(255), nullable=True)
    is_staff = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    orders = relationship('Order', back_populates='user', cascade='all, delete-orphan', order_by="desc(Order.created_at)")

    def __repr__(self):
        return f"<User {self.username}>"

    def to_dict(self):
        """Sanitized representation of user (never leaks password)."""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "phone": self.phone or "",
            "default_address": self.default_address or "",
            "is_staff": bool(self.is_staff),
            "is_active": bool(self.is_active),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
