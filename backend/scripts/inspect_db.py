import sys
import os
from sqlalchemy import inspect

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import engine

def run():
    inspector = inspect(engine)
    columns = inspector.get_columns('customers')
    for col in columns:
        print(f"{col['name']}: {col['type']}")

if __name__ == "__main__":
    run()
