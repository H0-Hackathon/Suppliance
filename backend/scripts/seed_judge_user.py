"""
Seed a judge/demo login account — runs against the real Aurora database.

Creates:
  - A Clerk user (email + password) via the Clerk Management API
  - A fully populated Customer record linked to that Clerk user
  - BusinessProfile, Suppliers (3), Products (2), ImportOrders (3)
  - DisruptionEvent + TariffAlert (active, high-severity, full agent output)
  - 3 HistoricalImpact rows (for agent calibration)
  - 1 AgentRun (completed)
  - 5 PipelineHeadline rows (live trade wire)
  - 2 SupplierRecommendation rows

Safe to re-run — idempotent on Clerk user and Customer row.

Usage:
    cd backend
    python scripts/seed_judge_user.py
"""

import json
import os
import sys
import uuid
from datetime import datetime, timedelta

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import get_settings
from database import SessionLocal, engine, Base
import models  # noqa: F401

Base.metadata.create_all(bind=engine)

# ─────────────────────────────────────────────────────────────────────────────
# Judge credentials — communicate these to judges
# ─────────────────────────────────────────────────────────────────────────────
JUDGE_EMAIL    = "judge@suppliance.io"
JUDGE_PASSWORD = "SupplanceH0!"
JUDGE_FIRST    = "Demo"
JUDGE_LAST     = "Judge"

# ─────────────────────────────────────────────────────────────────────────────
# Step 1 — Create the Clerk user via Management API
# ─────────────────────────────────────────────────────────────────────────────

def create_clerk_user(clerk_secret_key: str) -> str:
    """
    Create a Clerk user with email + password via the Management API.
    Returns the Clerk user ID (starts with 'user_...').
    If the user already exists (409), fetches their ID instead.
    """
    print(f"\n[Clerk] Creating user: {JUDGE_EMAIL}")
    headers = {
        "Authorization": f"Bearer {clerk_secret_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "email_address": [JUDGE_EMAIL],
        "password": JUDGE_PASSWORD,
        "first_name": JUDGE_FIRST,
        "last_name": JUDGE_LAST,
        "username": "judge_demo",
        "skip_password_checks": False,
        "skip_legal_checks": True,
    }

    resp = requests.post(
        "https://api.clerk.com/v1/users",
        headers=headers,
        json=payload,
        timeout=15,
    )

    if resp.status_code == 200:
        data = resp.json()
        clerk_id = data["id"]
        print(f"[Clerk] User created: {clerk_id}")
        return clerk_id

    if resp.status_code == 422:
        # User likely already exists — search by email
        print(f"[Clerk] User may already exist (422). Searching by email...")
        search = requests.get(
            "https://api.clerk.com/v1/users",
            headers={"Authorization": f"Bearer {clerk_secret_key}"},
            params={"email_address": JUDGE_EMAIL},
            timeout=10,
        )
        if search.status_code == 200:
            users = search.json()
            if users:
                clerk_id = users[0]["id"]
                print(f"[Clerk] Found existing user: {clerk_id}")
                return clerk_id

    raise RuntimeError(
        f"[Clerk] Failed to create/find user. Status {resp.status_code}: {resp.text[:400]}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Step 2 — Seed all Aurora database records
# ─────────────────────────────────────────────────────────────────────────────

AGENT_OUTPUT = {
    "tariff_monitor": {
        "risk_detected": True,
        "event": "US Commerce Dept proposes 45% tariff on Taiwan-origin semiconductors (HS 8542.31) effective 60 days, citing national-security review under Section 232.",
        "event_type": "tariff",
        "confidence": 0.91,
        "source": "U.S. Trade Representative",
        "affected_countries": ["Taiwan"],
        "affected_hs_codes": ["8542.31"],
        "affected_product_name": "Integrated Circuits",
        "tariff_rate": 45,
        "risk_source": "rss",
    },
    "impact_calculator": {
        "extra_cost_usd": 38250,
        "severity": "high",
        "affected_orders": 2,
        "company": "Pacific Ridge Electronics LLC",
        "historical_basis": "Based on 4 similar semiconductor tariff events — average actual cost 44% above naive order × rate projection.",
    },
    "alternatives_finder": {
        "options": [
            {
                "supplier": "Bangalore Chip Works",
                "country": "India",
                "lead_time_weeks": 6,
                "cost_delta_pct": -8,
                "source": "global_suppliers_db",
                "stability_note": "India-US ITEC framework active; no active port disruptions.",
            },
            {
                "supplier": "Penang Precision Components",
                "country": "Malaysia",
                "lead_time_weeks": 4,
                "cost_delta_pct": 3,
                "source": "global_suppliers_db",
                "stability_note": "Penang Free Trade Zone — 0% FTZ duty on electronics components for US export.",
            },
        ]
    },
    "import_compliance": {
        "no_viable_option": False,
        "recommended_supplier": "Penang Precision Components",
        "recommended_country": "Malaysia",
        "lead_time_weeks": 4,
        "cost_delta_pct": 3,
        "source": "global_suppliers_db",
        "compliance_feasibility": "high",
        "required_documents": [
            "Certificate of Origin (Malaysia — eligible for US-Malaysia MFN rate)",
            "Commercial Invoice (must itemize HS 8542.31 unit values)",
            "Packing List",
            "ISF 10+2 (file 24h before vessel departure)",
        ],
        "rationale": "Fastest lead time in pool with no compliance blocks and a favorable FTZ duty rate.",
        "risk_factors": [
            "Verify Malaysia certificate of origin is supplier-issued, not self-certified.",
        ],
    },
    "adversarial": {
        "verdict": "CAUTION",
        "flags": [
            "Tariff effective date is 60 days — your Taiwan order (due in 45 days) falls inside the window.",
            "Penang supplier is new to this customer; request a sample order before committing full volume.",
        ],
        "recommendation": "Expedite the Taiwan order to ship before the 60-day effective date while placing a trial order with Penang.",
        "confidence": 0.82,
    },
}


def seed_db(db, clerk_id: str) -> None:
    from models import (
        Customer, BusinessProfile, Supplier, Product, ImportOrder,
        TariffAlert, DisruptionEvent, HistoricalImpact, AgentRun,
        PipelineHeadline, SupplierRecommendation,
    )

    # ── Customer ──────────────────────────────────────────────────────────────
    customer = db.query(Customer).filter(Customer.clerk_id == clerk_id).first()
    if not customer:
        customer = db.query(Customer).filter(Customer.email == JUDGE_EMAIL).first()

    if customer:
        print(f"[DB] Customer already exists (id={customer.id}) — skipping creation.")
    else:
        customer = Customer(
            clerk_id=clerk_id,
            name="Demo Judge",
            email=JUDGE_EMAIL,
            company_name="Pacific Ridge Electronics LLC",
            industry="Consumer Electronics",
            location="San Francisco, CA",
            years_in_business=7,
            average_revenue="$1M–$5M",
            is_active=True,
            is_verified=True,
            trial_expires_at=datetime.utcnow() + timedelta(days=365),
            subscription_plan="pro",
            subscription_expires_at=datetime.utcnow() + timedelta(days=365),
        )
        db.add(customer)
        db.flush()
        print(f"[DB] Customer created (id={customer.id})")

    cid = customer.id

    # ── BusinessProfile ───────────────────────────────────────────────────────
    existing_bp = db.query(BusinessProfile).filter(BusinessProfile.customer_id == cid).first()
    if not existing_bp:
        bp = BusinessProfile(
            customer_id=cid,
            business_type="Electronics Importer",
            annual_import_volume_usd=1_850_000.0,
            typical_order_value_usd=85_000.0,
            avg_lead_time_days=42,
            min_supplier_rating=3.5,
            primary_hs_codes=["8542.31", "8534.00"],
            primary_origin_countries=["Taiwan", "Vietnam", "South Korea"],
            destination_country="United States",
            destination_port="Port of Los Angeles",
            import_region="East Asia",
            risk_tolerance="medium",
            product_categories=["Semiconductors & ICs", "Printed Circuit Boards"],
            product_descriptions=[
                "Integrated circuits — CMOS logic, memory, and microcontrollers imported for assembly",
                "Bare printed circuit boards (PCBs) for consumer electronics manufacturing",
            ],
            rss_keywords=[
                "semiconductor tariff", "integrated circuit import", "Taiwan chip",
                "PCB supply chain", "electronics component shortage", "Section 232",
            ],
            compliance_notes=(
                "Taiwan: standard CoO + commercial invoice. "
                "Vietnam: GSP-eligible for some HS chapters; verify per shipment. "
                "South Korea: KORUS FTA — CoO required for 0% rate. "
                "ISF 10+2 required for all ocean shipments 24h before departure. "
                "ECCN 3A001 check required for advanced ICs (EAR Part 774)."
            ),
            preferred_alternative_regions=["South Asia", "Southeast Asia"],
            preferred_alternative_countries=["India", "Malaysia", "Thailand"],
        )
        db.add(bp)
        print(f"[DB] BusinessProfile created")

    # ── Suppliers ─────────────────────────────────────────────────────────────
    if db.query(Supplier).filter(Supplier.customer_id == cid).count() == 0:
        suppliers = [
            Supplier(customer_id=cid, name="Taiwan Semiconductor Parts Co.",
                     country="Taiwan", product_category="Semiconductors & ICs",
                     contact_email="export@twsemiparts.com.tw", reliability_score=82.0, is_active=True),
            Supplier(customer_id=cid, name="Ho Chi Minh Circuit Works",
                     country="Vietnam", product_category="Printed Circuit Boards",
                     contact_email="sales@hcmcircuit.vn", reliability_score=71.0, is_active=True),
            Supplier(customer_id=cid, name="Seoul Components Ltd",
                     country="South Korea", product_category="Semiconductors & ICs",
                     contact_email="export@seoulcomp.kr", reliability_score=78.0, is_active=True),
        ]
        for s in suppliers:
            db.add(s)
        db.flush()
        print(f"[DB] 3 Suppliers created")
    else:
        print(f"[DB] Suppliers already exist — skipping")

    # ── Products ──────────────────────────────────────────────────────────────
    if db.query(Product).filter(Product.customer_id == cid).count() == 0:
        products = [
            Product(customer_id=cid, hs_code="8542.31", description="Integrated Circuits — CMOS logic & memory",
                    unit_value_usd=12.50, import_country="Taiwan"),
            Product(customer_id=cid, hs_code="8534.00", description="Printed Circuit Boards (bare)",
                    unit_value_usd=8.20, import_country="Vietnam"),
        ]
        for p in products:
            db.add(p)
        db.flush()
        print(f"[DB] 2 Products created")

    all_suppliers = db.query(Supplier).filter(Supplier.customer_id == cid).all()
    all_products  = db.query(Product).filter(Product.customer_id == cid).all()
    sup_tw = next((s for s in all_suppliers if "Taiwan" in s.country), all_suppliers[0])
    sup_vn = next((s for s in all_suppliers if "Vietnam" in s.country), all_suppliers[0])
    prod_ic  = next((p for p in all_products if "8542" in p.hs_code), all_products[0])
    prod_pcb = next((p for p in all_products if "8534" in p.hs_code), all_products[0])

    # ── ImportOrders ──────────────────────────────────────────────────────────
    if db.query(ImportOrder).filter(ImportOrder.customer_id == cid).count() == 0:
        orders = [
            ImportOrder(customer_id=cid, supplier_id=sup_tw.id, product_id=prod_ic.id,
                        order_value_usd=85_000.0, quantity=6_800,
                        expected_delivery_date=datetime.utcnow() + timedelta(days=45),
                        status="pending"),
            ImportOrder(customer_id=cid, supplier_id=sup_vn.id, product_id=prod_pcb.id,
                        order_value_usd=42_000.0, quantity=5_120,
                        expected_delivery_date=datetime.utcnow() + timedelta(days=30),
                        status="in_transit"),
            ImportOrder(customer_id=cid, supplier_id=sup_tw.id, product_id=prod_ic.id,
                        order_value_usd=68_000.0, quantity=5_440,
                        expected_delivery_date=datetime.utcnow() - timedelta(days=14),
                        status="completed"),
        ]
        for o in orders:
            db.add(o)
        db.flush()
        print(f"[DB] 3 ImportOrders created")

    all_orders = db.query(ImportOrder).filter(ImportOrder.customer_id == cid).all()
    pending_order = next((o for o in all_orders if o.status == "pending"), all_orders[0])

    # ── DisruptionEvent ───────────────────────────────────────────────────────
    incident_id = f"INC-JUDGE-{cid}-SEMI-2026"
    ev = db.query(DisruptionEvent).filter(DisruptionEvent.incident_id == incident_id).first()
    if not ev:
        ev = DisruptionEvent(
            incident_id=incident_id,
            event_type="tariff",
            title="US 45% Semiconductor Tariff — Taiwan HS 8542.31",
            description=(
                "The US Commerce Department issued a Federal Register notice proposing a 45% Section 232 tariff "
                "on Taiwan-origin integrated circuits (HS 8542.31), effective 60 days from publication. "
                "The tariff targets advanced CMOS logic and memory ICs. Affected importers have a 30-day "
                "comment period before the final rule is published."
            ),
            location_name="Taiwan",
            latitude=23.7, longitude=120.9,
            hs_codes=["8542.31", "8542.32"],
            countries_affected=["Taiwan"],
            severity="high",
            confidence=0.91,
            source="U.S. Trade Representative",
            raw_data={"tariff_rate": 45, "section": "232", "comment_period_days": 30},
            detected_at=datetime.utcnow() - timedelta(hours=3),
        )
        db.add(ev)
        db.flush()
        print(f"[DB] DisruptionEvent created (id={ev.id})")

    # ── TariffAlert ───────────────────────────────────────────────────────────
    alert = db.query(TariffAlert).filter(
        TariffAlert.customer_id == cid,
        TariffAlert.disruption_event_id == ev.id,
    ).first()
    if not alert:
        alert = TariffAlert(
            customer_id=cid,
            order_id=pending_order.id,
            disruption_event_id=ev.id,
            alert_type="tariff_change",
            severity="high",
            summary=(
                "Proposed 45% US tariff on Taiwan semiconductors (HS 8542.31) would add ~$38,250 to your "
                "pending $85,000 Taiwan order. Expedite shipment before effective date or switch to "
                "Penang Precision Components (Malaysia, 4-week lead time, +3% cost)."
            ),
            agent_output=json.dumps(AGENT_OUTPUT),
            data_source="rss",
            status="active",
        )
        db.add(alert)
        db.flush()
        print(f"[DB] TariffAlert created (id={alert.id})")

    # ── HistoricalImpacts ─────────────────────────────────────────────────────
    if db.query(HistoricalImpact).filter(HistoricalImpact.customer_id == cid).count() == 0:
        run_base = f"RUN-JUDGE-HIST-{cid}"
        impacts = [
            HistoricalImpact(
                event_type="tariff", country="China", product="Integrated Circuits",
                actual_loss=52_000.0, delay_days=18, confidence=0.88,
                event_text="Section 301 List 3 expansion added 25% duty on HS 8542.31 from China.",
                run_id=f"{run_base}-001", customer_id=cid,
                severity="high", adversarial_verdict="CLEAR",
                affected_hs_codes=["8542.31"], affected_countries=["China"],
                articles_matched=4, source_credibility="ustr",
                signal_age_hours=2.1, risk_source="rss",
                supplier_alternatives_found=2, best_alternative_lead_time_weeks=5,
                created_at=datetime.utcnow() - timedelta(days=180),
            ),
            HistoricalImpact(
                event_type="port_disruption", country="Taiwan", product="Integrated Circuits",
                actual_loss=14_200.0, delay_days=8, confidence=0.76,
                event_text="Typhoon Khanun forced Kaohsiung port closure for 4 days, delaying 3 shipments.",
                run_id=f"{run_base}-002", customer_id=cid,
                severity="medium", adversarial_verdict="CAUTION",
                affected_hs_codes=["8542.31", "8534.00"], affected_countries=["Taiwan"],
                articles_matched=3, source_credibility="",
                signal_age_hours=6.3, risk_source="rss",
                supplier_alternatives_found=1, best_alternative_lead_time_weeks=3,
                created_at=datetime.utcnow() - timedelta(days=94),
            ),
            HistoricalImpact(
                event_type="geopolitical", country="South Korea", product="Semiconductors",
                actual_loss=8_750.0, delay_days=5, confidence=0.64,
                event_text="KOSPI market disruption following brief government crisis increased shipping insurance rates.",
                run_id=f"{run_base}-003", customer_id=cid,
                severity="low", adversarial_verdict="CLEAR",
                affected_hs_codes=["8542.31"], affected_countries=["South Korea"],
                articles_matched=2, source_credibility="",
                signal_age_hours=12.0, risk_source="rss",
                supplier_alternatives_found=3, best_alternative_lead_time_weeks=4,
                created_at=datetime.utcnow() - timedelta(days=42),
            ),
        ]
        for hi in impacts:
            db.add(hi)
        print(f"[DB] 3 HistoricalImpact rows created")

    # ── AgentRun ──────────────────────────────────────────────────────────────
    run_id = f"RUN-JUDGE-LIVE-{cid}-{uuid.uuid4().hex[:8]}"
    if db.query(AgentRun).filter(AgentRun.customer_id == cid).count() == 0:
        agent_run = AgentRun(
            run_id=run_id,
            customer_id=cid,
            started_at=datetime.utcnow() - timedelta(minutes=12),
            completed_at=datetime.utcnow() - timedelta(minutes=4),
            status="completed",
            model_used="bedrock/anthropic.claude-3-haiku-20240307-v1:0",
            articles_matched=5,
            alerts_generated=1,
            adversarial_verdict="CAUTION",
            severity="high",
            extra_cost_usd=38_250.0,
            event_type="tariff",
            affected_countries=["Taiwan"],
        )
        db.add(agent_run)
        print(f"[DB] AgentRun created (run_id={run_id})")
    else:
        run_id = db.query(AgentRun).filter(AgentRun.customer_id == cid).first().run_id

    # ── PipelineHeadlines ─────────────────────────────────────────────────────
    if db.query(PipelineHeadline).filter(PipelineHeadline.customer_id == cid).count() == 0:
        headlines = [
            ("US mulls 45% tariff on Taiwan chips amid Section 232 semiconductor review",
             "https://www.ustr.gov/semiconductor-tariff-review-2026",
             "U.S. Trade Representative", "Tariffs", "Taiwan", 28),
            ("TSMC shipments could slow as US import scrutiny tightens on advanced ICs",
             "https://gcaptain.com/tsmc-us-import-scrutiny-2026",
             "gCaptain", "Supply Chain", "Taiwan", 22),
            ("Penang Free Trade Zone reports 18% YoY growth in electronics exports to US",
             "https://asia.nikkei.com/penang-ftz-growth-2026",
             "Nikkei Asia", "Supply Chain", "Malaysia", 19),
            ("Vietnam circuit board exports hit record high as buyers diversify from Taiwan",
             "https://www.supplychaindive.com/vietnam-pcb-record-2026",
             "Supply Chain Dive", "Supply Chain", "Vietnam", 15),
            ("ISF 10+2 enforcement update: CBP announces stricter penalties for late filings",
             "https://www.cbp.gov/isf-enforcement-update-2026",
             "U.S. Customs and Border Protection", "Customs", None, 12),
        ]
        for title, url, source, cat, country, score in headlines:
            db.add(PipelineHeadline(
                run_id=run_id, customer_id=cid,
                title=title, url=url, source=source,
                published_at="Mon, 24 Jun 2026 09:00:00 +0000",
                published_ts=1750762800.0,
                agent_target="tariff_monitor",
                category=cat, country_mentioned=country,
                relevance_score=score,
            ))
        print(f"[DB] 5 PipelineHeadlines created")

    # ── SupplierRecommendations ───────────────────────────────────────────────
    if db.query(SupplierRecommendation).filter(SupplierRecommendation.customer_id == cid).count() == 0:
        recs = [
            SupplierRecommendation(
                alert_id=alert.id, customer_id=cid, run_id=run_id,
                supplier_name="Penang Precision Components", country="Malaysia",
                lead_time_weeks=4, cost_delta_pct=3,
                source="global_suppliers_db", adversarial_verdict="CAUTION",
            ),
            SupplierRecommendation(
                alert_id=alert.id, customer_id=cid, run_id=run_id,
                supplier_name="Bangalore Chip Works", country="India",
                lead_time_weeks=6, cost_delta_pct=-8,
                source="global_suppliers_db", adversarial_verdict="CAUTION",
            ),
        ]
        for r in recs:
            db.add(r)
        print(f"[DB] 2 SupplierRecommendations created")

    db.commit()
    print(f"\n[DB] All records committed to Aurora.")


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main():
    settings = get_settings()

    if not settings.clerk_secret_key:
        print("ERROR: CLERK_SECRET_KEY is not set in backend/.env")
        sys.exit(1)

    clerk_id = create_clerk_user(settings.clerk_secret_key)

    db = SessionLocal()
    try:
        seed_db(db, clerk_id)
    finally:
        db.close()

    print("\n" + "=" * 60)
    print("  JUDGE LOGIN CREDENTIALS")
    print("=" * 60)
    print(f"  URL      : http://localhost:5173  (or the deployed URL)")
    print(f"  Email    : {JUDGE_EMAIL}")
    print(f"  Password : {JUDGE_PASSWORD}")
    print(f"  Company  : Pacific Ridge Electronics LLC")
    print(f"  Clerk ID : {clerk_id}")
    print("=" * 60)
    print("\n  The account has been pre-populated with:")
    print("    - 3 suppliers (Taiwan, Vietnam, South Korea)")
    print("    - 2 products (Integrated Circuits HS 8542.31, PCBs HS 8534.00)")
    print("    - 3 import orders ($85k + $42k pending, 1 completed)")
    print("    - 1 active high-severity tariff alert (45% Taiwan semiconductor tariff)")
    print("    - 3 historical impact records (for agent calibration)")
    print("    - Live trade wire headlines")
    print()


if __name__ == "__main__":
    main()
