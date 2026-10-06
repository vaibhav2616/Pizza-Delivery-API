import logging
from sqlalchemy import text
from app.core.database import engine, Base, SessionLocal
from app.models.user import User, Address, WalletTransaction
from app.models.order import Order
from app.models.menu import PizzaMenu
from app.models.coupon import Coupon
from app.core.security import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vesuvio.init_db")

INITIAL_PIZZAS = [
    {
        "name": "Margherita Speciale",
        "description": "San Marzano plum tomato marinara, imported Fior di Latte mozzarella, fresh sweet basil, and extra virgin cold-pressed olive oil.",
        "category": "Classic",
        "base_price": 299.0,
        "badge": "Bestseller ⭐",
        "image_url": "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=700&q=80",
        "ingredients": "San Marzano Tomatoes, Fior di Latte Mozzarella, Fresh Basil, EVOO, Sea Salt",
        "is_veg": True,
        "rating": 4.9,
        "preparation_time": 18,
        "origin_year": 1889,
        "era": "Royal Naples (1889)",
        "legend_badge": "👑 Royal Decree of Savoy",
        "mythical_lore": "Forged in the legendary summer of 1889 by pizzaiolo Raffaele Esposito to honor Queen Margherita of Savoy. Crafted with the sacred Italian tricolor—San Marzano volcanic marinara, milk-white fior di latte mozzarella, and fragrant Genovese basil. Ancient scrolls say this pie unified an empire through the art of the hearth.",
        "flavor_notes": "Volcanic Umami, Creamy Mozzarella, Aromatic Sweet Basil"
    },
    {
        "name": "1734 Seafarers' Ancient Marinara",
        "description": "The oldest recorded pizza of antiquity. Slow-simmered volcanic plum tomatoes, wild Amalfi oregano, purple roasted garlic, and Sicilian olive oil.",
        "category": "Classic",
        "base_price": 289.0,
        "badge": "Ancient Antiquity ⚓",
        "image_url": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=700&q=80",
        "ingredients": "San Marzano Marinara, Wild Oregano, Purple Garlic, Extra Virgin Olive Oil, Sea Salt",
        "is_veg": True,
        "rating": 4.9,
        "preparation_time": 16,
        "origin_year": 1734,
        "era": "Port of Naples Antiquity (1734)",
        "legend_badge": "⚓ Oldest Recorded Pie",
        "mythical_lore": "Before cheese crowned the dough, Mediterranean sailors (Marinai) survived rough seas sustained by this ancient flatbread. Stored in port ovens, baked on searing volcanic basalt, and topped with mountain herbs that kept seafarers hale across treacherous maritime journeys.",
        "flavor_notes": "Sun-Dried Wild Oregano, Sweet Roasted Garlic, Rich Volcanic Crushed Tomatoes"
    },
    {
        "name": "Fiery Pepperoni Inferno",
        "description": "Artisan smoked chicken pepperoni crispy cups, spicy chili hot-honey drizzle, crushed Calabrian peppers, and creamy mozzarella.",
        "category": "Meat",
        "base_price": 449.0,
        "badge": "Spicy 🔥",
        "image_url": "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=700&q=80",
        "ingredients": "Smoked Chicken Pepperoni, Hot Honey, Mozzarella, Chili Flakes, Marinara",
        "is_veg": False,
        "rating": 4.9,
        "preparation_time": 20,
        "origin_year": 1905,
        "era": "Volcanic Caldera Revival",
        "legend_badge": "🌋 Vesuvius Magma",
        "mythical_lore": "Legend speaks of volcanic ovens dug beneath the ash of Mount Vesuvius where embers burned white-hot. Smoked chicken pepperoni cups crisp into miniature bowls that pool with bubbling nectar, finished with a sacred wild hot-honey elixir that ignites the palate.",
        "flavor_notes": "Charred Beechwood Embers, Fiery Chili Nectar, Crispy Smoked Cups"
    },
    {
        "name": "Desi Paneer Makhani Burst",
        "description": "Tandoor charcoal-roasted cottage cheese cubes, rich buttery tomato makhani sauce, crisp capsicum, charred red onion slivers, and aromatic kasuri methi.",
        "category": "Vegetarian",
        "base_price": 379.0,
        "badge": "Desi Fusion 🇮🇳",
        "image_url": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=700&q=80",
        "ingredients": "Spiced Paneer, Makhani Gravy, Bell Peppers, Onions, Mozzarella, Kasuri Methi",
        "is_veg": True,
        "rating": 4.8,
        "preparation_time": 22,
        "origin_year": 1950,
        "era": "Mughlai Silk Route Heritage",
        "legend_badge": "🇮🇳 Royal Tandoor Heritage",
        "mythical_lore": "A legendary cross-continental union between the Neapolitan wood-fired stone oven and the fiery clay tandoors of Old Delhi. Paneer smoked over tamarind coals bathed in cashew silk gravy, kissed by sacred sun-dried fenugreek.",
        "flavor_notes": "Charcoal Tandoor Smoke, Velvety Cashew Butter, Crushed Fenugreek"
    },
    {
        "name": "Truffle Wild Forest Mushroom",
        "description": "Slow-roasted cremini, chanterelle, and shiitake forest mushrooms, aromatic white garlic truffle emulsion, and aged 24-month Parmesan.",
        "category": "Specialty",
        "base_price": 429.0,
        "badge": "Chef Choice 👨‍🍳",
        "image_url": "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=700&q=80",
        "ingredients": "Truffle Cream, Wild Mushrooms, Fontina, Fresh Thyme, Garlic",
        "is_veg": True,
        "rating": 4.9,
        "preparation_time": 25,
        "origin_year": 1533,
        "era": "Florentine Renaissance",
        "legend_badge": "⚜️ Medici Banquet Relic",
        "mythical_lore": "Recorded in the hand-illuminated banqueting codices of Caterina de' Medici in 1533. Foraged under damp autumn moons in the oak forests of Umbria, black truffles meet aged mountain fontina on a slow-fermented cloud of sourdough.",
        "flavor_notes": "Damp Oak Forest Truffle, Roasted Chanterelles, Golden Butter Melt"
    },
    {
        "name": "Smoky BBQ Pulled Chicken",
        "description": "Hickory wood-smoked pulled chicken breast, charred red onion slivers, tangy house barbecue glaze, and sharp cheddar blend.",
        "category": "Meat",
        "base_price": 419.0,
        "badge": "Popular",
        "image_url": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=700&q=80",
        "ingredients": "BBQ Chicken, Red Onions, Cheddar, Cilantro, Smoked Gouda",
        "is_veg": False,
        "rating": 4.7,
        "preparation_time": 20,
        "origin_year": 1965,
        "era": "Hickory Hearth Era",
        "legend_badge": "🪵 Hickory Hearth",
        "mythical_lore": "Slow-smoked for 14 hours over aged hickory wood logs. The caramelized poultry fibers pull effortlessly under molten cheese, singing with tangy molasses and apple cider vinegar reduction.",
        "flavor_notes": "Caramelized Hickory Smoke, Sharp Aged Cheddar, Tangy Molasses"
    },
    {
        "name": "Quattro Formaggi Supreme",
        "description": "Four-cheese Italian harmony with aged Gorgonzola dolce, creamy whole-milk ricotta, fresh mozzarella, and 24-month Parmigiano-Reggiano.",
        "category": "Classic",
        "base_price": 399.0,
        "badge": "Cheese Burst 🧀",
        "image_url": "https://images.unsplash.com/photo-1573821663912-569905455b1c?auto=format&fit=crop&w=700&q=80",
        "ingredients": "Gorgonzola, Ricotta, Mozzarella, Parmigiano-Reggiano, Cracked Black Pepper",
        "is_veg": True,
        "rating": 4.8,
        "preparation_time": 18,
        "origin_year": 1800,
        "era": "Alpine Artisan Guild",
        "legend_badge": "🧀 Four Sacred Cheeses",
        "mythical_lore": "The legendary four-fold covenant of northern Italian master cheesemakers. Cave-aged blue Gorgonzola yields to sweet curd ricotta, spun mozzarella, and crystalline aged Parmigiano in a molten caldera of golden dairy perfection.",
        "flavor_notes": "Blue-Veined Pungency, Sweet Whipped Curd, Umami Parmesan Crystals"
    },
    {
        "name": "Mediterranean Garden Harvest",
        "description": "Wood-fire roasted sweet bell peppers, marinated artichoke hearts, Kalamata olives, crumbled feta cheese, and peppery wild baby arugula.",
        "category": "Vegetarian",
        "base_price": 349.0,
        "badge": "Healthy Choice 🌿",
        "image_url": "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=700&q=80",
        "ingredients": "Artichokes, Kalamata Olives, Feta Cheese, Bell Peppers, Arugula",
        "is_veg": True,
        "rating": 4.6,
        "preparation_time": 19,
        "origin_year": 1600,
        "era": "Aegean Sun Era",
        "legend_badge": "🌿 Sun-Drenched Harvest",
        "mythical_lore": "Honoring Demeter, goddess of the harvest. Wild artichokes steeped in herb vinegar, sun-blackened olives, and sheep-milk feta baked upon crisp stone to capture the essence of a Mediterranean coastal orchard.",
        "flavor_notes": "Briny Kalamata Olives, Tangy Salted Feta, Peppery Wild Greens"
    },
    {
        "name": "The Butcher's Carnivore Feast",
        "description": "Savory smoked chicken pepperoni, seasoned herb chicken sausage, grilled chicken tikka slivers, and smoked chicken ham loaded on rich herb tomato sauce.",
        "category": "Meat",
        "base_price": 549.0,
        "badge": "Meat Lovers 🍗",
        "image_url": "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=700&q=80",
        "ingredients": "Chicken Pepperoni, Chicken Sausage, Chicken Tikka, Smoked Chicken Ham, Marinara",
        "is_veg": False,
        "rating": 4.9,
        "preparation_time": 24,
        "origin_year": 1920,
        "era": "Gladiator's Feast",
        "legend_badge": "⚔️ Feast of Champions",
        "mythical_lore": "A feast built for ancient champions celebrating great triumph. Generously layered with artisanal spiced chicken sausage, seasoned poultry ribbons, crispy chicken pepperoni, and dark crimson marinara.",
        "flavor_notes": "Aromatic Wild Fennel, Sizzling Smoked Chicken, Robust Herb Marinara"
    },
    {
        "name": "Artisanal Cheesy Garlic Breadsticks",
        "description": "Freshly baked sourdough breadsticks brushed with roasted garlic butter, oregano, and loaded with molten stretch mozzarella.",
        "category": "Sides & Beverages",
        "base_price": 189.0,
        "badge": "Must Try 🔥",
        "image_url": "https://images.unsplash.com/photo-1619895092538-128341789043?auto=format&fit=crop&w=700&q=80",
        "ingredients": "Sourdough, Herb Garlic Butter, Mozzarella, Oregano, Cheesy Dip",
        "is_veg": True,
        "rating": 4.9,
        "preparation_time": 15,
        "origin_year": 1780,
        "era": "Guild of Neapolitan Bakers",
        "legend_badge": "🥖 Golden Sourdough Wand",
        "mythical_lore": "Spun from the leftover dough of the morning bake, brushed with olive-pressed roasted garlic and baked in the lingering heat of the stone dome.",
        "flavor_notes": "Roasted Garlic Confit, Pulling Mozzarella, Toasted Sourdough Crust"
    },
    {
        "name": "Molten Choco Lava Crunch Cake",
        "description": "Warm, decadent individual chocolate cake with an irresistible bubbling dark Belgian chocolate molten center.",
        "category": "Sides & Beverages",
        "base_price": 149.0,
        "badge": "Dessert 🍫",
        "image_url": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=700&q=80",
        "ingredients": "Belgian Dark Chocolate, Dutch Cocoa, Butter, Vanilla Glaze",
        "is_veg": True,
        "rating": 5.0,
        "preparation_time": 10,
        "origin_year": 1981,
        "era": "Alchemical Oven Vault",
        "legend_badge": "✨ Alchemical Molten Core",
        "mythical_lore": "Discovered by serendipity when an alchemist baker removed a dark chocolate cake from the hearth moments before setting. A liquid caldera of pure 70% cacao that flows like molten obsidian.",
        "flavor_notes": "Rich Dutch Cocoa, Molten Velvet Ganache, Warm Madagascar Vanilla"
    }
]

INITIAL_COUPONS = [
    {
        "code": "FIRSTBITE",
        "description": "50% OFF up to ₹150 for your first wood-fired order!",
        "discount_type": "PERCENTAGE",
        "discount_value": 50.0,
        "min_order_amount": 299.0,
        "max_discount": 150.0,
        "is_active": True
    },
    {
        "code": "SLICE100",
        "description": "Flat ₹100 instant discount on orders above ₹499",
        "discount_type": "FLAT",
        "discount_value": 100.0,
        "min_order_amount": 499.0,
        "max_discount": 100.0,
        "is_active": True
    },
    {
        "code": "CHEESELOVER",
        "description": "Flat ₹75 OFF on any cheese pizza feast above ₹399",
        "discount_type": "FLAT",
        "discount_value": 75.0,
        "min_order_amount": 399.0,
        "max_discount": 75.0,
        "is_active": True
    },
    {
        "code": "FREEDEL",
        "description": "Free Courier Delivery on any order above ₹249",
        "discount_type": "FLAT",
        "discount_value": 49.0,
        "min_order_amount": 249.0,
        "max_discount": 49.0,
        "is_active": True
    }
]

def init_db():
    logger.info("Initializing database schema with Rupee ₹ currency, SliceWallet, and Address Book...")
    Base.metadata.create_all(bind=engine)

    # Automatic non-destructive schema migration for SQLite
    try:
        with engine.connect() as conn:
            cursor = conn.execute(text("PRAGMA table_info(pizza_menu)"))
            existing_cols = {row[1] for row in cursor.fetchall()}
            if "origin_year" not in existing_cols:
                conn.execute(text("ALTER TABLE pizza_menu ADD COLUMN origin_year INTEGER DEFAULT 1889"))
            if "mythical_lore" not in existing_cols:
                conn.execute(text("ALTER TABLE pizza_menu ADD COLUMN mythical_lore TEXT"))
            if "legend_badge" not in existing_cols:
                conn.execute(text("ALTER TABLE pizza_menu ADD COLUMN legend_badge VARCHAR(100)"))
            if "era" not in existing_cols:
                conn.execute(text("ALTER TABLE pizza_menu ADD COLUMN era VARCHAR(100)"))
            if "flavor_notes" not in existing_cols:
                conn.execute(text("ALTER TABLE pizza_menu ADD COLUMN flavor_notes VARCHAR(200)"))
            conn.commit()
    except Exception as e:
        logger.warning(f"Schema migration note: {e}")
    
    db = SessionLocal()
    try:
        # Seed Admin / Kitchen Staff Account
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                email="admin@vesuviohearth.com",
                password=hash_password("Admin@123"),
                phone="+91 99001 23456",
                default_address="Kitchen Command Center, 100 Feet Rd, Indiranagar, Bengaluru",
                wallet_balance=10000.0,
                is_staff=True,
                is_active=True
            )
            db.add(admin)
            logger.info("Created Default Superuser/Staff: admin / Admin@123 (₹10,000 Wallet)")

        # Seed Customer Account
        customer = db.query(User).filter(User.username == "johndoe").first()
        if not customer:
            customer = User(
                username="johndoe",
                email="johndoe@gmail.com",
                password=hash_password("Password123!"),
                phone="+91 98765 43210",
                default_address="Flat 402, Sunshine Apartments, 12th Main, Indiranagar, Bengaluru - 560038",
                wallet_balance=500.0, # ₹500 welcome credit
                is_staff=False,
                is_active=True
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)

            # Seed saved addresses for johndoe
            addr1 = Address(
                user_id=customer.id,
                label="Home",
                receiver_name="John Doe",
                receiver_phone="+91 98765 43210",
                street_address="Flat 402, Sunshine Apartments, 12th Main, Indiranagar",
                landmark="Near Toit Brewpub",
                city="Bengaluru",
                pincode="560038",
                is_default=True
            )
            addr2 = Address(
                user_id=customer.id,
                label="Work",
                receiver_name="John Doe (Tech Park)",
                receiver_phone="+91 98765 43210",
                street_address="Floor 4, Tower B, Embassy Golf Links Business Park, Domlur",
                landmark="Opposite Hilton",
                city="Bengaluru",
                pincode="560071",
                is_default=False
            )
            db.add_all([addr1, addr2])

            # Seed welcome wallet transaction
            tx = WalletTransaction(
                user_id=customer.id,
                amount=500.0,
                transaction_type="WELCOME_BONUS",
                description="Welcome to Vesuvio Hearth! ₹500 credited to your Vesuvio Wallet.",
                balance_after=500.0
            )
            db.add(tx)
            logger.info("Created Default Customer: johndoe / Password123! with 2 Addresses & ₹500 Wallet")

        db.commit()

        # Seed Coupons
        for coupon_data in INITIAL_COUPONS:
            existing = db.query(Coupon).filter(Coupon.code == coupon_data["code"]).first()
            if not existing:
                new_coupon = Coupon(**coupon_data)
                db.add(new_coupon)
                logger.info(f"Seeded Coupon: {coupon_data['code']}")

        db.commit()

        # Seed Pizza Menu Catalog
        for pizza_data in INITIAL_PIZZAS:
            existing_pizza = db.query(PizzaMenu).filter(PizzaMenu.name == pizza_data["name"]).first()
            if not existing_pizza:
                new_pizza = PizzaMenu(**pizza_data)
                db.add(new_pizza)
                logger.info(f"Seeded Food item: {pizza_data['name']} (₹{pizza_data['base_price']})")
            else:
                # Update price and metadata if existing
                existing_pizza.description = pizza_data["description"]
                existing_pizza.ingredients = pizza_data["ingredients"]
                existing_pizza.base_price = pizza_data["base_price"]
                existing_pizza.is_veg = pizza_data["is_veg"]
                existing_pizza.rating = pizza_data["rating"]
                existing_pizza.preparation_time = pizza_data["preparation_time"]
                existing_pizza.badge = pizza_data["badge"]
                existing_pizza.origin_year = pizza_data.get("origin_year", 1889)
                existing_pizza.era = pizza_data.get("era", "")
                existing_pizza.legend_badge = pizza_data.get("legend_badge", "")
                existing_pizza.mythical_lore = pizza_data.get("mythical_lore", "")
                existing_pizza.flavor_notes = pizza_data.get("flavor_notes", "")

        db.commit()

        # Seed Initial Sample Orders for live tracker demonstration
        sample_orders_count = db.query(Order).count()
        if sample_orders_count == 0 and customer:
            orders = [
                Order(
                    pizza_name="Fiery Pepperoni Inferno",
                    pizza_size="LARGE",
                    quantity=1,
                    unit_price=606.15,
                    subtotal=606.15,
                    coupon_code="FIRSTBITE",
                    discount_amount=150.0,
                    delivery_fee=0.0,
                    tax_amount=22.81,
                    total_price=478.96,
                    order_status="IN-TRANSIT",
                    order_type="DELIVERY",
                    customer_address="[Home] Flat 402, Sunshine Apartments, 12th Main, Indiranagar, Bengaluru - 560038",
                    customer_phone="+91 98765 43210",
                    payment_method="WALLET",
                    payment_status="PAID",
                    delivery_partner_name="Ramesh Kumar (Speedy Courier)",
                    delivery_partner_phone="+91 98765 43210",
                    notes="Ring doorbell, hot honey on side",
                    user_id=customer.id
                ),
                Order(
                    pizza_name="Margherita Speciale",
                    pizza_size="MEDIUM",
                    quantity=2,
                    unit_price=299.0,
                    subtotal=598.0,
                    coupon_code="SLICE100",
                    discount_amount=100.0,
                    delivery_fee=0.0,
                    tax_amount=24.90,
                    total_price=522.90,
                    order_status="DELIVERED",
                    order_type="DELIVERY",
                    customer_address="[Home] Flat 402, Sunshine Apartments, 12th Main, Indiranagar, Bengaluru - 560038",
                    customer_phone="+91 98765 43210",
                    payment_method="UPI",
                    payment_status="PAID",
                    delivery_partner_name="Ramesh Kumar (Speedy Courier)",
                    delivery_partner_phone="+91 98765 43210",
                    notes="Extra crispy crust, well done",
                    user_id=customer.id
                )
            ]
            db.add_all(orders)
            db.commit()
            logger.info("Seeded sample Indian Rupee ₹ orders for live dashboard demonstration.")

        logger.info("Database initialization and verification completed successfully!")
    except Exception as e:
        logger.error(f"Error during database initialization: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
