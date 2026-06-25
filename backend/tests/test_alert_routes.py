"""
Tests for /api/v2/alerts.

Covers the regression this whole branch started from: alerts must be scoped
to the authenticated customer's id, and a request can never read or modify
another customer's alert by guessing its id.
"""
from models import TariffAlert, Customer


def _make_alert(db_session, customer_id, severity="high", status="active"):
    alert = TariffAlert(
        customer_id=customer_id,
        alert_type="tariff_change",
        severity=severity,
        summary="Test alert",
        status=status,
    )
    db_session.add(alert)
    db_session.commit()
    db_session.refresh(alert)
    return alert


def test_list_alerts_returns_only_authenticated_customers_alerts(client, db_session, test_customer):
    _make_alert(db_session, test_customer.id)

    other_customer = Customer(clerk_id="other_user", name="Other Co")
    db_session.add(other_customer)
    db_session.commit()
    _make_alert(db_session, other_customer.id)

    res = client.get("/api/v2/alerts")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["customer_id"] == test_customer.id


def test_get_alert_404s_for_other_customers_alert(client, db_session, test_customer):
    other_customer = Customer(clerk_id="other_user_2", name="Other Co 2")
    db_session.add(other_customer)
    db_session.commit()
    other_alert = _make_alert(db_session, other_customer.id)

    res = client.get(f"/api/v2/alerts/{other_alert.id}")
    assert res.status_code == 404


def test_dismiss_alert_marks_status(client, db_session, test_customer):
    alert = _make_alert(db_session, test_customer.id)
    res = client.put(f"/api/v2/alerts/{alert.id}/dismiss")
    assert res.status_code == 200
    assert res.json()["status"] == "dismissed"


def test_resolve_alert_marks_status(client, db_session, test_customer):
    alert = _make_alert(db_session, test_customer.id)
    res = client.put(f"/api/v2/alerts/{alert.id}/resolve")
    assert res.status_code == 200
    assert res.json()["status"] == "resolved"


def test_alerts_capped_at_display_limit(client, db_session, test_customer):
    from api.v2.alert_routes import ALERT_DISPLAY_CAP

    for _ in range(ALERT_DISPLAY_CAP + 5):
        _make_alert(db_session, test_customer.id)

    res = client.get("/api/v2/alerts")
    assert len(res.json()) == ALERT_DISPLAY_CAP
