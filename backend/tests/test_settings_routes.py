"""Tests for /api/v2/settings — both routes resolve the customer from the
authenticated session (core.auth.get_current_user), overridden in conftest
to return a fixed test_customer instead of verifying a real Clerk JWT."""


def test_get_settings_returns_customer_profile(client, test_customer):
    res = client.get("/api/v2/settings")
    assert res.status_code == 200
    body = res.json()
    assert body["customer_id"] == test_customer.id
    assert body["name"] == "Test Customer"
    assert body["company_name"] == "Test Co"
    assert body["primary_hs_codes"] == []


def test_patch_settings_updates_customer_fields(client):
    res = client.patch("/api/v2/settings", json={"company_name": "Updated Co", "industry": "Electronics"})
    assert res.status_code == 200
    body = res.json()
    assert body["company_name"] == "Updated Co"
    assert body["industry"] == "Electronics"


def test_patch_settings_creates_business_profile_if_missing(client):
    res = client.patch(
        "/api/v2/settings",
        json={"primary_hs_codes": ["9403.60"], "primary_origin_countries": ["Vietnam"]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["primary_hs_codes"] == ["9403.60"]
    assert body["primary_origin_countries"] == ["Vietnam"]


def test_patch_settings_persists_across_requests(client):
    client.patch("/api/v2/settings", json={"risk_tolerance": "low"})
    res = client.get("/api/v2/settings")
    assert res.json()["risk_tolerance"] == "low"
