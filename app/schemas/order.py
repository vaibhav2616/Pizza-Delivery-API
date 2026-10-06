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
    
    # Delivery & Billing
    order_type: Optional[str] = Field("DELIVERY", description="DELIVERY or TAKEAWAY")
    customer_address: Optional[str] = Field("Counter Pickup / Dine-in", description="Delivery location")
    customer_phone: Optional[str] = Field("+91 98765 43210", description="Contact phone for courier updates")
    address_id: Optional[int] = Field(None, description="Optional Address Book ID")
    
    # Promotions & Payment
    coupon_code: Optional[str] = Field(None, description="Promo code e.g. FIRSTBITE, SLICE100")
    payment_method: Optional[str] = Field("WALLET", description="WALLET, UPI, COD, CARD")
    
    notes: Optional[str] = Field("", description="Special instructions, e.g. extra crispy crust")
    user_id: Optional[int] = None

    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "pizza_name": "Fiery Pepperoni Inferno",
                "pizza_size": "LARGE",
                "quantity": 1,
                "order_type": "DELIVERY",
                "customer_address": "Flat 402, Sunshine Apartments, Indiranagar, Bengaluru",
                "customer_phone": "+91 98765 43210",
                "coupon_code": "FIRSTBITE",
                "payment_method": "WALLET",
                "notes": "Extra chili flakes and oregano packets please!"
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
    subtotal: float
    coupon_code: Optional[str]
    discount_amount: float
    delivery_fee: float
    tax_amount: float
    total_price: float
    order_status: str
    order_type: str
    customer_address: Optional[str]
    customer_phone: Optional[str]
    payment_method: str
    payment_status: str
    delivery_partner_name: Optional[str]
    delivery_partner_phone: Optional[str]
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


class CouponValidateSchema(BaseModel):
    code: str = Field(..., description="Coupon code to validate")
    cart_subtotal: float = Field(..., ge=0, description="Current cart subtotal in ₹")


class CouponResponseSchema(BaseModel):
    id: int
    code: str
    description: str
    discount_type: str
    discount_value: float
    min_order_amount: float
    max_discount: float
    is_active: bool

    class Config:
        orm_mode = True
