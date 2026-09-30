"""
Root configuration shim for backward compatibility.
Exposes settings from app.core.config.
"""
from app.core.config import settings, Settings

__all__ = ["settings", "Settings"]
