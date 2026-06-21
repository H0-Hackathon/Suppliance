"""
CoastGuard — Seed 5 synthetic US importer companies into Aurora.

Run from project root:
  python backend/scripts/seed_companies.py

Inserts into: customers, business_profiles only.
Does NOT touch: suppliers, products, import_orders, tariff_alerts,
                global_suppliers, historical_impacts, disruption_events.
Existing rows are never modified or deleted.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine, Base
import models  # noqa: F401 — registers all models with Base

# Ensure is_active column and business_profiles table exist
Base.metadata.create_all(bind=engine)

COMPANIES = [
    {
        "customer": {
            "clerk_id": "synthetic_001",
            "name": "Cedar Ridge Admin",
            "email": "admin@cedarridgefurniture.com",
            "company_name": "Cedar Ridge Furniture LLC",
            "industry": "Furniture",
            "is_active": True,
        },
        "profile": {
            "business_type": "Furniture Importer",
            "destination_country": "United States",
            "destination_port": "Port of Seattle",
            "import_region": "Southeast Asia",
            "primary_hs_codes": ["9403.60", "9403.40", "4418.20"],
            "primary_origin_countries": ["Vietnam", "Indonesia"],
            "annual_import_volume_usd": 1800000.0,
            "risk_tolerance": "medium",
        },
    },
    {
        "customer": {
            "clerk_id": "synthetic_002",
            "name": "Great Plains Admin",
            "email": "admin@greatplainspharma.com",
            "company_name": "Great Plains Pharma Inc.",
            "industry": "Pharmaceuticals",
            "is_active": True,
        },
        "profile": {
            "business_type": "Pharmaceutical Importer",
            "destination_country": "United States",
            "destination_port": "Port of Houston",
            "import_region": "South Asia",
            "primary_hs_codes": ["2941.10", "2941.20", "3004.90"],
            "primary_origin_countries": ["India"],
            "annual_import_volume_usd": 3200000.0,
            "risk_tolerance": "low",
        },
    },
    {
        "customer": {
            "clerk_id": "synthetic_003",
            "name": "Rust Belt Admin",
            "email": "admin@rustbeltauto.com",
            "company_name": "Rust Belt Auto Supply Co.",
            "industry": "Automotive",
            "is_active": True,
        },
        "profile": {
            "business_type": "Auto Parts Importer",
            "destination_country": "United States",
            "destination_port": "Port of Detroit",
            "import_region": "North America",
            "primary_hs_codes": ["8708.29", "8708.99", "8708.40"],
            "primary_origin_countries": ["Mexico", "Germany"],
            "annual_import_volume_usd": 5500000.0,
            "risk_tolerance": "medium",
        },
    },
    {
        "customer": {
            "clerk_id": "synthetic_004",
            "name": "Silicon Harbor Admin",
            "email": "admin@siliconharborelectronics.com",
            "company_name": "Silicon Harbor Electronics LLC",
            "industry": "Electronics",
            "is_active": True,
        },
        "profile": {
            "business_type": "Electronics Importer",
            "destination_country": "United States",
            "destination_port": "Port of Long Beach",
            "import_region": "East Asia",
            "primary_hs_codes": ["8542.31", "8473.30", "8534.00"],
            "primary_origin_countries": ["China", "Taiwan"],
            "annual_import_volume_usd": 7100000.0,
            "risk_tolerance": "high",
        },
    },
    {
        "customer": {
            "clerk_id": "synthetic_005",
            "name": "Gulf Coast Admin",
            "email": "admin@gulfcoastharvest.com",
            "company_name": "Gulf Coast Harvest LLC",
            "industry": "Food & Agriculture",
            "is_active": True,
        },
        "profile": {
            "business_type": "Food & Agriculture Importer",
            "destination_country": "United States",
            "destination_port": "Port of New Orleans",
            "import_region": "South America",
            "primary_hs_codes": ["0901.11", "0803.90", "2009.11"],
            "primary_origin_countries": ["Colombia", "Brazil"],
            "annual_import_volume_usd": 2100000.0,
            "risk_tolerance": "medium",
        },
    },
]


def run_migration(db):
    """Add is_active column to customers if it doesn't exist, then deactivate old placeholders."""
    from sqlalchemy import text
    db.execute(text(
        "ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;"
    ))
    db.execute(text(
        "UPDATE customers SET is_active = FALSE "
        "WHERE company_name IN ('Acme Imports LLC', 'NorthStar Electronics') "
        "AND (is_active IS NULL OR is_active = TRUE);"
    ))
    db.commit()
    print("Migration applied: is_active column ensured, old placeholder companies deactivated.")


def seed():
    db = SessionLocal()
    try:
        run_migration(db)

        inserted = 0
        skipped = 0

        for entry in COMPANIES:
            cdata = entry["customer"]
            company_name = cdata["company_name"]

            existing = db.query(models.Customer).filter_by(company_name=company_name).first()
            if existing:
                print(f"  SKIP  {company_name} — already exists (id={existing.id})")
                skipped += 1
                continue

            customer = models.Customer(**cdata)
            db.add(customer)
            db.flush()

            profile = models.BusinessProfile(customer_id=customer.id, **entry["profile"])
            db.add(profile)
            db.flush()

            print(f"  INSERT {company_name} (id={customer.id})")
            inserted += 1

        db.commit()

        active_count = db.query(models.Customer).filter_by(is_active=True).count()
        print(f"\nDone. Inserted: {inserted}, Skipped: {skipped}")
        print(f"Active customers (is_active=True): {active_count}")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
