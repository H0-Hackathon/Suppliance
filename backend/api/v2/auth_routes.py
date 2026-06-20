"""
CoastGuard — Auth Routes
POST /api/v2/auth/signup/init    — Step 1: Register new account, generate OTP
POST /api/v2/auth/signup/verify  — Step 2: Verify OTP
POST /api/v2/auth/signup/complete— Step 3: Complete company profile -> JWT
POST /api/v2/auth/login          — Login (email + password) -> JWT
GET  /api/v2/auth/me             — Get current user + subscription status
"""
import random
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from passlib.context import CryptContext

from database import get_db
from models import Customer
from core.auth import create_access_token, get_current_user

router = APIRouter(prefix="/api/v2/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TRIAL_HOURS = 24


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class SignupInitRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class SignupVerifyRequest(BaseModel):
    email: EmailStr
    otp: str

class SignupCompleteRequest(BaseModel):
    email: EmailStr
    company_name: str
    industry: str
    location: str
    years_in_business: int
    average_revenue: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _subscription_status(customer: Customer) -> dict:
    now = datetime.utcnow()

    # Active paid subscription
    if customer.subscription_plan and (
        customer.subscription_expires_at is None
        or customer.subscription_expires_at > now
    ):
        return {
            "status": "active",
            "plan": customer.subscription_plan,
            "expires_at": customer.subscription_expires_at.isoformat() if customer.subscription_expires_at else None,
        }

    # Within free trial
    if customer.trial_expires_at and customer.trial_expires_at > now:
        hours_left = (customer.trial_expires_at - now).total_seconds() / 3600
        return {
            "status": "trial",
            "plan": "trial",
            "hours_left": round(hours_left, 1),
            "expires_at": customer.trial_expires_at.isoformat(),
        }

    # Trial expired, no subscription
    return {
        "status": "expired",
        "plan": None,
        "expires_at": None,
    }


def _user_response(customer: Customer, token: str) -> dict:
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": customer.id,
            "email": customer.email,
            "name": customer.name,
            "company_name": customer.company_name,
            "industry": customer.industry,
            "location": customer.location,
        },
        "subscription": _subscription_status(customer),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/signup/init", status_code=status.HTTP_200_OK)
def signup_init(data: SignupInitRequest, db: Session = Depends(get_db)):
    """Step 1: Create an unverified user account and generate an OTP."""
    email = data.email.lower().strip()

    existing = db.query(Customer).filter(Customer.email == email).first()
    if existing:
        if existing.is_verified:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists and is verified. Please log in."
            )
        # Re-use unverified account
        customer = existing
        customer.password_hash = pwd_context.hash(data.password)
        customer.name = data.name.strip()
    else:
        hashed = pwd_context.hash(data.password)
        customer = Customer(
            email=email,
            name=data.name.strip(),
            password_hash=hashed,
            is_verified=False,
        )
        db.add(customer)

    # Generate 6-digit OTP
    otp = f"{random.randint(0, 999999):06d}"
    customer.otp_code = otp
    db.commit()
    db.refresh(customer)

    # Mock email sending
    print(f"\n[{datetime.utcnow().isoformat()}] EMAIL SENT")
    print(f"To: {email}")
    print(f"Subject: Verify your CoastGuard account")
    print(f"Body: Your verification code is: {otp}\n")

    return {"message": "Verification code sent to email."}


@router.post("/signup/verify", status_code=status.HTTP_200_OK)
def signup_verify(data: SignupVerifyRequest, db: Session = Depends(get_db)):
    """Step 2: Verify the OTP sent to the user."""
    email = data.email.lower().strip()

    customer = db.query(Customer).filter(Customer.email == email).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found. Please restart signup."
        )

    if customer.is_verified:
        return {"message": "Account already verified."}

    if not customer.otp_code or customer.otp_code != data.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code."
        )

    # Success
    customer.is_verified = True
    customer.otp_code = None
    db.commit()

    return {"message": "Email verified successfully."}


@router.post("/signup/complete", status_code=status.HTTP_201_CREATED)
def signup_complete(data: SignupCompleteRequest, db: Session = Depends(get_db)):
    """Step 3: Complete the enterprise onboarding context and return JWT."""
    email = data.email.lower().strip()

    customer = db.query(Customer).filter(Customer.email == email).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found. Please restart signup."
        )

    if not customer.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before completing signup."
        )

    # Update company details
    customer.company_name = data.company_name.strip()
    customer.industry = data.industry.strip()
    customer.location = data.location.strip()
    customer.years_in_business = data.years_in_business
    customer.average_revenue = data.average_revenue.strip()

    # Start 24h free trial
    customer.trial_expires_at = datetime.utcnow() + timedelta(hours=TRIAL_HOURS)
    
    db.commit()
    db.refresh(customer)

    token = create_access_token({"sub": customer.email})
    return _user_response(customer, token)


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    email = data.email.lower().strip()

    customer = db.query(Customer).filter(Customer.email == email).first()

    if not customer or not customer.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not pwd_context.verify(data.password, customer.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not customer.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in."
        )

    if not customer.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated."
        )

    token = create_access_token({"sub": customer.email})
    return _user_response(customer, token)


@router.get("/me")
def get_me(current_user: Customer = Depends(get_current_user)):
    """Returns logged-in user info and subscription status. No token = 401."""
    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "company_name": current_user.company_name,
            "industry": current_user.industry,
            "location": current_user.location,
        },
        "subscription": _subscription_status(current_user),
    }
