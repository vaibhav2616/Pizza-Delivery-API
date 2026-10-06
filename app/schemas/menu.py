from pydantic import BaseModel, Field
from typing import Optional

class PizzaMenuItemSchema(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., description="Pizza flavor or dish name")
    description: str = Field(..., description="Gourmet description of ingredients")
    category: str = Field("Classic", description="Classic, Meat, Vegetarian, Specialty, Sides & Beverages")
    base_price: float = Field(299.0, gt=0, description="Base price in ₹ INR")
    badge: Optional[str] = Field(None, description="Badge tag (e.g., Bestseller, Spicy 🔥, Desi Fusion)")
    image_url: Optional[str] = Field(None, description="High-resolution image URL")
    ingredients: Optional[str] = Field(None, description="Comma-separated ingredients")
    is_veg: bool = Field(True, description="True for Vegetarian (Green Dot), False for Non-Veg (Red Dot)")
    rating: float = Field(4.8, description="Rating out of 5.0")
    preparation_time: int = Field(20, description="Prep time in minutes")
    is_available: bool = True

    class Config:
        orm_mode = True
