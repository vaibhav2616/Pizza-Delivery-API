from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi.exceptions import HTTPException
from fastapi import status

from app.models.order import Order
from app.models.user import User, Address, WalletTransaction
from app.models.menu import PizzaMenu
from app.schemas.order import OrderModel, OrderUpdateModel, OrderStatusModel
from app.services.menu_service import MenuService
from app.core.config import settings

SIZE_MULTIPLIERS = {
    "SMALL": 0.85,
    "MEDIUM": 1.0,
    "LARGE": 1.35,
    "EXTRA-LARGE": 1.65
}

FALLBACK_SIZE_PRICES = {
    "SMALL": 249.00,
    "MEDIUM": 349.00,
    "LARGE": 499.00,
    "EXTRA-LARGE": 649.00
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
            unit_price = FALLBACK_SIZE_PRICES.get(norm_size, 349.00)

        total_price = round(unit_price * max(1, quantity), 2)
        return unit_price, total_price

    @staticmethod
    def create_order(db: Session, user: User, order_data: OrderModel) -> Order:
        norm_size = (order_data.pizza_size or "SMALL").upper()
        if norm_size not in SIZE_MULTIPLIERS:
            norm_size = "SMALL"

        pizza_name = (order_data.pizza_name or "Margherita Speciale").strip()
        quantity = max(1, order_data.quantity)

        unit_price, subtotal = OrderService.calculate_price(pizza_name, norm_size, quantity, db)

        # Apply Coupon Discount if provided
        discount_amount = 0.0
        applied_coupon_code = None
        if order_data.coupon_code:
            try:
                coupon, discount = MenuService.validate_coupon(db, order_data.coupon_code, subtotal)
                discount_amount = discount
                applied_coupon_code = coupon.code
            except HTTPException:
                pass # Silently proceed without discount if invalid

        discounted_subtotal = max(0.0, subtotal - discount_amount)

        # Delivery Fee calculation (₹)
        order_type = (order_data.order_type or "DELIVERY").upper()
        if order_type == "TAKEAWAY" or discounted_subtotal >= settings.free_delivery_threshold:
            delivery_fee = 0.0
        else:
            delivery_fee = settings.standard_delivery_fee

        # 5% Restaurant GST
        tax_amount = round(discounted_subtotal * settings.tax_rate, 2)

        # Total Price in ₹ INR
        final_total = round(discounted_subtotal + delivery_fee + tax_amount, 2)

        # Determine delivery address from address_id or customer_address
        resolved_address = order_data.customer_address or "Counter Pickup / Dine-in"
        if order_data.address_id:
            addr = db.query(Address).filter(Address.id == order_data.address_id, Address.user_id == user.id).first()
            if addr:
                resolved_address = f"[{addr.label}] {addr.receiver_name} ({addr.receiver_phone}): {addr.street_address}, {addr.landmark}, {addr.city} - {addr.pincode}"

        # Handle Payment Method
        payment_method = (order_data.payment_method or "WALLET").upper()
        payment_status = "PENDING"

        if payment_method == "WALLET":
            if (user.wallet_balance or 0.0) < final_total:
                deficit = final_total - (user.wallet_balance or 0.0)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient SliceWallet balance (₹{user.wallet_balance:.2f}). You need ₹{deficit:.2f} more. Please top up or choose Cash on Delivery / UPI."
                )
            
            # Deduct from user wallet
            user.wallet_balance = round(user.wallet_balance - final_total, 2)
            payment_status = "PAID"

            debit_tx = WalletTransaction(
                user_id=user.id,
                amount=-final_total,
                transaction_type="DEBIT",
                description=f"Paid for Order: {pizza_name} ({norm_size})",
                balance_after=user.wallet_balance
            )
            db.add(debit_tx)
        elif payment_method in ("UPI", "CARD"):
            payment_status = "PAID" # Simulated instant gateway approval
        else:
            payment_status = "PENDING" # COD

        new_order = Order(
            pizza_name=pizza_name,
            pizza_size=norm_size,
            quantity=quantity,
            order_status="PENDING",
            unit_price=unit_price,
            subtotal=subtotal,
            coupon_code=applied_coupon_code,
            discount_amount=discount_amount,
            delivery_fee=delivery_fee,
            tax_amount=tax_amount,
            total_price=final_total,
            order_type=order_type,
            customer_address=resolved_address.strip(),
            customer_phone=(order_data.customer_phone or user.phone or "N/A").strip(),
            payment_method=payment_method,
            payment_status=payment_status,
            delivery_partner_name="Ramesh Kumar (Speedy Courier)",
            delivery_partner_phone="+91 98765 43210",
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

        # Recalculate price in ₹
        unit_price, subtotal = OrderService.calculate_price(
            order.pizza_name,
            order.get_size_code(),
            order.quantity,
            db
        )
        order.unit_price = unit_price
        order.subtotal = subtotal
        discounted = max(0.0, subtotal - (order.discount_amount or 0.0))
        order.tax_amount = round(discounted * settings.tax_rate, 2)
        order.total_price = round(discounted + (order.delivery_fee or 0.0) + order.tax_amount, 2)

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

        prev_status = order.order_status
        order.order_status = norm_status

        # If transitioning to DELIVERED for the first time, award 5% cashback to customer!
        if norm_status == "DELIVERED" and prev_status != "DELIVERED":
            order.payment_status = "PAID"
            cashback = round(order.total_price * settings.order_cashback_rate, 2)
            if cashback > 0 and order.user:
                order.user.wallet_balance = round((order.user.wallet_balance or 0.0) + cashback, 2)
                cb_tx = WalletTransaction(
                    user_id=order.user_id,
                    amount=cashback,
                    transaction_type="CASHBACK",
                    description=f"5% Cashback for Order #{order.id} delivered hot!",
                    balance_after=order.user.wallet_balance
                )
                db.add(cb_tx)

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

        # If user paid with WALLET, refund the amount back to their SliceWallet!
        if order.payment_method == "WALLET" and order.payment_status == "PAID" and order.user:
            refund_amount = order.total_price
            order.user.wallet_balance = round((order.user.wallet_balance or 0.0) + refund_amount, 2)
            refund_tx = WalletTransaction(
                user_id=order.user_id,
                amount=refund_amount,
                transaction_type="REFUND",
                description=f"Refund for cancelled Order #{order.id}",
                balance_after=order.user.wallet_balance
            )
            db.add(refund_tx)

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
