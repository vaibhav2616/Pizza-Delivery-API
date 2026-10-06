from typing import List
from sqlalchemy.orm import Session
from fastapi.exceptions import HTTPException
from fastapi import status
from app.models.user import User, Address, WalletTransaction
from app.schemas.auth import SignUpModel, LoginModel, UserProfileUpdateModel, AddressCreateSchema
from app.core.security import hash_password, verify_password
from app.core.config import settings

class AuthService:
    @staticmethod
    def register_user(db: Session, user: SignUpModel) -> User:
        clean_username = user.username.strip()
        clean_email = user.email.strip().lower()

        # Check duplicate email
        if db.query(User).filter(User.email == clean_email).first() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists."
            )

        # Check duplicate username
        if db.query(User).filter(User.username == clean_username).first() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this username already exists."
            )

        # Welcome bonus in ₹ INR
        welcome_bonus = settings.welcome_wallet_bonus

        new_user = User(
            username=clean_username,
            email=clean_email,
            password=hash_password(user.password),
            phone=(user.phone or "").strip(),
            wallet_balance=welcome_bonus,
            is_active=True if user.is_active is None else user.is_active,
            is_staff=False if user.is_staff is None else user.is_staff
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Create initial wallet credit transaction
        init_tx = WalletTransaction(
            user_id=new_user.id,
            amount=welcome_bonus,
            transaction_type="WELCOME_BONUS",
            description=f"Welcome to SliceCraft! ₹{welcome_bonus} added to your SliceWallet.",
            balance_after=welcome_bonus
        )
        db.add(init_tx)
        db.commit()

        return new_user

    @staticmethod
    def authenticate_user(db: Session, login_data: LoginModel) -> User:
        clean_username = login_data.username.strip()
        user = db.query(User).filter(User.username == clean_username).first()

        if not user or not verify_password(login_data.password, user.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid username or password."
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated. Please contact support."
            )

        return user

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> User:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User '{username}' was not found."
            )
        return user

    @staticmethod
    def update_profile(db: Session, user: User, update_data: UserProfileUpdateModel) -> User:
        if update_data.email:
            existing = db.query(User).filter(User.email == update_data.email.strip().lower(), User.id != user.id).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This email address is already registered to another account."
                )
            user.email = update_data.email.strip().lower()

        if update_data.phone is not None:
            user.phone = update_data.phone.strip()

        if update_data.default_address is not None:
            user.default_address = update_data.default_address.strip()

        db.commit()
        db.refresh(user)
        return user

    # ==========================================================================
    # Address Book Management
    # ==========================================================================
    @staticmethod
    def get_user_addresses(db: Session, user_id: int) -> List[Address]:
        return db.query(Address).filter(Address.user_id == user_id).order_by(Address.is_default.desc()).all()

    @staticmethod
    def add_address(db: Session, user: User, data: AddressCreateSchema) -> Address:
        # If this is the first address or marked default, unset existing defaults
        existing_count = db.query(Address).filter(Address.user_id == user.id).count()
        make_default = data.is_default or (existing_count == 0)

        if make_default:
            db.query(Address).filter(Address.user_id == user.id).update({"is_default": False})

        new_addr = Address(
            user_id=user.id,
            label=(data.label or "Home").strip(),
            receiver_name=data.receiver_name.strip(),
            receiver_phone=data.receiver_phone.strip(),
            street_address=data.street_address.strip(),
            landmark=(data.landmark or "").strip(),
            city=(data.city or "Bengaluru").strip(),
            pincode=data.pincode.strip(),
            is_default=make_default
        )
        db.add(new_addr)

        # Also sync default address onto user profile
        if make_default:
            user.default_address = f"{new_addr.street_address}, {new_addr.city} - {new_addr.pincode}"

        db.commit()
        db.refresh(new_addr)
        return new_addr

    @staticmethod
    def set_default_address(db: Session, user: User, address_id: int) -> Address:
        addr = db.query(Address).filter(Address.id == address_id, Address.user_id == user.id).first()
        if not addr:
            raise HTTPException(status_code=404, detail="Address not found in your address book.")

        db.query(Address).filter(Address.user_id == user.id).update({"is_default": False})
        addr.is_default = True
        user.default_address = f"{addr.street_address}, {addr.city} - {addr.pincode}"

        db.commit()
        db.refresh(addr)
        return addr

    @staticmethod
    def delete_address(db: Session, user: User, address_id: int) -> bool:
        addr = db.query(Address).filter(Address.id == address_id, Address.user_id == user.id).first()
        if not addr:
            raise HTTPException(status_code=404, detail="Address not found.")

        db.delete(addr)
        db.commit()
        return True

    # ==========================================================================
    # SliceWallet Management
    # ==========================================================================
    @staticmethod
    def get_wallet_info(db: Session, user: User) -> dict:
        txs = db.query(WalletTransaction).filter(WalletTransaction.user_id == user.id).order_by(WalletTransaction.created_at.desc()).limit(20).all()
        return {
            "wallet_balance": round(float(user.wallet_balance or 0.0), 2),
            "currency": settings.currency_symbol,
            "transactions": [t.to_dict() for t in txs]
        }

    @staticmethod
    def add_wallet_funds(db: Session, user: User, amount: float) -> dict:
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Top-up amount must be greater than ₹0.")

        user.wallet_balance = round(float(user.wallet_balance or 0.0) + amount, 2)
        tx = WalletTransaction(
            user_id=user.id,
            amount=amount,
            transaction_type="TOPUP",
            description=f"SliceWallet Quick Top-Up of ₹{amount:.2f}",
            balance_after=user.wallet_balance
        )
        db.add(tx)
        db.commit()
        db.refresh(user)

        return {
            "success": True,
            "message": f"Added ₹{amount:.2f} to your SliceWallet successfully!",
            "wallet_balance": user.wallet_balance
        }
