from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Boolean, Text, String, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

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
    wallet_balance = Column(Float, default=500.0, nullable=False) # In ₹ (INR)
    is_staff = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    orders = relationship('Order', back_populates='user', cascade='all, delete-orphan', order_by="desc(Order.created_at)")
    addresses = relationship('Address', back_populates='user', cascade='all, delete-orphan', order_by="desc(Address.is_default)")
    wallet_transactions = relationship('WalletTransaction', back_populates='user', cascade='all, delete-orphan', order_by="desc(WalletTransaction.created_at)")

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
            "wallet_balance": round(float(self.wallet_balance or 0.0), 2),
            "is_staff": bool(self.is_staff),
            "is_active": bool(self.is_active),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Address(Base):
    """Customer Address Book for Home, Work, and Custom delivery locations"""
    __tablename__ = 'addresses'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    label = Column(String(50), default="Home") # Home, Work, Other
    receiver_name = Column(String(100), nullable=False)
    receiver_phone = Column(String(20), nullable=False)
    street_address = Column(String(255), nullable=False)
    landmark = Column(String(100), nullable=True)
    city = Column(String(100), default="Bengaluru")
    pincode = Column(String(20), nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

    user = relationship('User', back_populates='addresses')

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "label": self.label,
            "receiver_name": self.receiver_name,
            "receiver_phone": self.receiver_phone,
            "street_address": self.street_address,
            "landmark": self.landmark or "",
            "city": self.city,
            "pincode": self.pincode,
            "is_default": bool(self.is_default),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class WalletTransaction(Base):
    """SliceWallet audit ledger for credits, cashbacks, and order payments"""
    __tablename__ = 'wallet_transactions'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    amount = Column(Float, nullable=False) # Positive for CREDIT, Negative for DEBIT
    transaction_type = Column(String(20), nullable=False) # CREDIT, DEBIT, CASHBACK, REWARD
    description = Column(String(255), nullable=False)
    balance_after = Column(Float, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    user = relationship('User', back_populates='wallet_transactions')

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "amount": round(float(self.amount), 2),
            "transaction_type": self.transaction_type,
            "description": self.description,
            "balance_after": round(float(self.balance_after), 2),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
