"""
CoastGuard — Monitor pipeline routes.

Endpoints:
  POST /api/v2/monitor/run      trigger the 5-agent pipeline for a customer + HS code
  GET  /api/v2/monitor/targets  (supplier_country, hs_code) combos to scan for a customer
  GET  /api/v2/monitor/health   pipeline health and mock mode status
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
from database import get_db
from schemas import MonitorRunRequest, MonitorRunResponse
from core.crew_orchestrator import CrewAIOrchestrator
from services.coordinates import get_country_code, get_country_name
from config import get_settings

router = APIRouter(prefix="/api/v2/monitor", tags=["Monitor"])
settings = get_settings()

# Maps a Supplier.product_category (free-text, set at onboarding) to the HS
# chapter (first 2 digits) it corresponds to, so /monitor/targets can pick
# the BusinessProfile.primary_hs_codes entry that's actually relevant to
# that supplier rather than scanning every HS code for every country.
PRODUCT_CATEGORY_TO_HS2 = {
    "textiles": "61",
    "apparel": "61",
    "automotive": "87",
    "electronics": "84",
}


def _hs_code_for_supplier(product_category: str | None, primary_hs_codes: list[str]) -> str | None:
    if not primary_hs_codes:
        return None

    hs2 = PRODUCT_CATEGORY_TO_HS2.get((product_category or "").strip().lower())
    if hs2:
        for code in primary_hs_codes:
            if code.startswith(hs2):
                return code

    return primary_hs_codes[0]


@router.post("/run", response_model=MonitorRunResponse)
def run_monitor(payload: MonitorRunRequest, db: Session = Depends(get_db)):
    """
    Trigger the 5-agent tariff monitoring pipeline.

    The pipeline (MonitorPipeline._save_results) already saves both the
    TariffAlert and its linked DisruptionEvent — this route just forwards
    the request and returns the agent outputs. (Do NOT also create a
    TariffAlert here — that used to double-save every alert.)
    """
    orchestrator = CrewAIOrchestrator()
    result = orchestrator.run_monitor(
        customer_id=payload.customer_id,
        hs_code=payload.hs_code,
        supplier_country=payload.supplier_country,
        db=db,
    )

    return MonitorRunResponse(
        run_id=result["run_id"],
        customer_id=payload.customer_id,
        alerts_generated=result["alerts_generated"],
        agent_outputs=result.get("agent_outputs", {}),
    )


@router.get("/targets")
def get_monitor_targets(customer_id: int, db: Session = Depends(get_db)):
    """
    The (supplier_country, hs_code) combinations "Run Monitor" should scan
    for this customer — one per active supplier, derived from
    BusinessProfile.primary_hs_codes + each Supplier's country/product
    category. Falls back to a single Vietnam/cotton-tee target if the
    customer has no BusinessProfile or no suppliers on file yet.
    """
    profile = (
        db.query(models.BusinessProfile)
        .filter(models.BusinessProfile.customer_id == customer_id)
        .first()
    )
    primary_hs_codes = (profile.primary_hs_codes if profile else None) or ["6109.10"]

    suppliers = (
        db.query(models.Supplier)
        .filter(models.Supplier.customer_id == customer_id, models.Supplier.is_active == True)  # noqa: E712
        .all()
    )

    targets = []
    seen = set()

    for supplier in suppliers:
        country_code = get_country_code(supplier.country) or supplier.country
        hs_code = _hs_code_for_supplier(supplier.product_category, primary_hs_codes)
        if not hs_code:
            continue

        key = (country_code, hs_code)
        if key in seen:
            continue
        seen.add(key)

        targets.append({
            "supplier_country": country_code,
            "country_name": get_country_name(country_code),
            "hs_code": hs_code,
            "supplier_name": supplier.name,
            "product_category": supplier.product_category,
        })

    if not targets:
        targets.append({
            "supplier_country": "VN",
            "country_name": "Vietnam",
            "hs_code": "6109.10",
            "supplier_name": None,
            "product_category": None,
        })

    return targets


@router.get("/health")
def monitor_health():
    """Returns mock mode status and which API keys are configured."""
    return {
        "status": "ok",
        "mock_mode": settings.use_mock_llm,
        "gemini_key_set": bool(settings.gemini_api_key),
        "usitc_key_set": bool(settings.usitc_api_key),
        "gdelt_key_set": bool(settings.gdelt_api_key),
    }
