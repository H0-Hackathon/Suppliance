"""
CoastGuard — Seed historical_impacts with ~100 past disruption outcomes.

The Financial Impact Calculator agent (core/crew_monitor_pipeline.py,
_get_historical_impacts()) reads these rows to ground its dollar-impact
estimates in historical data (filtered by event_type + country) instead of
guessing from scratch every run.

Run:
  python scripts/seed_historical_impacts.py
"""

import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine, Base
import models  # noqa: F401

Base.metadata.create_all(bind=engine)

random.seed(42)

EVENT_TYPES = ["TARIFF", "PORT_DISRUPTION", "GEOPOLITICAL", "EXPORT_CONTROL", "WEATHER"]

COUNTRIES = [
    "Vietnam", "China", "India", "Bangladesh", "Mexico",
    "Taiwan", "South Korea", "Singapore", "Indonesia", "Thailand",
]

PRODUCTS = [
    "Textiles", "Semiconductors", "Electronics", "Steel", "Aluminum",
    "Automobiles", "Furniture", "Footwear", "Pharmaceuticals", "Solar Panels",
]

# Roughly proportional to typical per-shipment order value for that product.
BASE_LOSS_USD = {
    "Textiles": 8000,
    "Semiconductors": 45000,
    "Electronics": 25000,
    "Steel": 18000,
    "Aluminum": 15000,
    "Automobiles": 60000,
    "Furniture": 9000,
    "Footwear": 7000,
    "Pharmaceuticals": 30000,
    "Solar Panels": 20000,
}

# Relative severity of each event type vs. a baseline tariff event.
EVENT_LOSS_MULTIPLIER = {
    "TARIFF": 1.0,
    "PORT_DISRUPTION": 0.6,
    "GEOPOLITICAL": 1.3,
    "EXPORT_CONTROL": 1.6,
    "WEATHER": 0.4,
}

# Typical shipment delay (days) caused by each event type.
EVENT_DELAY_DAYS = {
    "TARIFF": 5,
    "PORT_DISRUPTION": 18,
    "GEOPOLITICAL": 25,
    "EXPORT_CONTROL": 35,
    "WEATHER": 10,
}

EVENT_LABEL = {
    "TARIFF": "Tariff increase",
    "PORT_DISRUPTION": "Port disruption",
    "GEOPOLITICAL": "Geopolitical incident",
    "EXPORT_CONTROL": "Export control order",
    "WEATHER": "Weather-related delay",
}


def build_records() -> list[dict]:
    records = []
    for event_type in EVENT_TYPES:
        for country in COUNTRIES:
            # 2 products per (event_type, country) -> 5 * 10 * 2 = 100 rows
            for product in random.sample(PRODUCTS, 2):
                base = BASE_LOSS_USD[product]
                actual_loss = round(
                    base * EVENT_LOSS_MULTIPLIER[event_type] * random.uniform(0.7, 1.3), 2
                )
                delay_days = max(
                    1, round(EVENT_DELAY_DAYS[event_type] * random.uniform(0.6, 1.5))
                )
                confidence = round(random.uniform(0.55, 0.97), 2)
                event_text = (
                    f"{EVENT_LABEL[event_type]} affecting {product.lower()} imports "
                    f"from {country}: ${actual_loss:,.0f} actual loss, "
                    f"{delay_days}-day delay (confidence {confidence:.2f})."
                )
                records.append({
                    "event_type": event_type,
                    "country": country,
                    "product": product,
                    "actual_loss": actual_loss,
                    "delay_days": delay_days,
                    "confidence": confidence,
                    "event_text": event_text,
                })
    return records


def seed():
    db = SessionLocal()
    try:
        existing = db.query(models.HistoricalImpact).count()
        if existing > 0:
            print(f"historical_impacts already has {existing} rows — skipping seed.")
            return

        records = build_records()
        db.add_all(models.HistoricalImpact(**r) for r in records)
        db.commit()

        print(f"Seeded {len(records)} historical_impacts rows.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding historical_impacts: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
