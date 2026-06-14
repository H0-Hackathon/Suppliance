"""
CoastGuard — Pydantic v2 Schemas

Request/response models for the API.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Health ────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    mock_mode: bool


# ── Customer ──────────────────────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    clerk_id: str
    name: str
    email: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None


class CustomerResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    clerk_id: str
    name: str
    email: Optional[str]
    company_name: Optional[str]
    industry: Optional[str]
    created_at: datetime


# ── Supplier ──────────────────────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    customer_id: int
    name: str
    country: str
    product_category: Optional[str] = None
    contact_email: Optional[str] = None
    reliability_score: float = 50.0


class SupplierResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    customer_id: int
    name: str
    country: str
    product_category: Optional[str]
    contact_email: Optional[str]
    reliability_score: float
    is_active: bool
    created_at: datetime


# ── Product ───────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    customer_id: int
    hs_code: str = Field(..., min_length=4, max_length=20)
    description: Optional[str] = None
    unit_value_usd: Optional[float] = None
    import_country: Optional[str] = None


class ProductResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    customer_id: int
    hs_code: str
    description: Optional[str]
    unit_value_usd: Optional[float]
    import_country: Optional[str]
    created_at: datetime


# ── ImportOrder ───────────────────────────────────────────────────────────────

class ImportOrderCreate(BaseModel):
    customer_id: int
    supplier_id: int
    product_id: int
    order_value_usd: float
    quantity: int = 1
    expected_delivery_date: Optional[datetime] = None


class ImportOrderResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    customer_id: int
    supplier_id: int
    product_id: int
    order_value_usd: float
    quantity: int
    expected_delivery_date: Optional[datetime]
    status: str
    created_at: datetime


# ── TariffAlert ───────────────────────────────────────────────────────────────

class TariffAlertResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    customer_id: int
    order_id: Optional[int]
    alert_type: str
    severity: str
    summary: Optional[str]
    agent_output: Optional[str]
    data_source: Optional[str]
    status: str
    created_at: datetime
    resolved_at: Optional[datetime]


# ── DisruptionEvent ───────────────────────────────────────────────────────────

class DisruptionEventResponse(BaseModel):
    """Structured event used to plot points on the supplier globe."""

    model_config = {"from_attributes": True}

    id: int
    incident_id: str
    event_type: str
    title: str
    description: Optional[str]
    location_name: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    hs_codes: Optional[List[str]]
    countries_affected: Optional[List[str]]
    severity: Optional[str]
    confidence: Optional[float]
    source: Optional[str]
    detected_at: datetime


# ── Monitor pipeline ──────────────────────────────────────────────────────────

class MonitorRunRequest(BaseModel):
    customer_id: int
    hs_code: str
    supplier_country: str


class MonitorRunResponse(BaseModel):
    run_id: str
    customer_id: int
    alerts_generated: int
    agent_outputs: dict
