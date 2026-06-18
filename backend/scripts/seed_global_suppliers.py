"""
CoastGuard — Seed Global Suppliers from CSV into Aurora PostgreSQL.

Usage (from backend/ directory with venv active):
    python scripts/seed_global_suppliers.py

Reads:  ../global_exporters_dataset.csv  (10,001 data rows + header)
Writes: global_suppliers table in Aurora (skips duplicates via supplier_id)
"""

import sys, os, csv, pathlib, logging

BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from database import SessionLocal, engine
from models import Base, GlobalSupplier

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

CSV_PATH = BACKEND_DIR.parent / "global_exporters_dataset.csv"
BATCH_SIZE = 500


def _safe_int(val):
    try: return int(val.strip()) if val and val.strip() else None
    except: return None

def _safe_float(val):
    try: return float(val.strip()) if val and val.strip() else None
    except: return None


def run():
    if not CSV_PATH.exists():
        logger.error("CSV not found at %s", CSV_PATH)
        sys.exit(1)

    logger.info("Creating tables if they don't exist…")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing_ids = set(row[0] for row in db.query(GlobalSupplier.supplier_id).all())
        logger.info("Existing rows in global_suppliers: %d", len(existing_ids))

        batch, inserted, skipped, total = [], 0, 0, 0

        with open(CSV_PATH, encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                total += 1
                sid = row.get("Supplier_ID", "").strip()
                if not sid or sid in existing_ids:
                    skipped += 1
                    continue

                batch.append(GlobalSupplier(
                    supplier_id=sid,
                    business_name=row.get("Business_Name", "").strip(),
                    country=row.get("Country", "").strip(),
                    city=row.get("City", "").strip() or None,
                    address=row.get("Address", "").strip() or None,
                    phone=row.get("Phone", "").strip() or None,
                    email=row.get("Email", "").strip() or None,
                    website=row.get("Website", "").strip() or None,
                    product_category=row.get("Category", "").strip(),
                    product_list=row.get("Main_Products", "").strip() or None,
                    business_type=row.get("Business_Type", "").strip() or None,
                    year_established=_safe_int(row.get("Year_Established")),
                    employee_count=_safe_int(row.get("Employees")),
                    annual_export_volume_usd=_safe_float(row.get("Annual_Export_Volume_USD")),
                    min_order_quantity=row.get("Min_Order_Quantity", "").strip() or None,
                    export_markets=row.get("Export_Markets", "").strip() or None,
                    certifications=row.get("Certifications", "").strip() or None,
                    supplier_rating=_safe_float(row.get("Rating")),
                    payment_terms=row.get("Payment_Terms", "").strip() or None,
                    lead_time_days=_safe_int(row.get("Lead_Time_Days")),
                ))
                existing_ids.add(sid)

                if len(batch) >= BATCH_SIZE:
                    db.bulk_save_objects(batch)
                    db.commit()
                    inserted += len(batch)
                    logger.info("Committed %d rows (total: %d)", len(batch), inserted)
                    batch = []

        if batch:
            db.bulk_save_objects(batch)
            db.commit()
            inserted += len(batch)

        logger.info("=" * 55)
        logger.info("Seed complete. Read: %d | Inserted: %d | Skipped: %d", total, inserted, skipped)
        logger.info("=" * 55)

    except Exception:
        db.rollback()
        logger.exception("Seed failed — rolled back.")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    run()
