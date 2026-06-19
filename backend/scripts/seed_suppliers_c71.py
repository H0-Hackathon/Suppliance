"""
CoastGuard — Seed suppliers for customer 71 (Gulf Coast Harvest LLC).

Run from project root:
  python backend/scripts/seed_suppliers_c71.py

Inserts 4 supplier rows for customer_id=71:
  - Café Colombia Cooperative      (Colombia  — primary coffee supplier)
  - BanaCo Brazil Exports          (Brazil    — primary banana/produce)
  - Ecuador Harvest Alliance       (Ecuador   — preferred alternative)
  - Honduras Fresh Produce LLC     (Honduras  — preferred alternative)

Idempotent: skips rows that already exist for this customer.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
import models  # noqa: F401

CUSTOMER_ID = 71

SUPPLIERS = [
    {
        "name": "Café Colombia Cooperative",
        "country": "Colombia",
        "product_category": "Agriculture & Food Products",
        "contact_email": "export@cafecolombia.co",
        "reliability_score": 78.0,
        "is_active": True,
    },
    {
        "name": "BanaCo Brazil Exports",
        "country": "Brazil",
        "product_category": "Agriculture & Food Products",
        "contact_email": "trade@banacobrazil.com.br",
        "reliability_score": 72.0,
        "is_active": True,
    },
    {
        "name": "Ecuador Harvest Alliance",
        "country": "Ecuador",
        "product_category": "Agriculture & Food Products",
        "contact_email": "info@ecuadorharvest.ec",
        "reliability_score": 65.0,
        "is_active": True,
    },
    {
        "name": "Honduras Fresh Produce LLC",
        "country": "Honduras",
        "product_category": "Agriculture & Food Products",
        "contact_email": "supply@hondurasfresh.hn",
        "reliability_score": 61.0,
        "is_active": True,
    },
]


def seed():
    db = SessionLocal()
    try:
        customer = db.query(models.Customer).filter_by(id=CUSTOMER_ID).first()
        if not customer:
            print(f"ERROR: customer_id={CUSTOMER_ID} not found in Aurora. Run seed_companies.py first.")
            return

        print(f"Seeding suppliers for customer_id={CUSTOMER_ID} ({customer.company_name})")

        existing_names = {
            s.name
            for s in db.query(models.Supplier).filter_by(customer_id=CUSTOMER_ID).all()
        }

        inserted = 0
        skipped = 0
        for row in SUPPLIERS:
            if row["name"] in existing_names:
                print(f"  SKIP  {row['name']} — already exists")
                skipped += 1
            else:
                supplier = models.Supplier(customer_id=CUSTOMER_ID, **row)
                db.add(supplier)
                print(f"  INSERT {row['name']} ({row['country']}, score={row['reliability_score']})")
                inserted += 1

        db.commit()
        print(f"\nDone. Inserted: {inserted}, Skipped: {skipped}")

        total = db.query(models.Supplier).filter_by(customer_id=CUSTOMER_ID, is_active=True).count()
        print(f"Active suppliers for customer {CUSTOMER_ID}: {total}")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
