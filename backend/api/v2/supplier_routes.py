"""
CoastGuard — Supplier, Product, and Order CRUD routes.

Endpoints:
  POST /api/v2/suppliers          create supplier
  GET  /api/v2/suppliers          list suppliers for a customer
  POST /api/v2/products           create product
  GET  /api/v2/products           list products for a customer
  POST /api/v2/orders             create import order
  GET  /api/v2/orders             list orders for a customer
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Customer, Supplier, Product, ImportOrder
from schemas import (
    SupplierCreate, SupplierResponse,
    ProductCreate, ProductResponse,
    ImportOrderCreate, ImportOrderResponse,
)

router = APIRouter(prefix="/api/v2", tags=["Suppliers & Orders"])


# ── Helper ────────────────────────────────────────────────────────────────────

def _require_customer(customer_id: int, db: Session) -> Customer:
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found")
    return customer


# ── Suppliers ─────────────────────────────────────────────────────────────────

@router.post("/suppliers", response_model=SupplierResponse, status_code=201)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    _require_customer(payload.customer_id, db)
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.get("/suppliers", response_model=List[SupplierResponse])
def list_suppliers(customer_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Supplier)
        .filter(Supplier.customer_id == customer_id, Supplier.is_active == True)
        .order_by(Supplier.created_at.desc())
        .all()
    )


# ── Products ──────────────────────────────────────────────────────────────────

@router.post("/products", response_model=ProductResponse, status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    _require_customer(payload.customer_id, db)
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/products", response_model=List[ProductResponse])
def list_products(customer_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Product)
        .filter(Product.customer_id == customer_id)
        .order_by(Product.created_at.desc())
        .all()
    )


# ── Orders ────────────────────────────────────────────────────────────────────

@router.post("/orders", response_model=ImportOrderResponse, status_code=201)
def create_order(payload: ImportOrderCreate, db: Session = Depends(get_db)):
    _require_customer(payload.customer_id, db)
    supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    order = ImportOrder(**payload.model_dump())
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/orders", response_model=List[ImportOrderResponse])
def list_orders(customer_id: int, db: Session = Depends(get_db)):
    return (
        db.query(ImportOrder)
        .filter(ImportOrder.customer_id == customer_id)
        .order_by(ImportOrder.created_at.desc())
        .all()
    )
