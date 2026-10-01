from werkzeug.security import generate_password_hash, check_password_hash
from fastapi_jwt_auth import AuthJWT

def hash_password(password: str) -> str:
    """Hashes plain password using secure salted PBKDF2:SHA256."""
    return generate_password_hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Safely verifies a password against its hash with constant-time comparison."""
    if not plain_password or not hashed_password:
        return False
    return check_password_hash(hashed_password, plain_password)

