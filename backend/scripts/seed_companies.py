"""
CoastGuard — Seed 5 synthetic US importer companies into Aurora.

Run from project root:
  python backend/scripts/seed_companies.py

Inserts into: customers, business_profiles only.
Does NOT touch: suppliers, products, import_orders, tariff_alerts,
                global_suppliers, historical_impacts, disruption_events.

Behaviour:
  - New company  → INSERT customer + INSERT business_profile (all 16 fields)
  - Existing company → UPDATE any NULL business_profile fields with seed values
    (never overwrites a field that already has a value — safe to re-run)
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine, Base
import models  # noqa: F401 — registers all models with Base

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
            "product_categories": ["Furniture", "Handicrafts & Home Decor"],
            "product_descriptions": [
                "Metal household furniture",
                "Wooden household furniture",
                "Assembled wooden joinery panels",
            ],
            "rss_keywords": ["furniture tariff", "Vietnam wood", "Indonesia timber duty"],
            "typical_order_value_usd": 120000.0,
            "avg_lead_time_days": 45,
            "compliance_notes": "Certificate of Origin, Fumigation Certificate for wood products",
            "preferred_alternative_regions": ["Southeast Asia", "South Asia"],
            "preferred_alternative_countries": ["Malaysia", "Philippines", "Thailand"],
            "min_supplier_rating": 3.5,
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
            "product_categories": ["Pharmaceuticals & Healthcare"],
            "product_descriptions": [
                "Penicillin-type antibiotics",
                "Streptomycin-type antibiotics",
                "Medicaments for retail sale (other)",
            ],
            "rss_keywords": ["India pharma tariff", "API import duty", "pharmaceutical trade"],
            "typical_order_value_usd": 280000.0,
            "avg_lead_time_days": 60,
            "compliance_notes": "FDA Drug Establishment Registration, Import Alert check required",
            "preferred_alternative_regions": ["East Asia", "Latin America"],
            "preferred_alternative_countries": ["Mexico", "China", "South Korea"],
            "min_supplier_rating": 4.0,
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
            "product_categories": ["Automotive Parts", "Machinery & Industrial Equipment"],
            "product_descriptions": [
                "Other body parts and accessories for motor vehicles",
                "Other parts and accessories for motor vehicles",
                "Gear boxes for motor vehicles",
            ],
            "rss_keywords": ["auto parts tariff", "Mexico USMCA", "Germany automotive duty"],
            "typical_order_value_usd": 350000.0,
            "avg_lead_time_days": 30,
            "compliance_notes": "USMCA certificate of origin for Mexico-sourced parts",
            "preferred_alternative_regions": ["East Asia", "North America"],
            "preferred_alternative_countries": ["Canada", "South Korea", "Japan"],
            "min_supplier_rating": 3.5,
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
            "product_categories": ["Electronics & Electrical"],
            "product_descriptions": [
                "Electronic integrated circuits — processors and controllers",
                "Parts and accessories for computers and peripherals",
                "Printed circuit boards",
            ],
            "rss_keywords": ["semiconductor tariff", "China electronics duty", "Taiwan chip export"],
            "typical_order_value_usd": 620000.0,
            "avg_lead_time_days": 21,
            "compliance_notes": "Export control classification, FCC compliance documentation",
            "preferred_alternative_regions": ["Southeast Asia", "East Asia"],
            "preferred_alternative_countries": ["Vietnam", "South Korea", "Malaysia"],
            "min_supplier_rating": 4.0,
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
            "product_categories": ["Agriculture & Food Products", "Beverages"],
            "product_descriptions": [
                "Green coffee beans, not roasted or decaffeinated",
                "Fresh bananas",
                "Frozen orange juice concentrate",
            ],
            "rss_keywords": ["Colombia coffee tariff", "banana import duty", "South America produce trade"],
            "typical_order_value_usd": 85000.0,
            "avg_lead_time_days": 14,
            "compliance_notes": "FDA Prior Notice for food imports, Phytosanitary Certificate required",
            "preferred_alternative_regions": ["Central America", "South America"],
            "preferred_alternative_countries": ["Ecuador", "Honduras", "Mexico"],
            "min_supplier_rating": 3.0,
        },
    },
]

# Profile fields that the seed owns — only written if currently NULL in Aurora
FILLABLE_PROFILE_FIELDS = [
    "business_type",
    "destination_country",
    "destination_port",
    "import_region",
    "primary_hs_codes",
    "primary_origin_countries",
    "annual_import_volume_usd",
    "risk_tolerance",
    "product_categories",
    "product_descriptions",
    "rss_keywords",
    "typical_order_value_usd",
    "avg_lead_time_days",
    "compliance_notes",
    "preferred_alternative_regions",
    "preferred_alternative_countries",
    "min_supplier_rating",
]


def run_migration(db):
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
        updated = 0
        skipped = 0

        for entry in COMPANIES:
            cdata = entry["customer"]
            pdata = entry["profile"]
            company_name = cdata["company_name"]

            existing = db.query(models.Customer).filter_by(company_name=company_name).first()

            if existing:
                # Company exists — patch any NULL profile fields only
                profile = db.query(models.BusinessProfile).filter_by(customer_id=existing.id).first()
                if not profile:
                    # Profile row missing entirely (edge case: customer created but profile failed)
                    profile = models.BusinessProfile(customer_id=existing.id, **pdata)
                    db.add(profile)
                    db.flush()
                    print(f"  INSERT profile  {company_name} (customer_id={existing.id}) — profile row was missing")
                    updated += 1
                else:
                    fields_filled = []
                    for field in FILLABLE_PROFILE_FIELDS:
                        current = getattr(profile, field, None)
                        # Treat empty list/string as NULL too
                        is_empty = current is None or current == [] or current == ""
                        if is_empty and field in pdata:
                            setattr(profile, field, pdata[field])
                            fields_filled.append(field)
                    if fields_filled:
                        db.flush()
                        print(f"  UPDATE  {company_name} (customer_id={existing.id}) — filled: {', '.join(fields_filled)}")
                        updated += 1
                    else:
                        print(f"  SKIP    {company_name} — all profile fields already set")
                        skipped += 1
            else:
                # New company — full insert
                customer = models.Customer(**cdata)
                db.add(customer)
                db.flush()
                profile = models.BusinessProfile(customer_id=customer.id, **pdata)
                db.add(profile)
                db.flush()
                print(f"  INSERT  {company_name} (customer_id={customer.id})")
                inserted += 1

        db.commit()

        active_count = db.query(models.Customer).filter_by(is_active=True).count()
        print(f"\nDone. Inserted: {inserted}, Updated: {updated}, Skipped: {skipped}")
        print(f"Active customers (is_active=True): {active_count}")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
