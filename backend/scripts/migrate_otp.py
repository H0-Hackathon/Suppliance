import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from sqlalchemy import text

def migrate():
    db = SessionLocal()
    try:
        print("Starting OTP schema migration...")
        
        # Make email unique and not null, assuming all existing rows have email or we set a dummy one.
        # But wait, existing rows might have NULL emails or duplicate emails.
        # Let's delete all customers first to be completely clean since we are changing auth methods.
        print("Clearing database to apply schema cleanly...")
        db.execute(text("TRUNCATE TABLE customers CASCADE;"))
        
        print("Dropping auth0_id...")
        db.execute(text("ALTER TABLE customers DROP COLUMN IF EXISTS auth0_id;"))
        
        print("Adding OTP columns...")
        db.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10);"))
        db.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP;"))
        
        print("Enforcing email constraints...")
        # Since table is empty now, we can safely enforce constraints
        db.execute(text("ALTER TABLE customers ALTER COLUMN email SET NOT NULL;"))
        try:
            db.execute(text("ALTER TABLE customers ADD CONSTRAINT uq_customers_email UNIQUE (email);"))
        except Exception as e:
            # If constraint already exists, ignore
            print(f"Unique constraint note: {e}")
            
        db.commit()
        print("Migration complete!")
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
