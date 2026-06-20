import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine
from models import Customer
from sqlalchemy import text

def check_db():
    try:
        db = SessionLocal()
        count = db.query(Customer).count()
        print(f"Connection successful. Found {count} customers.")
        
        # Also check what database we are connected to
        result = db.execute(text("SELECT current_database();")).scalar()
        print(f"Connected to database: {result}")
        
    except Exception as e:
        print(f"Database error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_db()
