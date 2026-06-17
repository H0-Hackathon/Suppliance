"""
CoastGuard — SQLAlchemy Models

Tables:
  customers     — SMB business accounts (linked to Clerk auth)
  suppliers     — each customer's import suppliers
  products      — products tracked per customer (with HS code)
  import_orders — pending/in-transit orders
  tariff_alerts — AI-generated risk alerts per customer
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text
)
from sqlalchemy.orm import relationship
from database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clerk_id = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    company_name = Column(String(255), nullable=True)
    industry = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    suppliers = relationship("Supplier", back_populates="customer")
    products = relationship("Product", back_populates="customer")
    orders = relationship("ImportOrder", back_populates="customer")
    alerts = relationship("TariffAlert", back_populates="customer")


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    country = Column(String(100), nullable=False)
    product_category = Column(String(255), nullable=True)
    contact_email = Column(String(255), nullable=True)
    reliability_score = Column(Float, default=50.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="suppliers")
    orders = relationship("ImportOrder", back_populates="supplier")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    hs_code = Column(String(20), nullable=False)
    description = Column(String(500), nullable=True)
    unit_value_usd = Column(Float, nullable=True)
    import_country = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="products")
    orders = relationship("ImportOrder", back_populates="product")


class ImportOrder(Base):
    __tablename__ = "import_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    order_value_usd = Column(Float, nullable=False)
    quantity = Column(Integer, default=1)
    expected_delivery_date = Column(DateTime, nullable=True)
    # status: pending | in_transit | delayed | cancelled | delivered
    status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="orders")
    supplier = relationship("Supplier", back_populates="orders")
    product = relationship("Product", back_populates="orders")
    alerts = relationship("TariffAlert", back_populates="order")


class TariffAlert(Base):
    __tablename__ = "tariff_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("import_orders.id"), nullable=True)
    # alert_type: tariff_change | port_disruption | geopolitical | shipping_delay
    alert_type = Column(String(100), nullable=False)
    # severity: low | medium | high | critical
    severity = Column(String(50), nullable=False)
    summary = Column(Text, nullable=True)
    agent_output = Column(Text, nullable=True)   # JSON string from the 5-agent pipeline
    data_source = Column(String(100), nullable=True)
    # status: active | dismissed | resolved
    status = Column(String(50), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    customer = relationship("Customer", back_populates="alerts")
    order = relationship("ImportOrder", back_populates="alerts")
<<<<<<< Updated upstream
=======
    disruption_event = relationship("DisruptionEvent", back_populates="alerts")


class DisruptionEvent(Base):
    """
    A structured, queryable record of a single risk event (tariff change,
    port disruption, geopolitical incident, etc.) detected by the Monitor
    agent.

    Why this table exists alongside `tariff_alerts`:
      `TariffAlert.agent_output` is a big JSON blob meant for the alert feed
      UI (AlertCard). It's great for showing "what did each agent say?" but
      terrible for querying "show me every event near Vietnam" or "plot all
      active events on a map". This table holds just the fields the globe
      and any future analytics need, in normal queryable columns.

    Coordinates are looked up from a small hardcoded country -> (lat, lon)
    table (see services/coordinates.py) rather than asked from the LLM —
    far more reliable for a live demo than hoping Gemini returns valid
    coordinates in its JSON.
    """
    __tablename__ = "disruption_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Short unique id (uuid4 hex) used to correlate this event with a
    # TariffAlert / agent run without exposing the internal integer PK.
    incident_id = Column(String(64), unique=True, index=True)

    # event_type: tariff_change | port_disruption | geopolitical | weather
    event_type = Column(String(50), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)

    # ── Globe visualization fields (hardcoded lookup, see services/coordinates.py) ──
    location_name = Column(String(255), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # hs_codes: ["6109.10"]   countries_affected: ["VN"]
    hs_codes = Column(JSON, nullable=True)
    countries_affected = Column(JSON, nullable=True)

    # severity: low | medium | high | critical
    severity = Column(String(50), nullable=True)
    confidence = Column(Float, nullable=True)
    # source: gdelt | usitc | mock | sentinelhub
    source = Column(String(100), nullable=True)

    # Raw payload snippet from the data source, kept for debugging only.
    raw_data = Column(JSON, nullable=True)

    # Embedding column — present for the schema/talking-point, intentionally
    # unused. See the HAS_PGVECTOR note at the top of this file.
    if HAS_PGVECTOR:
        embedding = Column(Vector(768), nullable=True)

    detected_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    alerts = relationship("TariffAlert", back_populates="disruption_event")


class HistoricalImpact(Base):
    """
    Past disruption outcomes (real or seeded) used by the Impact Agent
    (core/impact_engine.py) to ground its expected/best/worst-case loss
    estimates in historical data instead of an LLM guess.

    Historical similarity is matched on event_type + country (and later,
    via `embedding`, semantic similarity over `event_text`) — see
    services/impact_service.py.
    """
    __tablename__ = "historical_impacts"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # event_type: TARIFF | PORT_DISRUPTION | GEOPOLITICAL | WEATHER
    event_type = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False, index=True)
    product = Column(String(255), nullable=True)

    actual_loss = Column(Float, nullable=False)
    delay_days = Column(Integer, nullable=True)
    confidence = Column(Float, nullable=True)

    event_text = Column(Text, nullable=True)

    # Embedding column — present for future semantic similarity search
    # (ticket 7, pgvector). Left NULL until that work is picked up.
    if HAS_PGVECTOR:
        embedding = Column(Vector(768), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class GlobalSupplier(Base):
    """
    Global exporter directory — seeded from global_exporters_dataset.csv.
    Separate from the per-customer `suppliers` table.
    Powers the Supplier Panel wizard (Region → Country → Category → Suppliers).
    """
    __tablename__ = "global_suppliers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    supplier_id = Column(String(20), unique=True, index=True, nullable=False)
    business_name = Column(String(255), nullable=False, index=True)
    country = Column(String(100), nullable=False, index=True)
    city = Column(String(100), nullable=True)
    address = Column(String(500), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    product_category = Column(String(150), nullable=False, index=True)
    product_list = Column(Text, nullable=True)
    business_type = Column(String(100), nullable=True)
    year_established = Column(Integer, nullable=True)
    employee_count = Column(Integer, nullable=True)
    annual_export_volume_usd = Column(Float, nullable=True)
    min_order_quantity = Column(String(100), nullable=True)
    export_markets = Column(Text, nullable=True)   # comma-separated regions
    certifications = Column(Text, nullable=True)
    supplier_rating = Column(Float, nullable=True)
    payment_terms = Column(String(255), nullable=True)
    lead_time_days = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
>>>>>>> Stashed changes
