import unittest
from unittest.mock import MagicMock
from fastapi.exceptions import HTTPException
from fastapi_jwt_auth import AuthJWT

from app.core.database import SessionLocal
from init_db import init_db
from app.models.user import User, Address
from app.models.order import Order
from app.models.menu import PizzaMenu
from app.schemas.auth import SignUpModel, LoginModel, AddressCreateSchema, WalletTopupSchema
from app.schemas.order import OrderModel, OrderStatusModel, CouponValidateSchema
from app.api.v1.auth import (
    signup,
    login,
    get_current_user_profile,
    get_addresses,
    add_address,
    get_wallet,
    topup_wallet
)
from app.api.v1.orders import (
    get_menu,
    get_coupons,
    validate_coupon,
    place_an_order,
    list_all_orders,
    get_user_orders,
    get_specific_order,
    update_order,
    update_order_status,
    delete_an_order,
    get_order_stats
)
from app.services.order_service import OrderService
from app.services.menu_service import MenuService
from app.services.auth_service import AuthService

class TestSliceCraftAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def setUp(self):
        self.db = SessionLocal()
        self.admin_user = self.db.query(User).filter(User.username == "admin").first()
        self.customer_user = self.db.query(User).filter(User.username == "johndoe").first()

    def tearDown(self):
        self.db.close()

    def create_auth_mock(self, username: str):
        mock_auth = MagicMock(spec=AuthJWT)
        mock_auth.jwt_required.return_value = None
        mock_auth.get_jwt_subject.return_value = username
        mock_auth.create_access_token.return_value = f"mock-access-token-for-{username}"
        mock_auth.create_refresh_token.return_value = f"mock-refresh-token-for-{username}"
        return mock_auth

    def test_01_menu_retrieval_and_rupee_pricing(self):
        result = get_menu(category=None, is_veg=None, search=None, db=self.db)
        self.assertIsInstance(result, list)
        self.assertGreaterEqual(len(result), 8)
        names = [item["name"] for item in result]
        self.assertIn("Margherita Speciale", names)
        self.assertIn("1734 Seafarers' Ancient Marinara", names)
        self.assertIn("Desi Paneer Makhani Burst", names)
        # Verify Rupee prices & mythical attributes
        margherita = next(item for item in result if item["name"] == "Margherita Speciale")
        self.assertEqual(margherita["base_price"], 299.0)
        self.assertTrue(margherita["is_veg"])
        self.assertEqual(margherita["origin_year"], 1889)
        self.assertTrue(len(margherita.get("mythical_lore", "")) > 10)
        self.assertTrue(len(margherita.get("legend_badge", "")) > 0)

    def test_02_veg_filter(self):
        veg_items = get_menu(category=None, is_veg=True, search=None, db=self.db)
        for item in veg_items:
            self.assertTrue(item["is_veg"])

    def test_03_coupons_and_discount_calculation(self):
        coupons = get_coupons(db=self.db)
        self.assertGreaterEqual(len(coupons), 3)
        codes = [c["code"] for c in coupons]
        self.assertIn("FIRSTBITE", codes)
        self.assertIn("SLICE100", codes)

        # Validate FIRSTBITE coupon on ₹600 cart
        val_res = validate_coupon(CouponValidateSchema(code="FIRSTBITE", cart_subtotal=600.0), db=self.db)
        self.assertTrue(val_res["success"])
        self.assertEqual(val_res["discount_amount"], 150.0) # 50% capped at ₹150

    def test_04_user_signup_and_welcome_wallet_bonus(self):
        user_in = SignUpModel(
            username="new_foodie_test",
            email="new_foodie_test@example.com",
            password="SecurePassword123!",
            phone="+91 91234 56789",
            is_staff=False,
            is_active=True
        )
        try:
            res = signup(user=user_in, db=self.db)
            self.assertTrue(res.get("success"))
            self.assertEqual(res["user"]["username"], "new_foodie_test")
            self.assertEqual(res["user"]["wallet_balance"], 500.0) # ₹500 welcome credit
        except HTTPException as e:
            self.assertEqual(e.status_code, 400)

    def test_05_address_book_management(self):
        addr_in = AddressCreateSchema(
            label="Home",
            receiver_name="John Doe",
            receiver_phone="+91 98765 43210",
            street_address="Villa 14, Palm Meadows, Whitefield",
            landmark="Near Forum Mall",
            city="Bengaluru",
            pincode="560066",
            is_default=True
        )
        res = add_address(data=addr_in, current_user=self.customer_user, db=self.db)
        self.assertTrue(res["success"])
        self.assertEqual(res["address"]["label"], "Home")

        addresses = get_addresses(current_user=self.customer_user, db=self.db)
        self.assertGreaterEqual(len(addresses), 1)

    def test_06_login_success_and_failure(self):
        auth_mock = self.create_auth_mock("johndoe")
        login_valid = LoginModel(username="johndoe", password="Password123!")
        res = login(user=login_valid, db=self.db, Authorize=auth_mock)
        self.assertTrue(res.get("success"))
        self.assertIn("access", res)
        self.assertEqual(res["user"]["username"], "johndoe")

        login_invalid = LoginModel(username="johndoe", password="WrongPassword999!")
        with self.assertRaises(HTTPException) as ctx:
            login(user=login_invalid, db=self.db, Authorize=auth_mock)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_07_place_order_with_wallet_payment_and_coupon(self):
        # Give user enough wallet balance
        self.customer_user.wallet_balance = 1000.0
        self.db.commit()

        order_in = OrderModel(
            pizza_name="Margherita Speciale",
            pizza_size="MEDIUM",
            quantity=1,
            coupon_code="FIRSTBITE",
            payment_method="WALLET",
            customer_address="Flat 402, Sunshine Apartments, Indiranagar",
            customer_phone="+91 98765 43210",
            notes="Extra oregano please"
        )
        res = place_an_order(order=order_in, current_user=self.customer_user, db=self.db)
        self.assertTrue(res.get("success"))
        order_dict = res["order"]
        self.assertEqual(order_dict["pizza_name"], "Margherita Speciale")
        self.assertEqual(order_dict["payment_status"], "PAID")
        self.assertGreater(order_dict["discount_amount"], 0)
        self.assertGreater(order_dict["total_price"], 0)
        
        TestSliceCraftAPI.sample_order_id = order_dict["id"]

    def test_08_staff_order_management(self):
        # Staff can list all orders
        all_orders = list_all_orders(status_filter=None, search=None, current_staff=self.admin_user, db=self.db)
        self.assertIsInstance(all_orders, list)
        self.assertGreater(len(all_orders), 0)

        # Staff can update order status
        order_id = getattr(TestSliceCraftAPI, "sample_order_id", 1)
        update_in = OrderStatusModel(order_status="IN-TRANSIT")
        res = update_order_status(id=order_id, order=update_in, current_staff=self.admin_user, db=self.db)
        self.assertTrue(res.get("success"))
        self.assertEqual(res["order"]["order_status"], "IN-TRANSIT")

        # Staff can view dashboard statistics
        stats = get_order_stats(current_staff=self.admin_user, db=self.db)
        self.assertIn("total_orders", stats)
        self.assertIn("total_revenue", stats)

    def test_09_rbac_security_enforcement(self):
        from app.api.deps import get_current_staff
        with self.assertRaises(HTTPException) as ctx:
            get_current_staff(current_user=self.customer_user)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_10_order_deletion_and_wallet_refund(self):
        initial_balance = self.customer_user.wallet_balance
        order_in = OrderModel(
            pizza_name="Margherita Speciale",
            pizza_size="SMALL",
            quantity=1,
            payment_method="WALLET"
        )
        res = place_an_order(order=order_in, current_user=self.customer_user, db=self.db)
        created_id = res["order"]["id"]
        order_cost = res["order"]["total_price"]

        # Cancel/delete while still pending
        del_res = delete_an_order(id=created_id, current_user=self.customer_user, db=self.db)
        self.assertTrue(del_res.get("success"))

        # Verify wallet was refunded!
        self.db.refresh(self.customer_user)
        self.assertAlmostEqual(self.customer_user.wallet_balance, initial_balance, places=1)

    def test_11_order_modification_constraints(self):
        order_id = getattr(TestSliceCraftAPI, "sample_order_id", 1)
        mod_in = OrderModel(quantity=5, pizza_size="LARGE")
        with self.assertRaises(HTTPException) as ctx:
            update_order(id=order_id, order=mod_in, current_user=self.customer_user, db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_12_pricing_algorithm_multipliers_in_rupees(self):
        # Margherita Speciale base_price is ₹299
        small_unit, _ = OrderService.calculate_price("Margherita Speciale", "SMALL", 1, self.db)
        large_unit, _ = OrderService.calculate_price("Margherita Speciale", "LARGE", 1, self.db)
        self.assertEqual(small_unit, round(299.0 * 0.85, 2)) # ₹254.15
        self.assertEqual(large_unit, round(299.0 * 1.35, 2)) # ₹403.65
        self.assertLess(small_unit, large_unit)

    def test_13_static_routes_and_kitchen_portal(self):
        from main import serve_ui, serve_kitchen
        ui_res = serve_ui()
        kitchen_res = serve_kitchen()
        # Verify both return valid file responses
        self.assertTrue(hasattr(ui_res, "path"))
        self.assertTrue(ui_res.path.endswith("index.html"))
        self.assertTrue(hasattr(kitchen_res, "path"))
        self.assertTrue(kitchen_res.path.endswith("kitchen.html"))

if __name__ == "__main__":
    unittest.main()
