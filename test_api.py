import unittest
from unittest.mock import MagicMock
from fastapi.exceptions import HTTPException
from fastapi_jwt_auth import AuthJWT

from app.core.database import SessionLocal
from init_db import init_db
from app.models.user import User
from app.models.order import Order
from app.models.menu import PizzaMenu
from app.schemas.auth import SignUpModel, LoginModel
from app.schemas.order import OrderModel, OrderStatusModel
from app.services.auth_service import AuthService
from app.services.order_service import OrderService
from app.services.menu_service import MenuService
from app.api.v1.auth import signup, login, get_current_user_profile
from app.api.v1.orders import (
    get_menu,
    place_an_order,
    list_all_orders,
    get_user_orders,
    get_specific_order,
    update_order,
    update_order_status,
    delete_an_order,
    get_order_stats
)

class TestSliceCraftAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Initialize database and seed demo data
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

    def test_01_menu_retrieval(self):
        result = get_menu(category=None, db=self.db)
        self.assertIsInstance(result, list)
        self.assertGreaterEqual(len(result), 8)
        names = [item["name"] for item in result]
        self.assertIn("Margherita Speciale", names)
        self.assertIn("Fiery Pepperoni Inferno", names)

    def test_02_user_signup(self):
        user_in = SignUpModel(
            username="test_fan_01",
            email="test_fan_01@example.com",
            password="SecurePassword123!",
            is_staff=False,
            is_active=True
        )
        try:
            res = signup(user=user_in, db=self.db)
            self.assertTrue(res.get("success"))
            self.assertEqual(res["user"]["username"], "test_fan_01")
            self.assertNotIn("password", res["user"])
        except HTTPException as e:
            self.assertEqual(e.status_code, 400)

    def test_03_duplicate_signup_rejection(self):
        dup_user = SignUpModel(
            username="johndoe",
            email="brand_new_johndoe@example.com",
            password="Password123!"
        )
        with self.assertRaises(HTTPException) as ctx:
            signup(user=dup_user, db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already exists", ctx.exception.detail.lower())

    def test_04_login_success_and_failure(self):
        auth_mock = self.create_auth_mock("johndoe")

        # Valid login
        login_valid = LoginModel(username="johndoe", password="Password123!")
        res = login(user=login_valid, db=self.db, Authorize=auth_mock)
        self.assertTrue(res.get("success"))
        self.assertIn("access", res)
        self.assertEqual(res["user"]["username"], "johndoe")

        # Invalid login
        login_invalid = LoginModel(username="johndoe", password="WrongPassword!")
        with self.assertRaises(HTTPException) as ctx:
            login(user=login_invalid, db=self.db, Authorize=auth_mock)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_05_place_order_and_price_calculation(self):
        order_in = OrderModel(
            pizza_name="Fiery Pepperoni Inferno",
            pizza_size="LARGE",
            quantity=2,
            customer_address="456 Elm Avenue",
            customer_phone="+1 555-234-5678",
            notes="Extra hot honey on crust"
        )
        res = place_an_order(order=order_in, current_user=self.customer_user, db=self.db)
        self.assertTrue(res.get("success"))
        order_dict = res["order"]
        self.assertEqual(order_dict["pizza_name"], "Fiery Pepperoni Inferno")
        self.assertEqual(order_dict["pizza_size"], "LARGE")
        self.assertEqual(order_dict["quantity"], 2)
        self.assertEqual(order_dict["order_status"], "PENDING")
        self.assertGreater(order_dict["total_price"], 0)
        
        TestSliceCraftAPI.sample_order_id = order_dict["id"]

    def test_06_user_order_history(self):
        orders = get_user_orders(current_user=self.customer_user, db=self.db)
        self.assertIsInstance(orders, list)
        self.assertGreater(len(orders), 0)

    def test_07_staff_order_management(self):
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
        self.assertGreater(stats["total_orders"], 0)

    def test_08_rbac_security_enforcement(self):
        # Customer attempting staff operations via dependency guard
        from app.api.deps import get_current_staff
        with self.assertRaises(HTTPException) as ctx:
            get_current_staff(current_user=self.customer_user)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_09_order_deletion_by_customer(self):
        # First create a new pending order
        order_in = OrderModel(
            pizza_name="Margherita Speciale",
            pizza_size="SMALL",
            quantity=1,
            customer_address="999 Sunset Blvd"
        )
        res = place_an_order(order=order_in, current_user=self.customer_user, db=self.db)
        created_id = res["order"]["id"]

        # Cancel/delete it
        del_res = delete_an_order(id=created_id, current_user=self.customer_user, db=self.db)
        self.assertTrue(del_res.get("success"))

        # Verify it no longer exists
        with self.assertRaises(HTTPException) as ctx:
            get_specific_order(id=created_id, current_user=self.customer_user, db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_10_invalid_status_rejection(self):
        order_id = getattr(TestSliceCraftAPI, "sample_order_id", 1)
        invalid_in = OrderStatusModel(order_status="FLYING_TO_SPACE")
        with self.assertRaises(HTTPException) as ctx:
            update_order_status(id=order_id, order=invalid_in, current_staff=self.admin_user, db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_11_order_modification_constraints(self):
        # An order that is IN-TRANSIT cannot be modified by a customer
        order_id = getattr(TestSliceCraftAPI, "sample_order_id", 1)
        mod_in = OrderModel(quantity=5, pizza_size="LARGE")
        with self.assertRaises(HTTPException) as ctx:
            update_order(id=order_id, order=mod_in, current_user=self.customer_user, db=self.db)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_12_pricing_algorithm_multipliers(self):
        # Margherita Speciale base_price is 13.99
        small_unit, small_total = OrderService.calculate_price("Margherita Speciale", "SMALL", 1, self.db)
        large_unit, large_total = OrderService.calculate_price("Margherita Speciale", "LARGE", 1, self.db)
        self.assertEqual(small_unit, round(13.99 * 0.85, 2))
        self.assertEqual(large_unit, round(13.99 * 1.25, 2))
        self.assertLess(small_unit, large_unit)


if __name__ == "__main__":
    unittest.main()
