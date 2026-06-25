"""
CoastGuard — Backfill incomplete BusinessProfile rows.

Real accounts created before the onboarding LLM-normalization step existed
(e.g. customer_id 430, 331, 364, 397) have a BusinessProfile with only the
bare fields the old onboarding form collected — product_descriptions,
compliance_notes, and preferred_alternative_countries are empty, so the
pipeline's agents have nothing to reason about for those fields.

This script finds every BusinessProfile with that gap (regardless of how
many customers exist — not just the 4 known ones) and runs the same
normalize_business_profile() LLM call onboarding now uses, patching only the
empty fields. Already-populated fields are left untouched.

Run from project root:
  python backend/scripts/backfill_business_profiles.py            # all incomplete profiles
  python backend/scripts/backfill_business_profiles.py 430 331    # only these customer_ids
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
import models  # noqa: F401
from core.profile_normalizer import normalize_business_profile

PATCHABLE = [
    "business_type", "destination_country", "destination_port", "import_region",
    "risk_tolerance", "primary_hs_codes", "primary_origin_countries",
    "product_categories", "product_descriptions", "rss_keywords",
    "compliance_notes", "preferred_alternative_regions", "preferred_alternative_countries",
    "annual_import_volume_usd", "typical_order_value_usd", "avg_lead_time_days", "min_supplier_rating",
]


def _is_empty(value) -> bool:
    return value is None or value == [] or value == ""


def _is_incomplete(profile) -> bool:
    return (
        _is_empty(profile.product_descriptions)
        or _is_empty(profile.compliance_notes)
        or _is_empty(profile.preferred_alternative_countries)
    )


def backfill(customer_ids=None):
    db = SessionLocal()
    try:
        query = db.query(models.BusinessProfile)
        if customer_ids:
            query = query.filter(models.BusinessProfile.customer_id.in_(customer_ids))
        profiles = query.all()

        targets = [p for p in profiles if _is_incomplete(p)]
        print(f"Found {len(targets)} incomplete BusinessProfile row(s) out of {len(profiles)} checked.")

        for profile in targets:
            customer = db.query(models.Customer).filter_by(id=profile.customer_id).first()
            if not customer:
                print(f"  SKIP customer_id={profile.customer_id} — no matching Customer row")
                continue

            suppliers = db.query(models.Supplier).filter_by(customer_id=customer.id).all()
            supplier_dicts = [{"name": s.name, "country": s.country} for s in suppliers]

            print(f"\nNormalizing customer_id={customer.id} ({customer.company_name or customer.name}, "
                  f"industry={customer.industry}, {len(supplier_dicts)} supplier(s))...")

            normalized = normalize_business_profile(
                industry=customer.industry or "General Importer",
                raw_location=customer.location or "",
                suppliers=supplier_dicts,
                average_revenue=customer.average_revenue or "",
                company_name=customer.company_name or "",
            )

            if not normalized:
                print(f"  FAILED — normalize_business_profile() returned nothing (key missing/quota/error). Skipped.")
                continue

            patched = []
            for field in PATCHABLE:
                if _is_empty(getattr(profile, field, None)) and normalized.get(field) not in (None, "", []):
                    setattr(profile, field, normalized[field])
                    patched.append(field)

            if patched:
                db.commit()
                print(f"  PATCHED {len(patched)} field(s): {', '.join(patched)}")
            else:
                print("  Nothing to patch (normalizer returned no new data for empty fields).")

        print("\nDone.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    ids = [int(a) for a in sys.argv[1:]] if len(sys.argv) > 1 else None
    backfill(ids)
