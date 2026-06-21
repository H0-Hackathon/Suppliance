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
from core.auth import get_current_user
from models import Customer

router = APIRouter(prefix="/api/v2/monitor", tags=["Monitor"])
settings = get_settings()


@router.post("/run", response_model=MonitorRunResponse)
def run_monitor(payload: MonitorRunRequest = MonitorRunRequest(), db: Session = Depends(get_db), current_customer: Customer = Depends(get_current_user)):
    """
    Trigger one 5-agent pipeline run for the authenticated customer.
    The pipeline derives hs_code and supplier_country from the customer's BusinessProfile.
    Adds one alert; oldest alerts are pruned automatically to keep max 10 per customer.
    """
    customer_id = current_customer.id
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


@router.get("/pipeline-log")
def pipeline_log(since: int = 0, display_only: bool = False):
    """
    Return live pipeline log events for the current run.
    `since`        — number of events already seen by the client (skip these).
    `display_only` — if true, return only events marked display=true (agent steps, phases, results).
                     Omits internal db/rss/buffer events. Use this for the frontend progress view.
    """
    from core.crew_monitor_pipeline import get_pipeline_log
    events = get_pipeline_log()
    if display_only:
        events = [e for e in events if e.get("display")]
    return {"events": events[since:], "total": len(events)}
