"""
CoastGuard — Monitor pipeline routes.

Endpoints:
  POST /api/v2/monitor/run       trigger one 5-agent pipeline run for the authenticated customer
  GET  /api/v2/monitor/health    pipeline health and mock mode status
  GET  /api/v2/monitor/pipeline-log  live progress events for the authenticated customer's latest run
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Customer
from schemas import MonitorRunResponse
from core.crew_orchestrator import CrewAIOrchestrator
from core.auth import get_current_user
from config import get_settings

router = APIRouter(prefix="/api/v2/monitor", tags=["Monitor"])
settings = get_settings()


@router.post("/run", response_model=MonitorRunResponse)
def run_monitor(
    current_user: Customer = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Trigger one 5-agent pipeline run for the authenticated customer.
    The pipeline derives hs_code and supplier_country from the customer's BusinessProfile.
    Adds one alert; oldest alerts are pruned automatically to keep max 10 per customer.
    """
    from core.crew_monitor_pipeline import clear_pipeline_log, PipelineBusyError
    clear_pipeline_log(current_user.id)
    orchestrator = CrewAIOrchestrator()
    try:
        result = orchestrator.run_monitor(customer_id=current_user.id, db=db)
    except PipelineBusyError:
        raise HTTPException(status_code=429, detail="A pipeline run is already in progress. Try again shortly.")

    return MonitorRunResponse(
        run_id=result["run_id"],
        customer_id=current_user.id,
        alerts_generated=result["alerts_generated"],
        agent_outputs=result.get("agent_outputs", {}),
    )


@router.get("/health")
def monitor_health():
    return {
        "status": "ok",
        "mock_mode": settings.use_mock_llm,
        "gemini_key_set": bool(settings.gemini_api_key),
    }


@router.get("/pipeline-log")
def pipeline_log(
    since: int = 0,
    display_only: bool = False,
    current_user: Customer = Depends(get_current_user),
):
    """
    Return live pipeline log events for the authenticated customer's latest run.
    `since`        — number of events already seen by the client (skip these).
    `display_only` — if true, return only events marked display=true (agent steps, phases, results).
                     Omits internal db/rss/buffer events. Use this for the frontend progress view.
    """
    from core.crew_monitor_pipeline import get_pipeline_log
    events = get_pipeline_log(current_user.id)
    if display_only:
        events = [e for e in events if e.get("display")]
    return {"events": events[since:], "total": len(events)}
