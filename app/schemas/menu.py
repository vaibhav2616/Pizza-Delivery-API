from pydantic import BaseModel, Field
from typing import Optional

class PizzaMenuItemSchema(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., description="Pizza flavor name")
    description: str = Field(..., description="Gourmet description of ingredients")
    category: str = Field("Classic", description="Classic, Meat, Vegetarian, Specialty")
    base_price: float = Field(12.99, gt=0, description="Base price for Medium size")
    badge: Optional[str] = Field(None, description="Badge tag (e.g., Bestseller, Spicy 🔥)")
    image_url: Optional[str] = Field(None, description="High-resolution image URL")
    ingredients: Optional[str] = Field(None, description="Comma-separated ingredients")
    is_available: bool = True

    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "name": "Fiery Pepperoni Inferno",
                "description": "Artisan double pepperoni crispy cups with hot-honey drizzle.",
                "category": "Meat",
                "base_price": 17.99,
                "badge": "Spicy 🔥",
                "image_url": "https://images.unsplash.com/photo-1628840042765-356cda07504e",
                "ingredients": "Double Pepperoni, Hot Honey, Mozzarella, Chili Flakes",
                "is_available": True
            }
        }

