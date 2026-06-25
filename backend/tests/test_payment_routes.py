"""
Tests for /api/v2/payment.

Stripe calls are monkeypatched so this suite runs offline in CI without a
real STRIPE_SECRET_KEY. The actual Stripe integration (checkout session
creation against the real test-mode API) was verified manually against the
project's real Stripe test key — see PR description / chat log, not
re-verified here since hitting a live third-party API on every CI run is
slow and flaky.
"""
import types
import pytest


def test_create_checkout_rejects_unknown_plan(client):
    res = client.post("/api/v2/payment/create-checkout", json={"plan_id": "nonexistent-plan"})
    assert res.status_code == 400


def test_create_checkout_returns_url_for_valid_plan(client, monkeypatch):
    import api.v2.payment_routes as payment_routes

    fake_session = types.SimpleNamespace(url="https://checkout.stripe.com/fake", id="cs_test_fake123")
    monkeypatch.setattr(payment_routes.stripe.checkout.Session, "create", lambda **kw: fake_session)
    monkeypatch.setattr(payment_routes, "stripe", payment_routes.stripe)
    payment_routes.stripe.api_key = "sk_test_fake"

    res = client.post("/api/v2/payment/create-checkout", json={"plan_id": "pro-monthly"})
    assert res.status_code == 200
    body = res.json()
    assert body["checkout_url"] == "https://checkout.stripe.com/fake"
    assert body["session_id"] == "cs_test_fake123"


def test_confirm_payment_rejects_unpaid_session(client, monkeypatch):
    import api.v2.payment_routes as payment_routes

    fake_session = types.SimpleNamespace(payment_status="unpaid")
    monkeypatch.setattr(payment_routes.stripe.checkout.Session, "retrieve", lambda sid: fake_session)
    payment_routes.stripe.api_key = "sk_test_fake"

    res = client.post("/api/v2/payment/confirm", json={"session_id": "cs_test_fake123", "plan_id": "pro-monthly"})
    assert res.status_code == 402


def test_confirm_payment_activates_subscription_on_paid_session(client, monkeypatch, db_session, test_customer):
    import api.v2.payment_routes as payment_routes

    fake_session = types.SimpleNamespace(payment_status="paid")
    monkeypatch.setattr(payment_routes.stripe.checkout.Session, "retrieve", lambda sid: fake_session)
    payment_routes.stripe.api_key = "sk_test_fake"

    res = client.post("/api/v2/payment/confirm", json={"session_id": "cs_test_fake123", "plan_id": "pro-yearly"})
    assert res.status_code == 200
    body = res.json()
    assert body["subscription"]["status"] == "active"
    assert body["subscription"]["plan"] == "pro"

    db_session.refresh(test_customer)
    assert test_customer.subscription_plan == "pro"
    assert test_customer.subscription_expires_at is not None
