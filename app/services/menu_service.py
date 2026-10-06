from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from fastapi.exceptions import HTTPException
from fastapi import status
from app.models.menu import PizzaMenu
from app.models.coupon import Coupon

class MenuService:
    @staticmethod
    def get_available_menu(
        db: Session,
        category: Optional[str] = None,
        is_veg: Optional[bool] = None,
        search: Optional[str] = None
    ) -> List[PizzaMenu]:
        query = db.query(PizzaMenu).filter(PizzaMenu.is_available == True)

        if category and category.lower() != "all":
            query = query.filter(PizzaMenu.category.ilike(category))

        if is_veg is not None:
            query = query.filter(PizzaMenu.is_veg == is_veg)

        if search:
            search_pattern = f"%{search.strip()}%"
            query = query.filter(
                (PizzaMenu.name.ilike(search_pattern)) |
                (PizzaMenu.description.ilike(search_pattern)) |
                (PizzaMenu.ingredients.ilike(search_pattern))
            )

        return query.all()

    @staticmethod
    def get_menu_item_by_name(db: Session, name: str) -> Optional[PizzaMenu]:
        return db.query(PizzaMenu).filter(PizzaMenu.name == name).first()

    # ==========================================================================
    # Coupon & Promotions Service
    # ==========================================================================
    @staticmethod
    def get_active_coupons(db: Session) -> List[Coupon]:
        return db.query(Coupon).filter(Coupon.is_active == True).all()

    @staticmethod
    def validate_coupon(db: Session, code: str, cart_subtotal: float) -> Tuple[Coupon, float]:
        clean_code = (code or "").strip().upper()
        coupon = db.query(Coupon).filter(Coupon.code == clean_code, Coupon.is_active == True).first()

        if not coupon:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Promo code '{clean_code}' is invalid or expired."
            )

        if cart_subtotal < coupon.min_order_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Promo code '{clean_code}' requires a minimum order amount of ₹{coupon.min_order_amount:.2f}."
            )

        discount = 0.0
        if coupon.discount_type == "PERCENTAGE":
            calc = cart_subtotal * (coupon.discount_value / 100.0)
            discount = min(calc, coupon.max_discount)
        else: # FLAT
            discount = min(coupon.discount_value, cart_subtotal)

        return coupon, round(discount, 2)
