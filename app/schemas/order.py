from pydantic import BaseModel, Field
from typing import Optional, List

class OrderModel(BaseModel):
    id: Optional[int] = None
    quantity: int = Field(1, ge=1, le=100, description="Quantity of pizzas (1 - 100)")
    order_status: Optional[str] = "PENDING"
    pizza_size: Optional[str] = Field("SMALL", description="SMALL, MEDIUM, LARGE, or EXTRA-LARGE")
    pizza_name: Optional[str] = Field("Margherita Speciale", description="Name of the selected artisanal pizza")
    unit_price: Optional[float] = None
    total_price: Optional[float] = None
    customer_address: Optional[str] = Field("Counter Pickup / Dine-in", description="Delivery location")
    customer_phone: Optional[str] = Field("N/A", description="Contact phone for courier updates")
    notes: Optional[str] = Field("", description="Special instructions, e.g. extra crispy crust")
    user_id: Optional[int] = None

    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "pizza_name": "Fiery Pepperoni Inferno",
                "pizza_size": "LARGE",
                "quantity": 2,
                "customer_address": "742 Evergreen Terrace, Springfield",
                "customer_phone": "+1 555-839-2011",
                "notes": "Extra hot honey on the side, please!"
            }
        }


class OrderStatusModel(BaseModel):
    order_status: str = Field(..., description="PENDING, IN-TRANSIT, DELIVERED, or CANCELLED")

    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "order_status": "IN-TRANSIT"
            }
        }


class OrderUpdateModel(BaseModel):
    pizza_name: Optional[str] = None
    pizza_size: Optional[str] = None
    quantity: Optional[int] = Field(None, ge=1, le=100)
    customer_address: Optional[str] = None
    customer_phone: Optional[str] = None
    notes: Optional[str] = None


class OrderResponseModel(BaseModel):
    id: int
    pizza_name: str
    pizza_size: str
    quantity: int
    unit_price: float
    total_price: float
    order_status: str
    customer_address: Optional[str]
    customer_phone: Optional[str]
    notes: Optional[str]
    user_id: Optional[int]
    user_username: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]

    class Config:
        orm_mode = True


class OrderStatsResponseModel(BaseModel):
    total_orders: int
    total_revenue: float
    pending_count: int
    transit_count: int
    delivered_count: int
    cancelled_count: int

