"""
Shared pytest fixtures.

Builds a fresh FastAPI app per test session that mounts the real routers
against an isolated in-memory SQLite database — never the live Aurora
instance. We deliberately avoid `import main` here: main.py eagerly calls
Base.metadata.create_all(bind=engine) against the *real* engine (Aurora) at
module level, which would make every test run try to open a network
connection. Mounting routers directly sidesteps that.
"""
import os
import sys
from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Force a harmless in-memory-style DB before any module reads settings, so
# `config.get_settings()` never tries to construct an Aurora connection string.
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_coastguard.db")
os.environ.setdefault("CLERK_ISSUER_URL", "https://test.clerk.accounts.dev")
# Real env vars take precedence over .env file values in pydantic-settings, so
# this blanks out whatever real Gemini key is in backend/.env — onboarding's
# normalize_business_profile() call already no-ops without a key, keeping
# tests hermetic instead of burning live LLM quota on every run.
os.environ["GEMINI_API_KEY"] = ""

from database import Base, get_db  # noqa: E402
import models  # noqa: E402,F401 — registers all tables on Base.metadata
from models import Customer  # noqa: E402
from core.auth import get_current_user  # noqa: E402

from api.v2.settings_routes import router as settings_router  # noqa: E402
from api.v2.alert_routes import router as alert_router  # noqa: E402
from api.v2.supplier_routes import router as supplier_router  # noqa: E402
from api.v2.auth_routes import router as auth_router  # noqa: E402
from api.v2.payment_routes import router as payment_router  # noqa: E402

TEST_DB_URL = "sqlite:///:memory:"


@pytest.fixture()
def test_engine():
    engine = create_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session(test_engine):
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def test_customer(db_session):
    customer = Customer(
        clerk_id="test_clerk_user_1",
        name="Test Customer",
        email="test@example.com",
        company_name="Test Co",
        industry="Furniture",
        trial_expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return customer


@pytest.fixture()
def app(db_session, test_customer):
    test_app = FastAPI()
    test_app.include_router(settings_router)
    test_app.include_router(alert_router)
    test_app.include_router(supplier_router)
    test_app.include_router(auth_router)
    test_app.include_router(payment_router)

    def _override_get_db():
        yield db_session

    def _override_get_current_user():
        return test_customer

    test_app.dependency_overrides[get_db] = _override_get_db
    test_app.dependency_overrides[get_current_user] = _override_get_current_user
    return test_app


@pytest.fixture()
def client(app):
    return TestClient(app)


@pytest.fixture()
def fake_bearer_token():
    """
    A structurally valid (but unsigned-trust) JWT carrying a `sub` claim.
    auth_routes.complete_onboarding only does an unverified decode
    (core.auth._fast_clerk_id) to read `sub` — signature trust isn't the
    point of that endpoint, since Clerk already verified the user client-side
    before they ever reach signup. Encoding with a throwaway HS256 secret
    produces a well-formed token without needing a real Clerk key pair.
    """
    import jwt
    return jwt.encode({"sub": "test_clerk_user_new"}, "throwaway-test-secret", algorithm="HS256")
