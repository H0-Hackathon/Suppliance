"""Quick read-only check of business_profiles + new supplier rows in Aurora."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
import models  # noqa: F401

db = SessionLocal()
try:
    for profile in db.query(models.BusinessProfile).all():
        customer = db.query(models.Customer).get(profile.customer_id)
        print(f"\n{customer.company_name} (customer_id={customer.id})")
        print(f"  business_type:            {profile.business_type}")
        print(f"  annual_import_volume_usd: {profile.annual_import_volume_usd}")
        print(f"  primary_hs_codes:         {profile.primary_hs_codes}")
        print(f"  primary_origin_countries: {profile.primary_origin_countries}")
        print(f"  destination:              {profile.destination_port}, {profile.destination_country}")
        print(f"  import_region:            {profile.import_region}")
        print(f"  risk_tolerance:           {profile.risk_tolerance}")

    print("\nSuppliers:")
    for s in db.query(models.Supplier).all():
        print(f"  [{s.customer_id}] {s.name} — {s.country} ({s.product_category}, reliability={s.reliability_score})")

    print("\nOrders:")
    for o in db.query(models.ImportOrder).all():
        print(f"  [{o.customer_id}] order #{o.id}: ${o.order_value_usd:,.2f}, supplier_id={o.supplier_id}, product_id={o.product_id}, due={o.expected_delivery_date}")
finally:
    db.close()
