"""
CoastGuard — Seed the SQLite database with demo data.

Run after init_db.py:
  python scripts/seed_data.py

Creates:
  1 Customer (Acme Imports)
  2 Suppliers (Vietnam + Bangladesh)
  1 Product (Cotton T-Shirts, HS 6109.10)
  1 ImportOrder ($40k pending)
  2 TariffAlerts (1 active high-severity, 1 resolved)
"""

import sys
import os
import json
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine, Base
import models  # noqa: F401

Base.metadata.create_all(bind=engine)

AGENT_OUTPUT_TARIFF = {
    "tariff_monitor": {
        "risk_detected": True,
        "event": "25% tariff added on HS 6109.10 from VN",
        "confidence": 0.92,
        "source": "mock_usitc",
    },
    "impact_calculator": {
        "extra_cost_usd": 10000,
        "severity": "high",
        "affected_orders": 1,
        "affected_order_ids": [1],
    },
    "alternatives_finder": {
        "options": [
            {"supplier": "Dhaka Garments Ltd", "country": "BD", "lead_time_weeks": 8, "cost_delta_pct": -12},
            {"supplier": "Mumbai Exports", "country": "IN", "lead_time_weeks": 5, "cost_delta_pct": 8},
        ]
    },
    "import_compliance": {
        "BD": ["Certificate of Origin", "Commercial Invoice update required"],
        "IN": ["BIS certification check needed", "Certificate of Origin"],
    },
    "adversarial": {
        "verdict": "CAUTION",
        "flags": [
            "BD option misses Aug 1 deadline by 1 week",
            "IN supplier has no transaction history with this buyer",
        ],
        "recommendation": (
            "Use Mumbai Exports (IN). "
            "Negotiate 1-week deadline extension with buyer before committing."
        ),
    },
}

AGENT_OUTPUT_PORT = {
    "tariff_monitor": {
        "risk_detected": True,
        "event": "Storm warning at Port of Los Angeles — 3-day closure expected",
        "confidence": 0.85,
        "source": "mock_sentinel",
    },
    "impact_calculator": {
        "extra_cost_usd": 2000,
        "severity": "medium",
        "affected_orders": 1,
        "affected_order_ids": [1],
    },
    "alternatives_finder": {
        "options": [
            {"supplier": "Long Beach Alt Route", "country": "US", "lead_time_weeks": 2, "cost_delta_pct": 5},
        ]
    },
    "import_compliance": {
        "US": ["Standard customs declaration", "Port congestion surcharge documentation"],
    },
    "adversarial": {
        "verdict": "MONITOR",
        "flags": ["Storm forecasts can change — monitor daily"],
        "recommendation": "Delay customs clearance by 3 days. No supplier switch needed.",
    },
}


def seed():
    db = SessionLocal()
    try:
        # Skip if already seeded
        if db.query(models.Customer).count() > 0:
            print("Database already seeded — skipping.")
            return

        # Customer
        customer = models.Customer(
            auth0_id="seed",
            name="Acme Imports",
            email="test@acme.com",
            company_name="Acme Imports LLC",
            industry="Textiles",
        )
        db.add(customer)
        db.flush()

        # Suppliers
        supplier_vn = models.Supplier(
            customer_id=customer.id,
            name="Mekong Textiles Co",
            country="Vietnam",
            product_category="Textiles",
            contact_email="orders@mekongtextiles.vn",
            reliability_score=82.0,
        )
        supplier_bd = models.Supplier(
            customer_id=customer.id,
            name="Dhaka Garments Ltd",
            country="Bangladesh",
            product_category="Textiles",
            contact_email="sales@dhakagarments.bd",
            reliability_score=74.0,
        )
        db.add_all([supplier_vn, supplier_bd])
        db.flush()

        # Product
        product = models.Product(
            customer_id=customer.id,
            hs_code="6109.10",
            description="Cotton T-Shirts",
            unit_value_usd=8.50,
            import_country="Vietnam",
        )
        db.add(product)
        db.flush()

        # Order
        order = models.ImportOrder(
            customer_id=customer.id,
            supplier_id=supplier_vn.id,
            product_id=product.id,
            order_value_usd=40000.00,
            quantity=4706,
            expected_delivery_date=datetime(2026, 8, 1),
            status="pending",
        )
        db.add(order)
        db.flush()

        # Alerts
        alert_tariff = models.TariffAlert(
            customer_id=customer.id,
            order_id=order.id,
            alert_type="tariff_change",
            severity="high",
            summary=(
                "US added 25% tariff on Vietnamese textiles (HS 6109.10). "
                "Your pending $40,000 order will cost an extra $10,000. "
                "Recommend switching to Mumbai Exports (IN)."
            ),
            agent_output=json.dumps(AGENT_OUTPUT_TARIFF),
            data_source="mock",
            status="active",
        )
        alert_port = models.TariffAlert(
            customer_id=customer.id,
            order_id=order.id,
            alert_type="port_disruption",
            severity="medium",
            summary=(
                "Storm warning at Port of Los Angeles — 3-day closure expected. "
                "Your Vietnam shipment may be delayed. No supplier switch needed."
            ),
            agent_output=json.dumps(AGENT_OUTPUT_PORT),
            data_source="mock",
            status="resolved",
            resolved_at=datetime.utcnow() - timedelta(hours=2),
        )
        db.add_all([alert_tariff, alert_port])
        db.commit()

        print("Seed data inserted successfully.")
        print(f"  Customers:  {db.query(models.Customer).count()}")
        print(f"  Suppliers:  {db.query(models.Supplier).count()}")
        print(f"  Products:   {db.query(models.Product).count()}")
        print(f"  Orders:     {db.query(models.ImportOrder).count()}")
        print(f"  Alerts:     {db.query(models.TariffAlert).count()}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
