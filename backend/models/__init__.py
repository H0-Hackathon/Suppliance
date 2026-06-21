"""
CoastGuard — SQLAlchemy Models

Tables:
  customers               — SMB business accounts (linked to Clerk auth)
  business_profiles       — rich AI personalization data per customer
  suppliers               — each customer's import suppliers
  products                — products tracked per customer (with HS code)
  import_orders           — pending/in-transit orders
  tariff_alerts           — AI-generated risk alerts per customer
  disruption_events       — structured/queryable record of every risk event
  historical_impacts      — past disruption outcomes for the Impact Agent (enriched)
  agent_runs              — permanent log of every pipeline run
  rss_articles            — temporary RSS buffer per run (deleted after pipeline)
  supplier_recommendations— extracted AlternativesFinder outputs per alert
  global_suppliers        — 25,000 synthetic global exporter directory
"""

from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, JSON, String, Text
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
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    business_profile = relationship("BusinessProfile", back_populates="customer", uselist=False)
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
    disruption_event_id = Column(Integer, ForeignKey("disruption_events.id"), nullable=True)
    alert_type = Column(String(100), nullable=False)
    severity = Column(String(50), nullable=False)
    summary = Column(Text, nullable=True)
    agent_output = Column(Text, nullable=True)
    data_source = Column(String(100), nullable=True)
    status = Column(String(50), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    customer = relationship("Customer", back_populates="alerts")
    order = relationship("ImportOrder", back_populates="alerts")
    disruption_event = relationship("DisruptionEvent", back_populates="alerts")


class DisruptionEvent(Base):
    """Structured, queryable record of a single risk event. Powers the globe visualization."""
    __tablename__ = "disruption_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(64), unique=True, index=True)
    event_type = Column(String(50), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    location_name = Column(String(255), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    hs_codes = Column(JSON, nullable=True)
    countries_affected = Column(JSON, nullable=True)
    severity = Column(String(50), nullable=True)
    confidence = Column(Float, nullable=True)
    source = Column(String(100), nullable=True)
    raw_data = Column(JSON, nullable=True)
    detected_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    alerts = relationship("TariffAlert", back_populates="disruption_event")


class HistoricalImpact(Base):
    """
    Past disruption outcomes used by the ImpactCalculator Agent for grounding estimates.
    Written at the end of every successful pipeline run.
    Enriched with signal metadata so future runs can calibrate by pattern, not just dollar amount.
    """
    __tablename__ = "historical_impacts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Original columns (kept for backward compat)
    event_type = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False, index=True)
    product = Column(String(255), nullable=True)
    actual_loss = Column(Float, nullable=False)       # = extra_cost_usd from ImpactCalculator
    delay_days = Column(Integer, nullable=True)
    confidence = Column(Float, nullable=True)         # TariffMonitor confidence score
    event_text = Column(Text, nullable=True)          # TariffMonitor event description
    created_at = Column(DateTime, default=datetime.utcnow)
    # Pipeline linkage
    run_id = Column(String(64), nullable=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True, index=True)
    alert_id = Column(Integer, ForeignKey("tariff_alerts.id"), nullable=True)
    # Severity + verdict context
    severity = Column(String(50), nullable=True)
    adversarial_verdict = Column(String(20), nullable=True)   # CLEAR / CAUTION / BLOCK
    # Affected trade dimensions
    affected_hs_codes = Column(JSON, nullable=True)
    affected_countries = Column(JSON, nullable=True)          # full list (country = primary)
    # RSS signal metadata
    articles_matched = Column(Integer, default=0)
    source_credibility = Column(String(500), nullable=True)   # e.g. "usda,ustr" — authoritative feeds that fired
    signal_age_hours = Column(Float, nullable=True)           # age of newest matching article at alert time
    risk_source = Column(String(100), nullable=True)          # rss / usitc / gemini_knowledge
    # Alternative supplier context
    supplier_alternatives_found = Column(Integer, default=0)
    best_alternative_lead_time_weeks = Column(Integer, nullable=True)
    # Resolution (filled in later when alert is dismissed/resolved)
    resolution_days = Column(Integer, nullable=True)


class BusinessProfile(Base):
    """Rich company profile used to personalize agent prompts per customer."""
    __tablename__ = "business_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), unique=True, nullable=False)
    business_type = Column(String(100), nullable=True)
    annual_import_volume_usd = Column(Float, nullable=True)
    primary_hs_codes = Column(JSON, nullable=True)
    primary_origin_countries = Column(JSON, nullable=True)
    destination_country = Column(String(100), nullable=True)
    destination_port = Column(String(255), nullable=True)
    import_region = Column(String(255), nullable=True)
    risk_tolerance = Column(String(50), nullable=True)
    # Agent training context
    product_categories = Column(JSON, nullable=True)
    product_descriptions = Column(JSON, nullable=True)
    rss_keywords = Column(JSON, nullable=True)
    typical_order_value_usd = Column(Float, nullable=True)
    avg_lead_time_days = Column(Integer, nullable=True)
    compliance_notes = Column(Text, nullable=True)
    preferred_alternative_regions = Column(JSON, nullable=True)
    min_supplier_rating = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="business_profile")


class AgentRun(Base):
    """
    Permanent log of every pipeline execution. One row per run.
    Read by the Adversarial agent to detect patterns across runs (repeat BLOCKs, severity trends).
    """
    __tablename__ = "agent_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="running")          # running / completed / failed
    model_used = Column(String(100), nullable=True)
    articles_matched = Column(Integer, default=0)
    alerts_generated = Column(Integer, default=0)
    adversarial_verdict = Column(String(20), nullable=True)
    severity = Column(String(50), nullable=True)
    extra_cost_usd = Column(Float, nullable=True)
    event_type = Column(String(100), nullable=True)
    affected_countries = Column(JSON, nullable=True)


class RssArticle(Base):
    """
    Temporary Aurora buffer for scored RSS articles during a pipeline run.
    Written at pipeline start, deleted at pipeline end.
    Shows Aurora as an active data buffer in the pipeline flow (not just a result store).
    """
    __tablename__ = "rss_articles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    title = Column(String(500), nullable=True)
    url = Column(String(1000), nullable=True)
    source = Column(String(255), nullable=True)
    published_at = Column(String(100), nullable=True)
    body = Column(Text, nullable=True)
    relevance_score = Column(Integer, default=0)
    country_mentioned = Column(String(100), nullable=True)
    agent_target = Column(String(50), nullable=True)   # tariff_monitor | alternatives_finder | import_compliance
    created_at = Column(DateTime, default=datetime.utcnow)


class SupplierRecommendation(Base):
    """
    Extracted AlternativesFinder outputs stored per alert.
    Read by the AlternativesFinder on future runs to build on past suggestions
    instead of rediscovering the same suppliers every time.
    """
    __tablename__ = "supplier_recommendations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey("tariff_alerts.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    run_id = Column(String(64), nullable=False)
    supplier_name = Column(String(255), nullable=False)
    country = Column(String(100), nullable=False)
    lead_time_weeks = Column(Integer, nullable=True)
    cost_delta_pct = Column(Integer, nullable=True)
    source = Column(String(100), nullable=True)             # global_suppliers_db / gemini
    adversarial_verdict = Column(String(20), nullable=True) # verdict from the run that generated this
    created_at = Column(DateTime, default=datetime.utcnow)


class AgentRunLog(Base):
    """
    Per-agent log row — one row per agent per pipeline run.
    Stores the input context each agent received and its raw output JSON.
    Linked to both the run (run_id) and the resulting alert (tariff_alert_id).
    """
    __tablename__ = "agent_run_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    agent_name = Column(String(100), nullable=False)
    input_context = Column(Text, nullable=True)
    output_json = Column(Text, nullable=True)
    ran_at = Column(DateTime, default=datetime.utcnow)
    tariff_alert_id = Column(Integer, ForeignKey("tariff_alerts.id"), nullable=True)


class GlobalSupplier(Base):
    """
    Global exporter directory — 25,000 rows seeded from global_exporters_dataset.csv.
    Powers the Supplier Panel (Region → Country → Category → Suppliers).
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
    export_markets = Column(Text, nullable=True)
    certifications = Column(Text, nullable=True)
    supplier_rating = Column(Float, nullable=True)
    payment_terms = Column(String(255), nullable=True)
    lead_time_days = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
