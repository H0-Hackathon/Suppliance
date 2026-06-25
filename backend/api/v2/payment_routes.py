"""
CoastGuard — Payment Routes
POST /api/v2/payment/create-checkout  — Create Stripe Checkout Session
POST /api/v2/payment/confirm          — Verify session + activate subscription
"""
import os
import stripe
from fastapi import APIRouter, Depends, HTTPException
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

stripe.api_key = settings.stripe_secret_key or os.getenv("STRIPE_SECRET_KEY", "")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Price in cents
PLAN_AMOUNTS = {
    "standard-monthly": 4900,    # $49
    "standard-yearly":  46800,   # $39 × 12
    "pro-monthly":      14900,   # $149
    "pro-yearly":       142800,  # $119 × 12
}

PLAN_NAMES = {
    "standard-monthly": "CoastGuard Standard – Monthly",
    "standard-yearly":  "CoastGuard Standard – Yearly",
    "pro-monthly":      "CoastGuard Pro – Monthly",
    "pro-yearly":       "CoastGuard Pro – Yearly",
}


class CreateCheckoutRequest(BaseModel):
    plan_id: str   # e.g. "pro-monthly"


class ConfirmPaymentRequest(BaseModel):
    session_id: str
    plan_id: str


@router.post("/create-checkout")
def create_checkout(
    data: CreateCheckoutRequest,
    current_user: Customer = Depends(get_current_user),
):
    """Creates a Stripe Checkout Session and returns the redirect URL."""
    amount = PLAN_AMOUNTS.get(data.plan_id)
    if not amount:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {data.plan_id}")

    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured on server.")

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": PLAN_NAMES.get(data.plan_id, "CoastGuard Plan")},
                    "unit_amount": amount,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=(
                f"{FRONTEND_URL}/subscription"
                f"?payment=success&plan={data.plan_id}&session_id={{CHECKOUT_SESSION_ID}}"
            ),
            cancel_url=f"{FRONTEND_URL}/subscription?payment=cancelled",
            customer_email=current_user.email or None,
            metadata={
                "user_id": str(current_user.id),
                "clerk_id": current_user.clerk_id or "",
                "plan_id": data.plan_id,
            },
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/confirm")
def confirm_payment(
    data: ConfirmPaymentRequest,
    current_user: Customer = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verifies the Stripe Checkout Session and activates the subscription.
    Called by the frontend after Stripe redirects back with ?session_id=...
    """
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured on server.")

    try:
        session = stripe.checkout.Session.retrieve(data.session_id)
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Could not retrieve session: {e}")

    if session.payment_status != "paid":
        raise HTTPException(status_code=402, detail="Payment not completed.")

    plan_label = "pro" if data.plan_id.startswith("pro") else "standard"
    days = 365 if "yearly" in data.plan_id else 30

    current_user.subscription_plan = plan_label
    current_user.subscription_expires_at = datetime.utcnow() + timedelta(days=days)
    db.commit()
    db.refresh(current_user)

    return {
        "message": f"Subscription activated: {plan_label.title()} plan.",
        "subscription": _subscription_status(current_user),
    }


# ── Legacy PaymentIntent endpoint (kept for backward compat) ──────────────────

class CreateIntentRequest(BaseModel):
    plan_id: str

class LegacyConfirmRequest(BaseModel):
    payment_intent_id: str
    plan_id: str

@router.post("/create-intent")
def create_payment_intent(data: CreateIntentRequest, current_user: Customer = Depends(get_current_user)):
    amount = PLAN_AMOUNTS.get(data.plan_id, 14900)
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured.")
    try:
        intent = stripe.PaymentIntent.create(
            amount=amount, currency="usd",
            metadata={"user_id": current_user.id, "plan_id": data.plan_id}
        )
        return {"clientSecret": intent.client_secret, "plan_id": data.plan_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
