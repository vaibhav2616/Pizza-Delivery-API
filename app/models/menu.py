from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Boolean, Text, String, Float, DateTime
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class PizzaMenu(Base):
    """Catalog of artisanal pizzas, garlic breads, sides, and desserts."""
    __tablename__ = 'pizza_menu'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=False)
    category = Column(String(50), default="Classic", index=True) # Classic, Meat, Vegetarian, Specialty, Sides & Beverages
    base_price = Column(Float, default=299.0, nullable=False)    # Price in ₹ (Rupees) for Regular / Medium
    badge = Column(String(50), nullable=True)                   # Bestseller, Chef Choice, Spicy 🔥, Desi Fusion
    image_url = Column(Text, nullable=True)
    ingredients = Column(Text, nullable=True)
    is_veg = Column(Boolean, default=True, index=True)          # Green Veg Dot vs Red Non-Veg Dot
    rating = Column(Float, default=4.8)
    preparation_time = Column(Integer, default=20)              # In minutes
    is_available = Column(Boolean, default=True, index=True)
    
    # Mythical & Historical Pizza Lore
    origin_year = Column(Integer, nullable=True, default=1889)  # Historical birth year of the recipe
    mythical_lore = Column(Text, nullable=True)                 # Epic historical background & myth
    legend_badge = Column(String(100), nullable=True)           # e.g., "👑 Royal Decree 1889", "🌋 Vesuvius Magma"
    era = Column(String(100), nullable=True)                    # Antiquity, Renaissance, Volcanic Naples
    flavor_notes = Column(String(200), nullable=True)           # Tasting notes
    created_at = Column(DateTime, default=utc_now)

    def __repr__(self):
        return f"<PizzaMenu {self.name} (₹{self.base_price})>"

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
            "is_veg": bool(self.is_veg),
            "rating": round(float(self.rating or 4.8), 1),
            "preparation_time": int(self.preparation_time or 20),
            "is_available": bool(self.is_available),
            "origin_year": self.origin_year,
            "mythical_lore": self.mythical_lore or "",
            "legend_badge": self.legend_badge or "",
            "era": self.era or "",
            "flavor_notes": self.flavor_notes or ""
        }
