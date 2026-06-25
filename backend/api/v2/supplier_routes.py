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
from core.auth import get_current_user

router = APIRouter(prefix="/api/v2", tags=["Suppliers & Orders"])


# ── Suppliers ─────────────────────────────────────────────────────────────────

@router.post("/suppliers", response_model=SupplierResponse, status_code=201)
def create_supplier(
    payload: SupplierCreate,
    current_user: Customer = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump()
    data["customer_id"] = current_user.id
    supplier = Supplier(**data)
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.get("/suppliers", response_model=List[SupplierResponse])
def list_suppliers(
    current_user: Customer = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Supplier)
        .filter(Supplier.customer_id == current_user.id, Supplier.is_active == True)
        .order_by(Supplier.created_at.desc())
        .all()
    )


# ── Products ──────────────────────────────────────────────────────────────────

@router.post("/products", response_model=ProductResponse, status_code=201)
def create_product(
    payload: ProductCreate,
    current_user: Customer = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump()
    data["customer_id"] = current_user.id
    product = Product(**data)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/products", response_model=List[ProductResponse])
def list_products(
    current_user: Customer = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Product)
        .filter(Product.customer_id == current_user.id)
        .order_by(Product.created_at.desc())
        .all()
    )


# ── Orders ────────────────────────────────────────────────────────────────────

@router.post("/orders", response_model=ImportOrderResponse, status_code=201)
def create_order(
    payload: ImportOrderCreate,
    current_user: Customer = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    supplier = db.query(Supplier).filter(
        Supplier.id == payload.supplier_id, Supplier.customer_id == current_user.id
    ).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    product = db.query(Product).filter(
        Product.id == payload.product_id, Product.customer_id == current_user.id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    data = payload.model_dump()
    data["customer_id"] = current_user.id
    order = ImportOrder(**data)
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/orders", response_model=List[ImportOrderResponse])
def list_orders(
    current_user: Customer = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(ImportOrder)
        .filter(ImportOrder.customer_id == current_user.id)
        .order_by(ImportOrder.created_at.desc())
        .all()
    )
