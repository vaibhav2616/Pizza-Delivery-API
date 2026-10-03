"""
Root auth_routes module - re-exports from app.api.v1.auth for backward compatibility.
"""
from app.api.v1.auth import (
    auth_router,
    hello,
    signup,
    login,
    refresh_token,
    get_current_user_profile
)
