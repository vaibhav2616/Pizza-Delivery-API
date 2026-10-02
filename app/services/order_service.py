from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi.exceptions import HTTPException
from fastapi import status

from app.models.order import Order
from app.models.user import User
from app.models.menu import PizzaMenu
from app.schemas.order import OrderModel, OrderUpdateModel, OrderStatusModel

SIZE_MULTIPLIERS = {
    "SMALL": 0.85,
    "MEDIUM": 1.0,
    "LARGE": 1.25,
    "EXTRA-LARGE": 1.5
}

FALLBACK_SIZE_PRICES = {
    "SMALL": 11.99,
    "MEDIUM": 14.99,
    "LARGE": 18.99,
    "EXTRA-LARGE": 23.99
}

VALID_STATUSES = ["PENDING", "IN-TRANSIT", "DELIVERED", "CANCELLED"]

class OrderService:
    @staticmethod
    def calculate_price(pizza_name: str, pizza_size: str, quantity: int, db: Session) -> Tuple[float, float]:
        norm_size = (pizza_size or "SMALL").upper()
        if norm_size not in SIZE_MULTIPLIERS:
            norm_size = "SMALL"

        menu_item = db.query(PizzaMenu).filter(PizzaMenu.name == pizza_name).first()
        if menu_item and menu_item.base_price:
            multiplier = SIZE_MULTIPLIERS.get(norm_size, 1.0)
            unit_price = round(menu_item.base_price * multiplier, 2)
        else:
            unit_price = FALLBACK_SIZE_PRICES.get(norm_size, 14.99)

        total_price = round(unit_price * max(1, quantity), 2)
        return unit_price, total_price

    @staticmethod
    def create_order(db: Session, user: User, order_data: OrderModel) -> Order:
        norm_size = (order_data.pizza_size or "SMALL").upper()
        if norm_size not in SIZE_MULTIPLIERS:
            norm_size = "SMALL"

        pizza_name = (order_data.pizza_name or "Margherita Speciale").strip()
        quantity = max(1, order_data.quantity)

        unit_price, total_price = OrderService.calculate_price(pizza_name, norm_size, quantity, db)

        new_order = Order(
            pizza_name=pizza_name,
            pizza_size=norm_size,
            quantity=quantity,
            order_status="PENDING",
            unit_price=unit_price,
            total_price=total_price,
            customer_address=(order_data.customer_address or "Counter Pickup / Dine-in").strip(),
            customer_phone=(order_data.customer_phone or "N/A").strip(),
            notes=(order_data.notes or "").strip(),
            user_id=user.id
        )

        db.add(new_order)
        db.commit()
        db.refresh(new_order)
        return new_order

    @staticmethod
    def list_orders(
        db: Session,
        status_filter: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Order]:
        query = db.query(Order).order_by(desc(Order.created_at))

        if status_filter:
            norm_status = status_filter.strip().upper()
            if norm_status in VALID_STATUSES:
                query = query.filter(Order.order_status == norm_status)

        if search:
            search_pattern = f"%{search.strip()}%"
            query = query.filter(
                (Order.pizza_name.ilike(search_pattern)) |
                (Order.customer_address.ilike(search_pattern)) |
                (Order.customer_phone.ilike(search_pattern))
            )

        return query.all()

    @staticmethod
    def get_user_orders(db: Session, user_id: int) -> List[Order]:
        return db.query(Order).filter(Order.user_id == user_id).order_by(desc(Order.created_at)).all()

    @staticmethod
    def get_order_by_id(db: Session, order_id: int, current_user: Optional[User] = None) -> Order:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order #{order_id} was not found."
            )

        if current_user and not current_user.is_staff and order.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view this order."
            )

        return order

    @staticmethod
    def update_order(db: Session, order_id: int, update_data: OrderModel, current_user: User) -> Order:
        order = OrderService.get_order_by_id(db, order_id, current_user)

        # Disallow customer editing if order has already left the kitchen
        if not current_user.is_staff and order.get_status_code() in ("IN-TRANSIT", "DELIVERED", "CANCELLED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order #{order_id} cannot be modified because it is already {order.get_status_code()}."
            )

        if update_data.pizza_size:
            order.pizza_size = update_data.pizza_size.strip().upper()
        if update_data.quantity:
            order.quantity = max(1, update_data.quantity)
        if update_data.pizza_name:
            order.pizza_name = update_data.pizza_name.strip()
        if update_data.customer_address:
            order.customer_address = update_data.customer_address.strip()
        if update_data.customer_phone:
            order.customer_phone = update_data.customer_phone.strip()
        if update_data.notes is not None:
            order.notes = update_data.notes.strip()

        # Recalculate price
        unit_price, total_price = OrderService.calculate_price(
            order.pizza_name,
            order.get_size_code(),
            order.quantity,
            db
        )
        order.unit_price = unit_price
        order.total_price = total_price

        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def update_status(db: Session, order_id: int, status_input: str, current_user: User) -> Order:
        if not current_user.is_staff:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Staff privileges required to update order status."
            )

        order = OrderService.get_order_by_id(db, order_id)
        norm_status = (status_input or "").strip().upper()

        if norm_status not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid order status '{status_input}'. Must be one of {VALID_STATUSES}."
            )

        order.order_status = norm_status
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def delete_order(db: Session, order_id: int, current_user: User) -> Dict[str, Any]:
        order = OrderService.get_order_by_id(db, order_id, current_user)

        if not current_user.is_staff and order.get_status_code() != "PENDING":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only orders with status PENDING can be cancelled by customers."
            )

        order_dict = order.to_dict()
        db.delete(order)
        db.commit()
        return order_dict

    @staticmethod
    def get_analytics(db: Session, current_user: User) -> Dict[str, Any]:
        if not current_user.is_staff:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Staff privileges required to access analytics."
            )

        all_orders = db.query(Order).all()
        total_orders = len(all_orders)
        total_revenue = sum(o.total_price or 0.0 for o in all_orders if o.get_status_code() != "CANCELLED")

        return {
            "total_orders": total_orders,
            "total_revenue": round(total_revenue, 2),
            "pending_count": sum(1 for o in all_orders if o.get_status_code() == "PENDING"),
            "transit_count": sum(1 for o in all_orders if o.get_status_code() == "IN-TRANSIT"),
            "delivered_count": sum(1 for o in all_orders if o.get_status_code() == "DELIVERED"),
            "cancelled_count": sum(1 for o in all_orders if o.get_status_code() == "CANCELLED"),
        }

