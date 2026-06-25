"""Tests for /api/v2/suppliers — verifies writes are stamped with the
authenticated customer's id rather than trusting a client-supplied customer_id
(the create_supplier/create_product/create_order handlers ignore any
customer_id in the request body and use current_user.id instead)."""


def test_create_supplier_uses_authenticated_customer_id(client, test_customer):
    res = client.post("/api/v2/suppliers", json={
        "customer_id": 999999,  # client-supplied value must be ignored
        "name": "Acme Exports",
        "country": "Vietnam",
        "product_category": "Furniture",
    })
    assert res.status_code == 201
    assert res.json()["customer_id"] == test_customer.id


def test_list_suppliers_only_returns_own_suppliers(client, db_session, test_customer):
    from models import Supplier, Customer

    db_session.add(Supplier(customer_id=test_customer.id, name="Mine", country="Vietnam"))
    other = Customer(clerk_id="other_supplier_user", name="Other")
    db_session.add(other)
    db_session.commit()
    db_session.add(Supplier(customer_id=other.id, name="Theirs", country="China"))
    db_session.commit()

    res = client.get("/api/v2/suppliers")
    assert res.status_code == 200
    names = [s["name"] for s in res.json()]
    assert names == ["Mine"]
