"""
Drop global_suppliers table so it gets recreated with renamed columns.
Run once, then re-run seed_global_suppliers.py.
"""
import sys, pathlib
BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("DROP TABLE IF EXISTS global_suppliers CASCADE"))
    conn.commit()
    print("Dropped global_suppliers table.")
