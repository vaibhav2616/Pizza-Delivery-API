"""
Root models shim for backward compatibility.
Exposes User, Address, WalletTransaction, Order, PizzaMenu, and Coupon.
"""
from app.core.database import Base
from app.models.user import User, Address, WalletTransaction
from app.models.order import Order
from app.models.menu import PizzaMenu
from app.models.coupon import Coupon

__all__ = ["Base", "User", "Address", "WalletTransaction", "Order", "PizzaMenu", "Coupon"]
