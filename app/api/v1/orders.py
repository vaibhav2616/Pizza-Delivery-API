from typing import Optional, List
from fastapi import APIRouter, Depends, status, Query
from fastapi.exceptions import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from fastapi_jwt_auth import AuthJWT

from app.core.database import get_db
from app.models.user import User
from app.schemas.order import OrderModel, OrderStatusModel, OrderResponseModel
from app.services.order_service import OrderService
from app.services.menu_service import MenuService
from app.api.deps import get_current_user, get_current_staff

order_router = APIRouter(
    prefix="/orders",
    tags=["Orders & Kitchen Dispatch"]
)

@order_router.get("/", summary="Orders Service Health Check")
def hello(Authorize: AuthJWT = Depends()):
    """
    ## Protected Orders Ping Endpoint
    """
    try:
        Authorize.jwt_required()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing access token"
        )
    return {"message": "Pizza Orders Service is online and operational."}


@order_router.get("/menu", summary="Get Pizza Menu Catalog")
@order_router.get("/menu/", include_in_schema=False)
def get_menu(
    category: Optional[str] = Query(None, description="Optional category filter: Classic, Meat, Vegetarian, Specialty"),
    db: Session = Depends(get_db)
):
    """
    ## Retrieve Handcrafted Pizza Menu
    Publicly accessible endpoint for customers and visitors.
    """
    menu_items = MenuService.get_available_menu(db, category)
    return jsonable_encoder([item.to_dict() for item in menu_items])


@order_router.post("/order", status_code=status.HTTP_201_CREATED, summary="Place a New Pizza Order")
@order_router.post("/order/", status_code=status.HTTP_201_CREATED, include_in_schema=False)
def place_an_order(
    order: OrderModel,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    ## Place a New Artisanal Pizza Order
    - **pizza_name**: Name of artisanal pizza
    - **pizza_size**: SMALL, MEDIUM, LARGE, or EXTRA-LARGE
    - **quantity**: Minimum 1
    - **customer_address**: Delivery address
    - **customer_phone**: Delivery phone contact
    - **notes**: Custom instructions or toppings
    """
    created_order = OrderService.create_order(db, current_user, order)
    return jsonable_encoder({
        "success": True,
        "message": "Order placed successfully! The stone oven is fired up.",
        "order": created_order.to_dict()
    })


@order_router.get("/orders", summary="List All Orders (Staff Only)")
@order_router.get("/orders/", include_in_schema=False)
def list_all_orders(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: PENDING, IN-TRANSIT, DELIVERED, CANCELLED"),
    search: Optional[str] = Query(None, description="Search by pizza name, address, or phone"),
    current_staff: User = Depends(get_current_staff),
    db: Session = Depends(get_db)
):
    """
    ## List All Customer Orders
    Restricted to **Staff / Superusers**. Supports real-time filtering and search.
    """
    if not current_staff.is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff privileges required to view all orders."
        )
    orders = OrderService.list_orders(db, status_filter=status_filter, search=search)
    return jsonable_encoder([order.to_dict() for order in orders])


@order_router.get("/stats", summary="Get Orders Analytics & Metrics (Staff Only)")
@order_router.get("/stats/", include_in_schema=False)
def get_order_stats(
    current_staff: User = Depends(get_current_staff),
    db: Session = Depends(get_db)
):
    """
    ## Real-Time Kitchen KPIs & Financial Metrics
    Aggregated order volume, revenue, and queue breakdown.
    """
    if not current_staff.is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff privileges required to access analytics."
        )
    stats = OrderService.get_analytics(db, current_staff)
    return jsonable_encoder(stats)


@order_router.get("/orders/{id}", summary="Get Any Order By ID (Staff/Owner)")
@order_router.get("/orders/{id}/", include_in_schema=False)
def get_order_by_id(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    ## Retrieve an Order by ID
    Accessible by Staff or by the user who placed the order.
    """
    order = OrderService.get_order_by_id(db, id, current_user)
    return jsonable_encoder(order.to_dict())


@order_router.get("/user/orders", summary="Get Current User's Orders")
@order_router.get("/user/orders/", include_in_schema=False)
def get_user_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    ## Get Order History for Authenticated User
    Returns all orders placed by the current user, sorted newest first.
    """
    orders = OrderService.get_user_orders(db, current_user.id)
    return jsonable_encoder([o.to_dict() for o in orders])


@order_router.get("/user/order/{id}", summary="Get Current User's Specific Order")
@order_router.get("/user/order/{id}/", include_in_schema=False)
def get_specific_order(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    ## Retrieve a Specific Order Belonging to Current User
    """
    order = OrderService.get_order_by_id(db, id, current_user)
    return jsonable_encoder(order.to_dict())


@order_router.put("/order/update/{id}", summary="Update an Order's Details")
@order_router.put("/order/update/{id}/", include_in_schema=False)
def update_order(
    id: int,
    order: OrderModel,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    ## Update an Order
    Allows customers to update details while order is still PENDING.
    """
    updated_order = OrderService.update_order(db, id, order, current_user)
    return jsonable_encoder({
        "success": True,
        "message": f"Order #{id} updated successfully.",
        "order": updated_order.to_dict()
    })


@order_router.put("/order/status/{id}", summary="Update Order Status (Staff Only)")
@order_router.put("/order/status/{id}/", include_in_schema=False)
@order_router.patch("/order/update/{id}", include_in_schema=False)
@order_router.patch("/order/update/{id}/", include_in_schema=False)
def update_order_status(
    id: int,
    order: OrderStatusModel,
    current_staff: User = Depends(get_current_staff),
    db: Session = Depends(get_db)
):
    """
    ## Transition an Order's Status
    Restricted to **Staff / Kitchen Managers**. Valid statuses:
    `PENDING`, `IN-TRANSIT`, `DELIVERED`, `CANCELLED`
    """
    updated_order = OrderService.update_status(db, id, order.order_status, current_staff)
    return jsonable_encoder({
        "success": True,
        "message": f"Order #{id} status updated to {updated_order.get_status_code()}.",
        "order": updated_order.to_dict()
    })


@order_router.delete("/order/delete/{id}", summary="Cancel or Delete an Order")
@order_router.delete("/order/delete/{id}/", include_in_schema=False)
def delete_an_order(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    ## Delete or Cancel an Order
    Permitted for Staff on any order, or Customers while order is PENDING.
    """
    deleted_info = OrderService.delete_order(db, id, current_user)
    return jsonable_encoder({
        "success": True,
        "message": f"Order #{id} has been removed successfully.",
        "order": deleted_info
    })
