from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE customers ADD COLUMN clerk_id VARCHAR(255);"))
    conn.commit()
print("Success!")
