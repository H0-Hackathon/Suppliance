import os
import sys
from sqlalchemy import create_engine, text

def run_migration():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set in environment.")
        return

    engine = create_engine(db_url)
    
    with engine.connect() as conn:
        print("Running migration for customers table...")
        
        try:
            conn.execute(text("ALTER TABLE customers ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;"))
            print("Added is_verified")
        except Exception as e:
            print(f"Skipped is_verified (may already exist): {e}")

        try:
            conn.execute(text("ALTER TABLE customers ADD COLUMN otp_code VARCHAR(6);"))
            print("Added otp_code")
        except Exception as e:
            print(f"Skipped otp_code (may already exist): {e}")
            
        try:
            conn.execute(text("ALTER TABLE customers ADD COLUMN location VARCHAR(255);"))
            print("Added location")
        except Exception as e:
            print(f"Skipped location: {e}")

        try:
            conn.execute(text("ALTER TABLE customers ADD COLUMN years_in_business INTEGER;"))
            print("Added years_in_business")
        except Exception as e:
            print(f"Skipped years_in_business: {e}")

        try:
            conn.execute(text("ALTER TABLE customers ADD COLUMN average_revenue VARCHAR(100);"))
            print("Added average_revenue")
        except Exception as e:
            print(f"Skipped average_revenue: {e}")
            
        conn.commit()
        print("Migration complete.")

if __name__ == "__main__":
    run_migration()
