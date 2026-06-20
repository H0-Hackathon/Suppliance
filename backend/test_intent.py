import requests
from database import SessionLocal
from models import Customer
from core.auth import create_access_token
from datetime import timedelta

db = SessionLocal()
user = db.query(Customer).first()
if not user:
    print("No user found")
    exit()

token = create_access_token({"sub": user.email}, expires_delta=timedelta(hours=24))

res = requests.post(
    "http://127.0.0.1:8000/api/v2/payment/create-intent",
    json={"plan_id": "pro-monthly"},
    headers={"Authorization": f"Bearer {token}"}
)
print(res.status_code)
print(res.text)
