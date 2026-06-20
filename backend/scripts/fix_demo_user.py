import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import Customer
from config import get_settings

def fix_demo_user():
    db = SessionLocal()
    settings = get_settings()
    
    try:
        # Get the seeded customer (ID 1)
        seeded = db.query(Customer).filter(Customer.id == settings.active_customer_id).first()
        
        # Get all other customers created by mistake
        others = db.query(Customer).filter(Customer.id != settings.active_customer_id).all()
        
        if not others:
            print("No extra customers found. All good.")
            return

        latest_auth0_id = others[-1].auth0_id
        
        print(f"Found {len(others)} extra customers. Deleting them and mapping {latest_auth0_id} to Seeded Customer.")
        
        # Map the latest Auth0 ID to the seeded customer
        seeded.auth0_id = latest_auth0_id
        
        # Delete the extra customers
        for c in others:
            db.delete(c)
            
        db.commit()
        print("Done!")
        
    finally:
        db.close()

if __name__ == "__main__":
    fix_demo_user()
