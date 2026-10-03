"""
Root order_routes module - re-exports from app.api.v1.orders for backward compatibility.
"""
from app.api.v1.orders import (
    order_router,
    hello,
    get_menu,
    place_an_order,
    list_all_orders,
    get_order_stats,
    get_order_by_id,
    get_user_orders,
    get_specific_order,
    update_order,
    update_order_status,
    delete_an_order
)
