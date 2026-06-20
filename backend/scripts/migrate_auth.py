"""
Migration: Replace OTP auth with password + subscription model.
Run once with: uv run python scripts/migrate_auth.py
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from sqlalchemy import text


def migrate():
    db = SessionLocal()
    try:
        print("Starting auth migration...")

        print("Clearing customers table for clean slate...")
        db.execute(text("TRUNCATE TABLE customers CASCADE;"))

        print("Dropping old OTP columns...")
        db.execute(text("ALTER TABLE customers DROP COLUMN IF EXISTS otp_code;"))
        db.execute(text("ALTER TABLE customers DROP COLUMN IF EXISTS otp_expires_at;"))

        print("Adding password_hash column...")
        db.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);"))

        print("Adding subscription columns...")
        db.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP;"))
        db.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50);"))
        db.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;"))

        db.commit()
        print("\n✅ Migration complete! The customers table is ready for password-based auth.")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
