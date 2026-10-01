from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Boolean, Text, String, Float, DateTime
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class PizzaMenu(Base):
    """Catalog of artisanal pizzas available for ordering."""
    __tablename__ = 'pizza_menu'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=False)
    category = Column(String(50), default="Classic", index=True) # Classic, Specialty, Vegetarian, Meat
    base_price = Column(Float, default=12.99, nullable=False)
    badge = Column(String(50), nullable=True) # Bestseller, Spicy 🔥, Chef Choice, Vegetarian 🌿
    image_url = Column(Text, nullable=True)
    ingredients = Column(Text, nullable=True)
    is_available = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=utc_now)

    def __repr__(self):
        return f"<PizzaMenu {self.name}>"

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "base_price": round(float(self.base_price), 2),
            "badge": self.badge or "",
            "image_url": self.image_url or "",
            "ingredients": self.ingredients or "",
            "is_available": bool(self.is_available)
        }
