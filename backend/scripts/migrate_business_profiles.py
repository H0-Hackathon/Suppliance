"""
CoastGuard — Migrate business_profiles: add agent training columns and populate all 5 companies.

Run from project root:
  python backend/scripts/migrate_business_profiles.py
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine
from sqlalchemy import text
import models  # noqa: F401

COMPANY_PROFILES = {
    "Cedar Ridge Furniture LLC": {
        "product_categories": ["Furniture", "Wood Products", "Home Goods"],
        "product_descriptions": [
            "wooden dining tables", "upholstered chairs",
            "bedroom furniture sets", "home décor items",
        ],
        "rss_keywords": [
            "furniture", "Vietnam", "Indonesia", "wood import",
            "tariff", "timber", "home goods", "deforestation",
        ],
        "typical_order_value_usd": 65000.0,
        "avg_lead_time_days": 45,
        "compliance_notes": (
            "LACEY Act compliance required for all timber products. "
            "Fumigation certificate may be needed for wood packaging. "
            "Country of origin declaration required."
        ),
        "preferred_alternative_regions": ["South Asia", "Malaysia", "Eastern Europe"],
        "min_supplier_rating": 3.5,
    },
    "Great Plains Pharma Inc.": {
        "product_categories": ["Pharmaceuticals", "Chemicals"],
        "product_descriptions": [
            "generic antibiotic APIs", "over-the-counter drug ingredients",
            "pharmaceutical excipients", "active pharmaceutical ingredients",
        ],
        "rss_keywords": [
            "pharmaceutical", "India", "FDA", "drug import",
            "API", "medicine tariff", "generic drugs", "pharma supply",
        ],
        "typical_order_value_usd": 120000.0,
        "avg_lead_time_days": 60,
        "compliance_notes": (
            "FDA Drug Establishment Registration required. "
            "cGMP compliance mandatory for all suppliers. "
            "DEA import permit may apply for controlled substances. "
            "FDA Prior Notice required before shipment arrival."
        ),
        "preferred_alternative_regions": ["Southeast Asia", "Europe", "China"],
        "min_supplier_rating": 4.0,
    },
    "Rust Belt Auto Supply Co.": {
        "product_categories": ["Automotive Parts", "Industrial Equipment"],
        "product_descriptions": [
            "brake components", "transmission parts",
            "engine components", "steel stampings",
        ],
        "rss_keywords": [
            "automotive", "Mexico", "Germany", "auto parts",
            "steel tariff", "USMCA", "manufacturing", "car parts",
        ],
        "typical_order_value_usd": 200000.0,
        "avg_lead_time_days": 21,
        "compliance_notes": (
            "USMCA certificate of origin required for all Mexico imports. "
            "NHTSA compliance required for safety-critical parts. "
            "Anti-dumping duties may apply on certain steel components."
        ),
        "preferred_alternative_regions": ["South Korea", "Japan", "Eastern Europe"],
        "min_supplier_rating": 4.0,
    },
    "Silicon Harbor Electronics LLC": {
        "product_categories": ["Electronics", "Semiconductors"],
        "product_descriptions": [
            "integrated circuit chips", "printed circuit boards",
            "semiconductor components", "electronic connectors",
        ],
        "rss_keywords": [
            "semiconductor", "China", "Taiwan", "chip",
            "electronics tariff", "technology export", "microchip", "TSMC",
        ],
        "typical_order_value_usd": 350000.0,
        "avg_lead_time_days": 30,
        "compliance_notes": (
            "EAR export control compliance required for dual-use components. "
            "BIS certification may be needed. "
            "Section 301 tariffs apply to many Chinese electronics imports. "
            "TSCA compliance for certain chemical components."
        ),
        "preferred_alternative_regions": ["South Korea", "Japan", "Southeast Asia"],
        "min_supplier_rating": 4.2,
    },
    "Gulf Coast Harvest LLC": {
        "product_categories": ["Food & Beverages", "Agriculture"],
        "product_descriptions": [
            "green coffee beans", "fresh bananas",
            "orange juice concentrate", "tropical fruits",
        ],
        "rss_keywords": [
            "coffee", "Colombia", "Brazil", "produce",
            "food tariff", "agricultural imports", "tropical fruit", "harvest",
        ],
        "typical_order_value_usd": 85000.0,
        "avg_lead_time_days": 28,
        "compliance_notes": (
            "FDA food safety certification required for all food imports. "
            "USDA phytosanitary certificate required for fresh produce. "
            "FDA Prior Notice required at least 2 hours before US arrival. "
            "Cold chain documentation needed for perishables."
        ),
        "preferred_alternative_regions": ["Central America", "Southeast Asia", "Mexico"],
        "min_supplier_rating": 3.5,
    },
}


def migrate():
    db = SessionLocal()
    try:
        # Add new columns to Aurora (IF NOT EXISTS = safe to re-run)
        new_columns = [
            "ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS product_categories JSON;",
            "ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS product_descriptions JSON;",
            "ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS rss_keywords JSON;",
            "ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS typical_order_value_usd FLOAT;",
            "ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS avg_lead_time_days INTEGER;",
            "ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS compliance_notes TEXT;",
            "ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS preferred_alternative_regions JSON;",
            "ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS min_supplier_rating FLOAT;",
        ]
        for sql in new_columns:
            db.execute(text(sql))
        db.commit()
        print("Columns added (or already existed).")

        # Populate data for all 5 companies
        for company_name, profile_data in COMPANY_PROFILES.items():
            # Find the customer
            result = db.execute(
                text("SELECT id FROM customers WHERE company_name = :name"),
                {"name": company_name},
            ).fetchone()

            if not result:
                print(f"  SKIP {company_name} — customer not found in DB")
                continue

            customer_id = result[0]

            # Update business_profile for this customer
            db.execute(
                text("""
                    UPDATE business_profiles SET
                        product_categories = :product_categories,
                        product_descriptions = :product_descriptions,
                        rss_keywords = :rss_keywords,
                        typical_order_value_usd = :typical_order_value_usd,
                        avg_lead_time_days = :avg_lead_time_days,
                        compliance_notes = :compliance_notes,
                        preferred_alternative_regions = :preferred_alternative_regions,
                        min_supplier_rating = :min_supplier_rating
                    WHERE customer_id = :customer_id
                """),
                {
                    "customer_id": customer_id,
                    "product_categories": json.dumps(profile_data["product_categories"]),
                    "product_descriptions": json.dumps(profile_data["product_descriptions"]),
                    "rss_keywords": json.dumps(profile_data["rss_keywords"]),
                    "typical_order_value_usd": profile_data["typical_order_value_usd"],
                    "avg_lead_time_days": profile_data["avg_lead_time_days"],
                    "compliance_notes": profile_data["compliance_notes"],
                    "preferred_alternative_regions": json.dumps(profile_data["preferred_alternative_regions"]),
                    "min_supplier_rating": profile_data["min_supplier_rating"],
                },
            )
            print(f"  UPDATED {company_name} (customer_id={customer_id})")

        db.commit()
        print("\nMigration complete.")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
