"""
CoastGuard — Seed suppliers, products, and import_orders for the 5 synthetic companies.

Run from project root:
  python backend/scripts/seed_orders.py

Idempotent: skips a company if it already has suppliers seeded.
Does NOT touch customers, business_profiles, or any other table.
"""

import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
import models

# Delivery dates relative to today
TODAY = datetime.utcnow()


def d(days): return TODAY + timedelta(days=days)


COMPANY_DATA = {
    "Cedar Ridge Furniture LLC": {
        "suppliers": [
            {
                "name": "Mekong Wood Crafts Co.",
                "country": "Vietnam",
                "product_category": "Furniture",
                "contact_email": "orders@mekongwoodcrafts.vn",
                "reliability_score": 81.0,
            },
            {
                "name": "Jakarta Home Exports PT",
                "country": "Indonesia",
                "product_category": "Home Goods",
                "contact_email": "sales@jakartahomeexports.id",
                "reliability_score": 74.0,
            },
        ],
        "products": [
            {
                "hs_code": "9403.60",
                "description": "Wooden dining table sets",
                "unit_value_usd": 450.0,
                "import_country": "Vietnam",
            },
            {
                "hs_code": "9403.40",
                "description": "Upholstered wooden chairs",
                "unit_value_usd": 120.0,
                "import_country": "Vietnam",
            },
            {
                "hs_code": "4418.20",
                "description": "Engineered wood flooring panels",
                "unit_value_usd": 35.0,
                "import_country": "Indonesia",
            },
        ],
        "orders": [
            # (supplier_index, product_index, order_value, quantity, delivery_days, status)
            (0, 0, 63000.0, 140, 45, "pending"),
            (1, 1, 28800.0, 240, 30, "in_transit"),
            (0, 2, 42000.0, 1200, 60, "pending"),
        ],
    },

    "Great Plains Pharma Inc.": {
        "suppliers": [
            {
                "name": "Mumbai BioSynth Ltd.",
                "country": "India",
                "product_category": "Pharmaceuticals",
                "contact_email": "exports@mumbaibiosynth.in",
                "reliability_score": 88.0,
            },
            {
                "name": "Hyderabad API Corp",
                "country": "India",
                "product_category": "Chemicals",
                "contact_email": "orders@hyderabadapi.in",
                "reliability_score": 83.0,
            },
        ],
        "products": [
            {
                "hs_code": "2941.10",
                "description": "Amoxicillin active pharmaceutical ingredient",
                "unit_value_usd": 850.0,
                "import_country": "India",
            },
            {
                "hs_code": "2941.20",
                "description": "Tetracycline active pharmaceutical ingredient",
                "unit_value_usd": 920.0,
                "import_country": "India",
            },
            {
                "hs_code": "3004.90",
                "description": "Generic tablet formulations (OTC)",
                "unit_value_usd": 45.0,
                "import_country": "India",
            },
        ],
        "orders": [
            (0, 0, 119000.0, 140, 60, "pending"),
            (1, 1, 82800.0, 90, 75, "pending"),
            (0, 2, 94500.0, 2100, 45, "in_transit"),
            (1, 0, 76500.0, 90, 90, "pending"),
        ],
    },

    "Rust Belt Auto Supply Co.": {
        "suppliers": [
            {
                "name": "Monterrey Precision Parts S.A.",
                "country": "Mexico",
                "product_category": "Automotive Parts",
                "contact_email": "ventas@monterreyprecision.mx",
                "reliability_score": 86.0,
            },
            {
                "name": "Bavaria Auto Components GmbH",
                "country": "Germany",
                "product_category": "Industrial Equipment",
                "contact_email": "export@bavariauto.de",
                "reliability_score": 92.0,
            },
        ],
        "products": [
            {
                "hs_code": "8708.29",
                "description": "Brake caliper assemblies",
                "unit_value_usd": 280.0,
                "import_country": "Mexico",
            },
            {
                "hs_code": "8708.99",
                "description": "Transmission control modules",
                "unit_value_usd": 650.0,
                "import_country": "Germany",
            },
            {
                "hs_code": "8708.40",
                "description": "Gearbox assemblies",
                "unit_value_usd": 1200.0,
                "import_country": "Germany",
            },
        ],
        "orders": [
            (0, 0, 196000.0, 700, 21, "pending"),
            (1, 1, 175500.0, 270, 28, "in_transit"),
            (0, 2, 144000.0, 120, 35, "pending"),
            (1, 0, 89600.0, 320, 21, "pending"),
        ],
    },

    "Silicon Harbor Electronics LLC": {
        "suppliers": [
            {
                "name": "Shenzhen Circuit Dynamics Ltd.",
                "country": "China",
                "product_category": "Electronics",
                "contact_email": "export@szcircuitdynamics.cn",
                "reliability_score": 79.0,
            },
            {
                "name": "Hsinchu Semiconductor Co.",
                "country": "Taiwan",
                "product_category": "Semiconductors",
                "contact_email": "orders@hsinchusemi.tw",
                "reliability_score": 91.0,
            },
        ],
        "products": [
            {
                "hs_code": "8542.31",
                "description": "MOSFET transistor chips",
                "unit_value_usd": 2.50,
                "import_country": "China",
            },
            {
                "hs_code": "8473.30",
                "description": "Printed circuit board assemblies",
                "unit_value_usd": 85.0,
                "import_country": "Taiwan",
            },
            {
                "hs_code": "8534.00",
                "description": "Multilayer ceramic circuit boards",
                "unit_value_usd": 45.0,
                "import_country": "China",
            },
        ],
        "orders": [
            (0, 0, 350000.0, 140000, 30, "pending"),
            (1, 1, 280750.0, 3303, 25, "in_transit"),
            (0, 2, 193500.0, 4300, 30, "pending"),
            (1, 0, 420000.0, 168000, 40, "pending"),
        ],
    },

    "Gulf Coast Harvest LLC": {
        "suppliers": [
            {
                "name": "Colombian Coffee Export S.A.",
                "country": "Colombia",
                "product_category": "Food & Beverages",
                "contact_email": "exports@colombiancoffee.co",
                "reliability_score": 85.0,
            },
            {
                "name": "Rio Verde Produce Ltda.",
                "country": "Brazil",
                "product_category": "Agriculture",
                "contact_email": "vendas@rioverdeproduce.br",
                "reliability_score": 78.0,
            },
        ],
        "products": [
            {
                "hs_code": "0901.11",
                "description": "Green coffee beans (unroasted, not decaffeinated)",
                "unit_value_usd": 3.20,
                "import_country": "Colombia",
            },
            {
                "hs_code": "0803.90",
                "description": "Fresh bananas",
                "unit_value_usd": 0.85,
                "import_country": "Brazil",
            },
            {
                "hs_code": "2009.11",
                "description": "Frozen orange juice concentrate",
                "unit_value_usd": 2.10,
                "import_country": "Brazil",
            },
        ],
        "orders": [
            (0, 0, 86400.0, 27000, 28, "pending"),
            (1, 1, 42500.0, 50000, 14, "in_transit"),
            (0, 0, 96000.0, 30000, 45, "pending"),
            (1, 2, 37800.0, 18000, 21, "pending"),
        ],
    },
}


def seed():
    db = SessionLocal()
    try:
        for company_name, data in COMPANY_DATA.items():
            # Find customer
            customer = db.query(models.Customer).filter_by(company_name=company_name).first()
            if not customer:
                print(f"  SKIP {company_name} — customer not found")
                continue

            # Skip if already seeded
            existing_suppliers = db.query(models.Supplier).filter_by(customer_id=customer.id).count()
            if existing_suppliers > 0:
                print(f"  SKIP {company_name} — already has {existing_suppliers} suppliers")
                continue

            # Insert suppliers
            supplier_objs = []
            for s in data["suppliers"]:
                sup = models.Supplier(customer_id=customer.id, **s)
                db.add(sup)
                supplier_objs.append(sup)
            db.flush()

            # Insert products
            product_objs = []
            for p in data["products"]:
                prod = models.Product(customer_id=customer.id, **p)
                db.add(prod)
                product_objs.append(prod)
            db.flush()

            # Insert orders
            for (sup_idx, prod_idx, order_val, qty, delivery_days, status) in data["orders"]:
                order = models.ImportOrder(
                    customer_id=customer.id,
                    supplier_id=supplier_objs[sup_idx].id,
                    product_id=product_objs[prod_idx].id,
                    order_value_usd=order_val,
                    quantity=qty,
                    expected_delivery_date=d(delivery_days),
                    status=status,
                )
                db.add(order)

            db.flush()
            print(
                f"  INSERT {company_name}: "
                f"{len(supplier_objs)} suppliers, "
                f"{len(product_objs)} products, "
                f"{len(data['orders'])} orders"
            )

        db.commit()
        print("\nDone.")
        print(f"  Total suppliers:     {db.query(models.Supplier).count()}")
        print(f"  Total products:      {db.query(models.Product).count()}")
        print(f"  Total import_orders: {db.query(models.ImportOrder).count()}")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
