"""
Root database module - re-exports from app.core.database for backward compatibility.
"""
from app.core.database import engine, Base, SessionLocal, get_db

# Legacy alias for backward compatibility
session = SessionLocal
