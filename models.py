"""
Root models module - re-exports from app.models for unified single source of truth.
"""
from app.core.database import Base
from app.models.user import User
from app.models.order import Order
from app.models.menu import PizzaMenu
