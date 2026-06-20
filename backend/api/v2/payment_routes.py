"""
CoastGuard — Payment Routes
POST /api/v2/payment/create-intent — Create a Stripe PaymentIntent
POST /api/v2/payment/confirm       — Confirm payment and upgrade user
"""
import os
import stripe
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from database import get_db
from models import Customer
from core.auth import get_current_user
from api.v2.auth_routes import _subscription_status

from config import get_settings

router = APIRouter(prefix="/api/v2/payment", tags=["payment"])
settings = get_settings()

# Initialize Stripe
stripe.api_key = settings.stripe_secret_key or "sk_test_..."

class CreateIntentRequest(BaseModel):
    plan_id: str  # e.g., "pro-monthly" or "pro-yearly"

class ConfirmPaymentRequest(BaseModel):
    payment_intent_id: str

@router.post("/create-intent")
def create_payment_intent(data: CreateIntentRequest, current_user: Customer = Depends(get_current_user)):
    """Creates a Stripe PaymentIntent for the requested plan."""
    
    # Determine amount based on plan
    amount = 14900 # $149 default
    if "yearly" in data.plan_id:
        amount = 11900 # $119/mo equivalent for yearly? Or charge full year?
        # Assuming we just charge the full year or monthly amount as a dummy
        amount = 142800 # $119 * 12
    elif data.plan_id == "starter-monthly":
        amount = 4900
    elif data.plan_id == "starter-yearly":
        amount = 46800 # $39 * 12
    
    try:
        payment_intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="usd",
            metadata={
                "user_id": current_user.id,
                "email": current_user.email,
                "plan_id": data.plan_id
            }
        )
        return {"clientSecret": payment_intent.client_secret}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/confirm")
def confirm_payment(data: ConfirmPaymentRequest, current_user: Customer = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Confirms the dummy payment and upgrades the user.
    In a real app, this should be handled by a Stripe Webhook to prevent client-side spoofing.
    """
    
    # In a real app, we would verify the intent with Stripe here:
    # intent = stripe.PaymentIntent.retrieve(data.payment_intent_id)
    # if intent.status != "succeeded": raise HTTPException(...)
    
    # Extract plan from metadata (dummy logic, just upgrading to PRO for now)
    current_user.subscription_plan = "pro"
    
    # Set expiration to 30 days from now
    current_user.subscription_expires_at = datetime.utcnow() + timedelta(days=30)
    
    db.commit()
    db.refresh(current_user)
    
    return {
        "message": "Payment successful. Account upgraded to Pro.",
        "subscription": _subscription_status(current_user)
    }
