"""
Tests for /api/v2/auth.

complete_onboarding deliberately skips full JWT signature verification
(core.auth._fast_clerk_id) — Clerk already verified the user client-side
before signup, so this only needs to read the `sub` claim. get_me/delete_account
go through the full get_current_user dependency, overridden in conftest.
"""


def test_onboarding_creates_customer_and_profile(client, fake_bearer_token, db_session):
    from models import Customer, BusinessProfile

    res = client.post(
        "/api/v2/auth/onboarding",
        headers={"Authorization": f"Bearer {fake_bearer_token}"},
        json={
            "email": "new.importer@example.com",
            "name": "New Importer",
            "company_name": "New Importer LLC",
            "industry": "Electronics",
            "location": "California",
            "years_in_business": 3,
            "average_revenue": "$1M-$5M",
            "primary_hs_codes": ["8542.31"],
            "primary_origin_countries": ["Taiwan"],
        },
    )
    assert res.status_code == 201
    customer_id = res.json()["customer_id"]

    customer = db_session.query(Customer).filter(Customer.id == customer_id).first()
    assert customer is not None
    assert customer.clerk_id == "test_clerk_user_new"
    assert customer.trial_expires_at is not None  # 24h trial started

    profile = db_session.query(BusinessProfile).filter(BusinessProfile.customer_id == customer_id).first()
    assert profile is not None
    assert profile.primary_hs_codes == ["8542.31"]


def test_onboarding_is_idempotent_for_same_clerk_id(client, fake_bearer_token, db_session):
    """Submitting onboarding twice for the same user updates in place rather than duplicating."""
    from models import Customer

    payload = {
        "email": "dup@example.com", "name": "Dup", "company_name": "Dup Co",
        "industry": "Furniture", "location": "Texas", "years_in_business": 1,
        "average_revenue": "$0-$1M",
    }
    client.post("/api/v2/auth/onboarding", headers={"Authorization": f"Bearer {fake_bearer_token}"}, json=payload)
    payload["company_name"] = "Dup Co Renamed"
    client.post("/api/v2/auth/onboarding", headers={"Authorization": f"Bearer {fake_bearer_token}"}, json=payload)

    matches = db_session.query(Customer).filter(Customer.clerk_id == "test_clerk_user_new").all()
    assert len(matches) == 1
    assert matches[0].company_name == "Dup Co Renamed"


def test_onboarding_rejects_missing_token(client):
    res = client.post("/api/v2/auth/onboarding", json={
        "email": "x@example.com", "name": "X", "company_name": "X Co",
        "industry": "Furniture", "location": "NY", "years_in_business": 1,
        "average_revenue": "$0-$1M",
    })
    assert res.status_code == 401  # HTTPBearer auto_error=True with no header


def test_get_me_returns_authenticated_customer(client, test_customer):
    res = client.get("/api/v2/auth/me")
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["id"] == test_customer.id
    assert body["subscription"]["status"] == "trial"


def test_delete_account_removes_customer(client, db_session, test_customer):
    customer_id = test_customer.id
    res = client.delete("/api/v2/auth/me")
    assert res.status_code == 200

    from models import Customer
    db_session.expire_all()
    assert db_session.query(Customer).filter(Customer.id == customer_id).first() is None
