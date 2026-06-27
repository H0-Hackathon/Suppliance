"""
CoastGuard — Monitor pipeline routes.

Endpoints:
  POST /api/v2/monitor/run            trigger one 5-agent pipeline run for the active customer
  GET  /api/v2/monitor/health         pipeline health and mock mode status
  GET  /api/v2/monitor/startup-status current state of the 3 startup pipeline runs
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from schemas import MonitorRunRequest, MonitorRunResponse
from core.crew_orchestrator import CrewAIOrchestrator
from config import get_settings

router = APIRouter(prefix="/api/v2/monitor", tags=["Monitor"])
settings = get_settings()


@router.post("/run", response_model=MonitorRunResponse)
def run_monitor(payload: MonitorRunRequest = MonitorRunRequest(), db: Session = Depends(get_db)):
    """
    Trigger one 5-agent pipeline run for the active customer.
    The pipeline derives hs_code and supplier_country from the customer's BusinessProfile.
    Adds one alert; oldest alerts are pruned automatically to keep max 10 per customer.
    """
    customer_id = payload.customer_id or settings.active_customer_id
    from core.crew_monitor_pipeline import clear_pipeline_log
    clear_pipeline_log()
    orchestrator = CrewAIOrchestrator()
    result = orchestrator.run_monitor(customer_id=customer_id, db=db)

    return MonitorRunResponse(
        run_id=result["run_id"],
        customer_id=customer_id,
        alerts_generated=result["alerts_generated"],
        agent_outputs=result.get("agent_outputs", {}),
    )


@router.get("/health")
def monitor_health():
    return {
        "status": "ok",
        "mock_mode": settings.use_mock_llm,
        "active_customer_id": settings.active_customer_id,
        "gemini_key_set": bool(settings.gemini_api_key),
    }


@router.get("/startup-status")
def startup_status():
    """
    Poll this endpoint to check whether the 3 startup pipeline runs have finished.
    The frontend shows a loading state until running=False and completed=3.
    """
    from main import startup_pipeline_status
    return startup_pipeline_status


@router.get("/targets")
def get_monitor_targets(customer_id: int = None, db: Session = Depends(get_db)):
    """
    Return the countries and HS codes to scan for a customer.
    Used by the frontend to trigger the SSE pipeline per target.
    """
    customer_id = customer_id or settings.active_customer_id
    from models import Product, Supplier
    
    products = db.query(Product).filter(Product.customer_id == customer_id).all()
    suppliers = db.query(Supplier).filter(Supplier.customer_id == customer_id).all()
    
    targets = []
    for p in products:
        matching_supplier = next((s for s in suppliers if s.country == p.import_country), None)
        targets.append({
            "supplier_country": p.import_country or "Unknown",
            "country_name": p.import_country or "Unknown",
            "hs_code": p.hs_code,
            "supplier_name": matching_supplier.name if matching_supplier else None,
            "product_category": matching_supplier.product_category if matching_supplier else None
        })
        
    return targets


@router.get("/pipeline-log")
def pipeline_log(since: int = 0):
    """
    Return live pipeline log events for the current run.
    `since` is the number of events to skip (client sends back the count it already has).
    Frontend polls this every 1.5s during loading to show real-time agent activity.
    """
    from core.crew_monitor_pipeline import get_pipeline_log
    events = get_pipeline_log()
    return {"events": events[since:], "total": len(events)}
