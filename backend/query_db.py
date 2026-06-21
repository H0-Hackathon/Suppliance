from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    print("--- CUSTOMERS ---")
    rows = conn.execute(text("SELECT id, email, clerk_id, name, company_name FROM customers ORDER BY id DESC LIMIT 10;")).fetchall()
    for r in rows:
        print(r)
    
    print("\n--- BUSINESS PROFILES ---")
    rows = conn.execute(text("SELECT id, customer_id, business_type FROM business_profiles ORDER BY id DESC LIMIT 10;")).fetchall()
    for r in rows:
        print(r)
