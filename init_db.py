import logging
from app.core.database import engine, Base, SessionLocal
from app.models.user import User
from app.models.order import Order
from app.models.menu import PizzaMenu
from app.core.security import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("slicecraft.init_db")

INITIAL_PIZZAS = [
    {
        "name": "Margherita Speciale",
        "description": "San Marzano plum tomato marinara, imported Fior di Latte mozzarella, fresh sweet basil, and extra virgin cold-pressed olive oil.",
        "category": "Classic",
        "base_price": 13.99,
        "badge": "Bestseller",
        "image_url": "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80",
        "ingredients": "San Marzano Tomatoes, Buffalo Mozzarella, Fresh Basil, EVOO, Sea Salt"
    },
    {
        "name": "Fiery Pepperoni Inferno",
        "description": "Artisan double pepperoni crispy cups, spicy chili hot-honey drizzle, crushed Calabrian peppers, and creamy mozzarella.",
        "category": "Meat",
        "base_price": 17.99,
        "badge": "Spicy 🔥",
        "image_url": "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=80",
        "ingredients": "Double Pepperoni, Hot Honey, Mozzarella, Chili Flakes, Marinara"
    },
    {
        "name": "Truffle Wild Mushroom",
        "description": "Slow-roasted cremini, chanterelle, and shiitake forest mushrooms, aromatic white garlic truffle emulsion, and aged Parmesan.",
        "category": "Specialty",
        "base_price": 18.49,
        "badge": "Chef Choice",
        "image_url": "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80",
        "ingredients": "Truffle Cream, Wild Mushrooms, Fontina, Fresh Thyme, Garlic"
    },
    {
        "name": "Smoky BBQ Pulled Chicken",
        "description": "Hickory wood-smoked pulled chicken breast, charred red onion slivers, tangy house barbecue sauce glaze, and sharp cheddar blend.",
        "category": "Meat",
        "base_price": 16.99,
        "badge": "Popular",
        "image_url": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80",
        "ingredients": "BBQ Chicken, Red Onions, Cheddar, Cilantro, Smoked Gouda"
    },
    {
        "name": "Quattro Formaggi Supreme",
        "description": "Four-cheese harmony with aged Gorgonzola dolce, creamy ricotta, fresh mozzarella, and 24-month Parmigiano-Reggiano.",
        "category": "Classic",
        "base_price": 15.99,
        "badge": "Vegetarian 🌿",
        "image_url": "https://images.unsplash.com/photo-1573821663912-569905455b1c?auto=format&fit=crop&w=600&q=80",
        "ingredients": "Gorgonzola, Ricotta, Mozzarella, Parmigiano-Reggiano, Cracked Black Pepper"
    },
    {
        "name": "Mediterranean Garden Harvest",
        "description": "Wood-fire roasted sweet bell peppers, marinated artichoke hearts, Kalamata olives, crumbled feta cheese, and peppery wild baby arugula.",
        "category": "Vegetarian",
        "base_price": 14.99,
        "badge": "Healthy Choice",
        "image_url": "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=600&q=80",
        "ingredients": "Artichokes, Kalamata Olives, Feta Cheese, Bell Peppers, Arugula"
    },
    {
        "name": "The Butcher's Carnivore Feast",
        "description": "Savory Italian fennel sausage, spiced ground beef meatballs, crispy smoked bacon, and pepperoni loaded on rich herb tomato sauce.",
        "category": "Meat",
        "base_price": 19.99,
        "badge": "Meat Lovers",
        "image_url": "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=600&q=80",
        "ingredients": "Italian Sausage, Smoked Bacon, Meatballs, Pepperoni, Marinara"
    },
    {
        "name": "Spicy Peri-Peri Paneer",
        "description": "Flame-seared cottage cheese cubes, roasted sweet corn, diced red onions, and hot African bird's eye chili garlic sauce.",
        "category": "Vegetarian",
        "base_price": 15.49,
        "badge": "Spicy 🔥",
        "image_url": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80",
        "ingredients": "Paneer, Peri-Peri Sauce, Sweet Corn, Bell Peppers, Mozzarella"
    }
]

def init_db():
    logger.info("Verifying database schema...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Seed Admin / Staff Account
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                email="admin@slicecraft.com",
                password=hash_password("Admin@123"),
                phone="+1 (555) 901-2345",
                default_address="Kitchen Command Center, 1 Main St",
                is_staff=True,
                is_active=True
            )
            db.add(admin)
            logger.info("Created Default Superuser/Staff: admin / Admin@123")

        # Seed Customer Account
        customer = db.query(User).filter(User.username == "johndoe").first()
        if not customer:
            customer = User(
                username="johndoe",
                email="johndoe@gmail.com",
                password=hash_password("Password123!"),
                phone="+1 (555) 019-2834",
                default_address="742 Evergreen Terrace, Springfield",
                is_staff=False,
                is_active=True
            )
            db.add(customer)
            logger.info("Created Default Customer: johndoe / Password123!")

        db.commit()

        # Seed Pizza Menu Catalog
        for pizza_data in INITIAL_PIZZAS:
            existing_pizza = db.query(PizzaMenu).filter(PizzaMenu.name == pizza_data["name"]).first()
            if not existing_pizza:
                new_pizza = PizzaMenu(**pizza_data)
                db.add(new_pizza)
                logger.info(f"Seeded Pizza Menu item: {pizza_data['name']}")

        db.commit()

        # Seed Initial Sample Orders for live dashboard demonstration
        sample_orders_count = db.query(Order).count()
        if sample_orders_count == 0 and customer:
            orders = [
                Order(
                    pizza_name="Fiery Pepperoni Inferno",
                    pizza_size="LARGE",
                    quantity=1,
                    unit_price=22.49,
                    total_price=22.49,
                    order_status="IN-TRANSIT",
                    customer_address="742 Evergreen Terrace, Springfield",
                    customer_phone="+1 (555) 019-2834",
                    notes="Ring doorbell, hot honey on side",
                    user_id=customer.id
                ),
                Order(
                    pizza_name="Margherita Speciale",
                    pizza_size="MEDIUM",
                    quantity=2,
                    unit_price=13.99,
                    total_price=27.98,
                    order_status="DELIVERED",
                    customer_address="742 Evergreen Terrace, Springfield",
                    customer_phone="+1 (555) 019-2834",
                    notes="Extra crispy crust, well done",
                    user_id=customer.id
                )
            ]
            db.add_all(orders)
            db.commit()
            logger.info("Seeded sample orders for live dashboard demonstration.")

        logger.info("Database initialization and verification completed successfully!")
    except Exception as e:
        logger.error(f"Error during database initialization: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
