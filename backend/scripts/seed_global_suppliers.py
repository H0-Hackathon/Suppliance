"""
CoastGuard — Expand Acme Imports (customer id=1) to a global supplier footprint.

Run after seed_business_profile.py:
  python scripts/seed_global_suppliers.py

This script is additive and idempotent — it only inserts rows that don't
already exist (checked by customer_id / supplier name), and reuses the same
_get_or_create_* helpers/shape as scripts/seed_business_profile.py.

What this adds:
  - 9 new suppliers (Textiles -> HS 6109.10, Automotive -> HS 8708.29) across
    major manufacturing/export hubs not yet represented: China, Japan,
    Germany, Mexico, South Korea, Canada, plus three Middle Eastern hubs
    (UAE, Saudi Arabia, Turkey).
  - A matching Product + pending ImportOrder for each, so the Impact agent
    has real spend to calculate exposure against.
  - Extends BusinessProfile(Acme Imports).primary_origin_countries with the
    corresponding ISO-2 codes so /monitor/targets and the supplier map pick
    them up automatically.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine, Base
import models  # noqa: F401
from scripts.seed_business_profile import (
    _get_or_create_supplier,
    _get_or_create_product,
    _get_or_create_order,
)

Base.metadata.create_all(bind=engine)

NEW_SUPPLIERS = [
    # name, country, product_category, reliability, hs_code, description, unit_value, order_value, quantity, days_out
    ("Shenzhen Apparel Exports", "China", "Textiles", 80.0, "6109.10", "Knit T-Shirt Fabric", 5.50, 75000.0, 13636, 35),
    ("Yokohama Precision Parts", "Japan", "Automotive", 88.0, "8708.29", "Automotive Sensor Assemblies", 60.00, 55000.0, 917, 50),
    ("Bavaria Auto Components GmbH", "Germany", "Automotive", 90.0, "8708.29", "Engine Control Modules", 120.00, 84000.0, 700, 70),
    ("Monterrey AutoParts SA", "Mexico", "Automotive", 76.0, "8708.29", "Stamped Body Panels", 35.00, 52500.0, 1500, 25),
    ("Busan Motion Systems", "South Korea", "Automotive", 84.0, "8708.29", "Transmission Components", 95.00, 66500.0, 700, 40),
    ("Ontario Drivetrain Supply", "Canada", "Automotive", 87.0, "8708.29", "Drivetrain Assemblies", 150.00, 90000.0, 600, 55),
    ("Dubai Textile Trading LLC", "United Arab Emirates", "Textiles", 72.0, "6109.10", "Cotton Apparel Re-Export", 7.00, 35000.0, 5000, 20),
    ("Riyadh Garment Works", "Saudi Arabia", "Textiles", 68.0, "6109.10", "Workwear Garments", 9.00, 27000.0, 3000, 30),
    ("Istanbul Textile Mills", "Turkey", "Textiles", 81.0, "6109.10", "Cotton Knitwear", 6.50, 48750.0, 7500, 40),
]

NEW_ORIGIN_COUNTRIES = ["CN", "JP", "DE", "MX", "KR", "CA", "AE", "SA", "TR"]


def seed():
    db = SessionLocal()
    try:
        created = []

        acme = db.query(models.Customer).filter(models.Customer.id == 1).first()
        if acme is None:
            print("Customer id=1 (Acme Imports) not found — run scripts/seed_data.py first.")
            return

        profile = (
            db.query(models.BusinessProfile)
            .filter(models.BusinessProfile.customer_id == acme.id)
            .first()
        )
        if profile is None:
            print("BusinessProfile for customer id=1 not found — run scripts/seed_business_profile.py first.")
            return

        existing_origins = list(profile.primary_origin_countries or [])
        added_origins = [c for c in NEW_ORIGIN_COUNTRIES if c not in existing_origins]
        if added_origins:
            profile.primary_origin_countries = existing_origins + added_origins
            created.append(f"BusinessProfile.primary_origin_countries += {added_origins}")

        for name, country, category, reliability, hs_code, description, unit_value, order_value, quantity, days_out in NEW_SUPPLIERS:
            supplier, c1 = _get_or_create_supplier(db, acme.id, name, country, category, reliability_score=reliability)
            if c1:
                created.append(f"Supplier({name}, {country})")

            product, c2 = _get_or_create_product(db, acme.id, hs_code, description, unit_value_usd=unit_value, import_country=country)
            if c2:
                created.append(f"Product({description}, {country})")

            _, c3 = _get_or_create_order(db, acme.id, supplier.id, product.id, order_value_usd=order_value, quantity=quantity, days_out=days_out)
            if c3:
                created.append(f"ImportOrder({country}, ${order_value:,.0f})")

        db.commit()

        if created:
            print("Created:")
            for item in created:
                print(f"  - {item}")
        else:
            print("Nothing new to create — already seeded.")

        print()
        print(f"  Suppliers:        {db.query(models.Supplier).filter(models.Supplier.customer_id == acme.id).count()}")
        print(f"  Products:         {db.query(models.Product).filter(models.Product.customer_id == acme.id).count()}")
        print(f"  Orders:           {db.query(models.ImportOrder).filter(models.ImportOrder.customer_id == acme.id).count()}")
        print(f"  Origin countries: {profile.primary_origin_countries}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
