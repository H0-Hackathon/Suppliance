"""
CoastGuard — Fix the active customer so the pipeline can run.

Two things this script does:
  1. ALTER the three adversarial_verdict columns from VARCHAR(20) → VARCHAR(50) in Aurora
     (fixes the ROLLBACK crash when the pipeline writes "REJECTED_BY_COMPLIANCE")
  2. Ensure a BusinessProfile row exists for the active customer (ACTIVE_CUSTOMER_ID in .env)
     If none exists, create one using sensible defaults derived from the customer's industry.

Run from project root:
  python backend/scripts/fix_active_customer.py
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine, Base
from sqlalchemy import text
import models  # noqa: F401
from config import get_settings
settings = get_settings()

Base.metadata.create_all(bind=engine)

INDUSTRY_PROFILES = {
    "Furniture": {
        "business_type": "Furniture Importer",
        "destination_port": "Port of Los Angeles",
        "import_region": "Southeast Asia",
        "primary_hs_codes": ["9403.60", "9403.40", "4418.20"],
        "primary_origin_countries": ["Vietnam", "Indonesia"],
        "annual_import_volume_usd": 1800000.0,
        "risk_tolerance": "medium",
        "product_categories": ["Furniture", "Handicrafts & Home Decor"],
        "product_descriptions": ["Metal household furniture", "Wooden household furniture", "Assembled wooden joinery panels"],
        "rss_keywords": ["furniture tariff", "Vietnam wood", "Indonesia timber duty"],
        "typical_order_value_usd": 120000.0,
        "avg_lead_time_days": 45,
        "compliance_notes": "Certificate of Origin, Fumigation Certificate for wood products",
        "preferred_alternative_regions": ["Southeast Asia", "South Asia"],
        "preferred_alternative_countries": ["Malaysia", "Philippines", "Thailand"],
        "min_supplier_rating": 3.5,
    },
    "Pharmaceuticals": {
        "business_type": "Pharmaceutical Importer",
        "destination_port": "Port of Houston",
        "import_region": "South Asia",
        "primary_hs_codes": ["2941.10", "2941.20", "3004.90"],
        "primary_origin_countries": ["India"],
        "annual_import_volume_usd": 3200000.0,
        "risk_tolerance": "low",
        "product_categories": ["Pharmaceuticals & Healthcare"],
        "product_descriptions": ["Penicillin-type antibiotics", "Streptomycin-type antibiotics", "Medicaments for retail sale"],
        "rss_keywords": ["India pharma tariff", "API import duty", "pharmaceutical trade"],
        "typical_order_value_usd": 280000.0,
        "avg_lead_time_days": 60,
        "compliance_notes": "FDA Drug Establishment Registration, Import Alert check required",
        "preferred_alternative_regions": ["East Asia", "Latin America"],
        "preferred_alternative_countries": ["Mexico", "China", "South Korea"],
        "min_supplier_rating": 4.0,
    },
    "Automotive": {
        "business_type": "Auto Parts Importer",
        "destination_port": "Port of Detroit",
        "import_region": "North America",
        "primary_hs_codes": ["8708.29", "8708.99", "8708.40"],
        "primary_origin_countries": ["Mexico", "Germany"],
        "annual_import_volume_usd": 5500000.0,
        "risk_tolerance": "medium",
        "product_categories": ["Automotive Parts", "Machinery & Industrial Equipment"],
        "product_descriptions": ["Other body parts for motor vehicles", "Other parts and accessories for motor vehicles", "Gear boxes for motor vehicles"],
        "rss_keywords": ["auto parts tariff", "Mexico USMCA", "Germany automotive duty"],
        "typical_order_value_usd": 350000.0,
        "avg_lead_time_days": 30,
        "compliance_notes": "USMCA certificate of origin for Mexico-sourced parts",
        "preferred_alternative_regions": ["East Asia", "North America"],
        "preferred_alternative_countries": ["Canada", "South Korea", "Japan"],
        "min_supplier_rating": 3.5,
    },
    "Electronics": {
        "business_type": "Electronics Importer",
        "destination_port": "Port of Long Beach",
        "import_region": "East Asia",
        "primary_hs_codes": ["8542.31", "8473.30", "8534.00"],
        "primary_origin_countries": ["China", "Taiwan"],
        "annual_import_volume_usd": 7100000.0,
        "risk_tolerance": "high",
        "product_categories": ["Electronics & Electrical"],
        "product_descriptions": ["Electronic integrated circuits", "Parts and accessories for computers", "Printed circuit boards"],
        "rss_keywords": ["semiconductor tariff", "China electronics duty", "Taiwan chip export"],
        "typical_order_value_usd": 620000.0,
        "avg_lead_time_days": 21,
        "compliance_notes": "Export control classification, FCC compliance documentation",
        "preferred_alternative_regions": ["Southeast Asia", "East Asia"],
        "preferred_alternative_countries": ["Vietnam", "South Korea", "Malaysia"],
        "min_supplier_rating": 4.0,
    },
    "Food & Agriculture": {
        "business_type": "Food & Agriculture Importer",
        "destination_port": "Port of New Orleans",
        "import_region": "South America",
        "primary_hs_codes": ["0901.11", "0803.90", "2009.11"],
        "primary_origin_countries": ["Colombia", "Brazil"],
        "annual_import_volume_usd": 2100000.0,
        "risk_tolerance": "medium",
        "product_categories": ["Agriculture & Food Products", "Beverages"],
        "product_descriptions": ["Green coffee beans", "Fresh bananas", "Frozen orange juice concentrate"],
        "rss_keywords": ["Colombia coffee tariff", "banana import duty", "South America produce trade"],
        "typical_order_value_usd": 85000.0,
        "avg_lead_time_days": 14,
        "compliance_notes": "FDA Prior Notice for food imports, Phytosanitary Certificate required",
        "preferred_alternative_regions": ["Central America", "South America"],
        "preferred_alternative_countries": ["Ecuador", "Honduras", "Mexico"],
        "min_supplier_rating": 3.0,
    },
}

DEFAULT_PROFILE = {
    "business_type": "General Importer",
    "destination_port": "Port of Los Angeles",
    "import_region": "Southeast Asia",
    "primary_hs_codes": ["8471.30", "6109.10"],
    "primary_origin_countries": ["China", "Vietnam"],
    "annual_import_volume_usd": 1000000.0,
    "risk_tolerance": "medium",
    "product_categories": ["General Merchandise"],
    "product_descriptions": ["Laptop computers", "Cotton T-shirts"],
    "rss_keywords": ["China tariff", "Vietnam import duty", "US trade policy"],
    "typical_order_value_usd": 75000.0,
    "avg_lead_time_days": 30,
    "compliance_notes": "Standard customs declaration required",
    "preferred_alternative_regions": ["Southeast Asia", "South Asia"],
    "preferred_alternative_countries": ["Mexico", "India", "Malaysia"],
    "min_supplier_rating": 3.0,
}


def fix():
    db = SessionLocal()
    try:
        # ── 1. ALTER the three adversarial_verdict columns ────────────────────
        print("Fixing adversarial_verdict column sizes...")
        alters = [
            "ALTER TABLE historical_impacts ALTER COLUMN adversarial_verdict TYPE VARCHAR(50);",
            "ALTER TABLE agent_runs ALTER COLUMN adversarial_verdict TYPE VARCHAR(50);",
            "ALTER TABLE supplier_recommendations ALTER COLUMN adversarial_verdict TYPE VARCHAR(50);",
        ]
        for sql in alters:
            try:
                db.execute(text(sql))
                print(f"  OK: {sql.split('ALTER TABLE')[1].split('ALTER')[0].strip()}.adversarial_verdict → VARCHAR(50)")
            except Exception as e:
                print(f"  SKIP (may already be wide enough): {e}")
        db.commit()

        # ── 2. Ensure BusinessProfile for active customer ─────────────────────
        customer_id = settings.active_customer_id
        print(f"\nChecking BusinessProfile for active customer_id={customer_id}...")

        customer = db.query(models.Customer).filter_by(id=customer_id).first()
        if not customer:
            print(f"  ERROR: customer_id={customer_id} not found in Aurora.")
            print("  Check ACTIVE_CUSTOMER_ID in .env and that the customer exists.")
            return

        print(f"  Customer found: {customer.company_name or customer.name} | industry={customer.industry}")

        industry = (customer.industry or "").strip()
        profile_data = INDUSTRY_PROFILES.get(industry, DEFAULT_PROFILE)

        existing_profile = db.query(models.BusinessProfile).filter_by(customer_id=customer_id).first()
        if existing_profile:
            print(f"  BusinessProfile exists — checking for empty fields...")
            PATCHABLE = [
                "business_type", "destination_country", "destination_port", "import_region",
                "primary_hs_codes", "primary_origin_countries", "annual_import_volume_usd",
                "risk_tolerance", "product_categories", "product_descriptions", "rss_keywords",
                "typical_order_value_usd", "avg_lead_time_days", "compliance_notes",
                "preferred_alternative_regions", "preferred_alternative_countries", "min_supplier_rating",
            ]
            patched = []
            for field in PATCHABLE:
                current = getattr(existing_profile, field, None)
                is_empty = current is None or current == [] or current == ""
                if is_empty and field in profile_data:
                    setattr(existing_profile, field, profile_data[field])
                    patched.append(field)
                elif field == "destination_country" and is_empty:
                    setattr(existing_profile, field, "United States")
                    patched.append(field)
            if patched:
                db.commit()
                print(f"  PATCHED {len(patched)} empty fields: {', '.join(patched)}")
                print(f"    HS codes:  {existing_profile.primary_hs_codes}")
                print(f"    Countries: {existing_profile.primary_origin_countries}")
            else:
                print(f"  All fields already populated — HS codes: {existing_profile.primary_hs_codes}")
                print("  Nothing to patch.")
        else:
            print(f"  No BusinessProfile found — creating one using industry template: '{industry or 'default'}'")
            profile = models.BusinessProfile(
                customer_id=customer_id,
                destination_country="United States",
                **profile_data,
            )
            db.add(profile)
            db.commit()
            print(f"  INSERTED BusinessProfile for customer_id={customer_id}")
            print(f"    HS codes:  {profile_data['primary_hs_codes']}")
            print(f"    Countries: {profile_data['primary_origin_countries']}")

        print(f"    Keywords:  {profile_data['rss_keywords']}")
        print("\nDone. Restart the server — the pipeline should now run with real data.")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    fix()
