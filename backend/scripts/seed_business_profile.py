"""
CoastGuard — Seed business_profiles + expand supplier/order footprint.

Run after seed_data.py:
  python scripts/seed_business_profile.py

This script is additive and idempotent — it only inserts rows that don't
already exist (checked by customer_id / supplier name), and creates the new
`business_profiles` table via Base.metadata.create_all() without touching any
existing tables or rows.

What this adds:
  1. A BusinessProfile for Acme Imports (customer id=1) describing its real
     sourcing footprint (Vietnam + Bangladesh + India + South Africa) — the
     "company profile" that drives which countries/HS codes the monitor
     pipeline scans for this customer.
  2. Two new suppliers/products/orders for Acme Imports: one in India
     (textiles, HS 6109.10) and one in South Africa (auto parts, HS 8708.29).
  3. A second demo customer, NorthStar Electronics, with its own
     BusinessProfile sourcing electronics from the Netherlands (HS 8471.30) —
     proof that the data model generalizes to any country/customer, not just
     the India/South Africa example.

None of this is India/South-Africa-specific in the model layer: every field
here is a plain country/HS-code/dollar value, the same shape any customer's
profile would use.
"""

import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine, Base
import models  # noqa: F401

Base.metadata.create_all(bind=engine)


def _get_or_create_supplier(db, customer_id, name, country, product_category, reliability_score):
    existing = (
        db.query(models.Supplier)
        .filter(models.Supplier.customer_id == customer_id, models.Supplier.name == name)
        .first()
    )
    if existing:
        return existing, False

    supplier = models.Supplier(
        customer_id=customer_id,
        name=name,
        country=country,
        product_category=product_category,
        reliability_score=reliability_score,
    )
    db.add(supplier)
    db.flush()
    return supplier, True


def _get_or_create_product(db, customer_id, hs_code, description, unit_value_usd, import_country):
    existing = (
        db.query(models.Product)
        .filter(
            models.Product.customer_id == customer_id,
            models.Product.hs_code == hs_code,
            models.Product.import_country == import_country,
        )
        .first()
    )
    if existing:
        return existing, False

    product = models.Product(
        customer_id=customer_id,
        hs_code=hs_code,
        description=description,
        unit_value_usd=unit_value_usd,
        import_country=import_country,
    )
    db.add(product)
    db.flush()
    return product, True


def _get_or_create_order(db, customer_id, supplier_id, product_id, order_value_usd, quantity, days_out):
    existing = (
        db.query(models.ImportOrder)
        .filter(
            models.ImportOrder.customer_id == customer_id,
            models.ImportOrder.supplier_id == supplier_id,
            models.ImportOrder.product_id == product_id,
        )
        .first()
    )
    if existing:
        return existing, False

    order = models.ImportOrder(
        customer_id=customer_id,
        supplier_id=supplier_id,
        product_id=product_id,
        order_value_usd=order_value_usd,
        quantity=quantity,
        expected_delivery_date=datetime.utcnow() + timedelta(days=days_out),
        status="pending",
    )
    db.add(order)
    db.flush()
    return order, True


def _get_or_create_business_profile(db, customer_id, **fields):
    existing = (
        db.query(models.BusinessProfile)
        .filter(models.BusinessProfile.customer_id == customer_id)
        .first()
    )
    if existing:
        return existing, False

    profile = models.BusinessProfile(customer_id=customer_id, **fields)
    db.add(profile)
    db.flush()
    return profile, True


def seed():
    db = SessionLocal()
    try:
        created = []

        # ── Acme Imports (customer id=1): expand to India + South Africa ────
        acme = db.query(models.Customer).filter(models.Customer.id == 1).first()
        if acme is None:
            print("Customer id=1 (Acme Imports) not found — run scripts/seed_data.py first.")
            return

        profile, was_created = _get_or_create_business_profile(
            db,
            customer_id=acme.id,
            business_type="Apparel & Automotive Parts Importer",
            annual_import_volume_usd=500000.0,
            primary_hs_codes=["6109.10", "8708.29"],
            primary_origin_countries=["VN", "BD", "IN", "ZA"],
            destination_country="US",
            destination_port="Los Angeles",
            import_region="Asia-Pacific & Sub-Saharan Africa",
            risk_tolerance="medium",
        )
        if was_created:
            created.append("BusinessProfile(Acme Imports)")

        # India: textiles
        supplier_in, c1 = _get_or_create_supplier(
            db, acme.id, "Surat Textile Mills", "India", "Textiles", reliability_score=78.0
        )
        if c1:
            created.append("Supplier(Surat Textile Mills, India)")

        product_in, c2 = _get_or_create_product(
            db, acme.id, "6109.10", "Cotton Fabric Rolls", unit_value_usd=6.20, import_country="India"
        )
        if c2:
            created.append("Product(Cotton Fabric Rolls, India)")

        _, c3 = _get_or_create_order(
            db, acme.id, supplier_in.id, product_in.id,
            order_value_usd=60000.0, quantity=9677, days_out=45,
        )
        if c3:
            created.append("ImportOrder(India, $60,000)")

        # South Africa: automotive parts
        supplier_za, c4 = _get_or_create_supplier(
            db, acme.id, "Durban AutoParts Co", "South Africa", "Automotive", reliability_score=70.0
        )
        if c4:
            created.append("Supplier(Durban AutoParts Co, South Africa)")

        product_za, c5 = _get_or_create_product(
            db, acme.id, "8708.29", "Automotive Body Parts", unit_value_usd=45.00, import_country="South Africa"
        )
        if c5:
            created.append("Product(Automotive Body Parts, South Africa)")

        _, c6 = _get_or_create_order(
            db, acme.id, supplier_za.id, product_za.id,
            order_value_usd=90000.0, quantity=2000, days_out=60,
        )
        if c6:
            created.append("ImportOrder(South Africa, $90,000)")

        # ── Second demo customer: NorthStar Electronics (Netherlands) ───────
        northstar = (
            db.query(models.Customer)
            .filter(models.Customer.clerk_id == "test_northstar")
            .first()
        )
        if northstar is None:
            northstar = models.Customer(
                clerk_id="test_northstar",
                name="NorthStar Electronics",
                email="ops@northstarelectronics.com",
                company_name="NorthStar Electronics LLC",
                industry="Electronics",
            )
            db.add(northstar)
            db.flush()
            created.append("Customer(NorthStar Electronics)")

        _, was_created = _get_or_create_business_profile(
            db,
            customer_id=northstar.id,
            business_type="Consumer Electronics Importer",
            annual_import_volume_usd=1200000.0,
            primary_hs_codes=["8471.30"],
            primary_origin_countries=["NL"],
            destination_country="US",
            destination_port="New York",
            import_region="Western Europe",
            risk_tolerance="low",
        )
        if was_created:
            created.append("BusinessProfile(NorthStar Electronics)")

        supplier_nl, c7 = _get_or_create_supplier(
            db, northstar.id, "Eindhoven Electronics BV", "Netherlands", "Electronics", reliability_score=85.0
        )
        if c7:
            created.append("Supplier(Eindhoven Electronics BV, Netherlands)")

        product_nl, c8 = _get_or_create_product(
            db, northstar.id, "8471.30", "Laptop Computers", unit_value_usd=450.00, import_country="Netherlands"
        )
        if c8:
            created.append("Product(Laptop Computers, Netherlands)")

        _, c9 = _get_or_create_order(
            db, northstar.id, supplier_nl.id, product_nl.id,
            order_value_usd=120000.0, quantity=266, days_out=50,
        )
        if c9:
            created.append("ImportOrder(Netherlands, $120,000)")

        db.commit()

        if created:
            print("Created:")
            for item in created:
                print(f"  - {item}")
        else:
            print("Nothing new to create — already seeded.")

        print()
        print(f"  Customers:        {db.query(models.Customer).count()}")
        print(f"  BusinessProfiles: {db.query(models.BusinessProfile).count()}")
        print(f"  Suppliers:        {db.query(models.Supplier).count()}")
        print(f"  Products:         {db.query(models.Product).count()}")
        print(f"  Orders:           {db.query(models.ImportOrder).count()}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
