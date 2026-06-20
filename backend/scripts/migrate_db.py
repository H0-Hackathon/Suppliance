import sys
import os
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import engine

def migrate():
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE customers RENAME COLUMN clerk_id TO auth0_id;"))
        print("Successfully renamed clerk_id to auth0_id.")

if __name__ == "__main__":
    migrate()
