"""
CoastGuard — CrewAI Orchestrator

Central entry point for all AI agent pipelines.

Phase 1 (USE_MOCK_LLM=true):  returns hardcoded mock output — no LLM called.
Phase 2 (USE_MOCK_LLM=false): delegates to real Gemini-backed crews.

Pipelines:
  run_monitor()     → 5-agent tariff monitoring  (crew_monitor_pipeline.py)
  check_compliance()→ 5-agent import compliance  (crew_import_compliance.py)
  analyze_docs()    → 3-agent trade doc analysis (crew_trade_docs.py)
"""

import logging
import queue as stdlib_queue
from typing import Optional
from sqlalchemy.orm import Session
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class CrewAIUnavailable(Exception):
    """Raised when CrewAI is not installed or the Gemini key is missing."""


class CrewAIOrchestrator:
    """
    Singleton orchestrator — use get_crew_orchestrator() to obtain the instance.

    All public methods accept a db session and return plain dicts that match
    the Pydantic response schemas in schemas.py.
    """

    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._monitor_pipeline = None
        self._compliance_crew = None
        self._trade_docs_crew = None
        logger.info(
            f"CrewAIOrchestrator ready — mock_llm={settings.use_mock_llm}, "
            f"gemini_key={'set' if settings.gemini_api_key else 'NOT SET'}"
        )

    # ── Public API ────────────────────────────────────────────────────────────

    def run_monitor(
        self,
        customer_id: int,
        hs_code: str,
        supplier_country: str,
        db: Optional[Session] = None,
        articles: Optional[list] = None,
        progress_queue: Optional[stdlib_queue.Queue] = None,
    ) -> dict:
        """
        Run the 5-agent tariff monitoring pipeline.

        articles: pre-collected article dicts (cache + targeted query) from
                  monitor_routes.py. When None (e.g. scheduler-triggered runs),
                  MonitorPipeline falls back to the in-memory cache then JSONL.

        Returns:
            run_id, customer_id, alerts_generated, agent_outputs
        """
        return self._monitor.run(
            customer_id=customer_id,
            hs_code=hs_code,
            supplier_country=supplier_country,
            db=db,
            articles=articles,
            progress_queue=progress_queue,
        )

    def check_compliance(self, hs_code: str, alternatives: list) -> dict:
        """
        Run the 5-agent import compliance check for a list of alternative countries.

        Returns:
            Dict keyed by country code, each value a list of required action items.
        """
        if settings.use_mock_llm:
            from core.crew_import_compliance import ImportComplianceCrew
            return ImportComplianceCrew.mock_compliance(alternatives)
        return self._compliance.check_compliance(hs_code=hs_code, alternatives=alternatives)

    def analyze_docs(
        self,
        document_text: str,
        hs_code: str,
        supplier_country: str = "",
    ) -> dict:
        """
        Run the 3-agent trade document classification and gap analysis.

        Returns:
            doc_type, extracted_fields, required_docs, gaps, completeness_score, recommendations
        """
        if settings.use_mock_llm:
            from core.crew_trade_docs import TradeDocsCrew
            return TradeDocsCrew.mock_analyze(hs_code)
        return self._trade_docs.analyze(
            document_text=document_text,
            hs_code=hs_code,
            supplier_country=supplier_country,
        )

    # ── Lazy-loaded crew instances ─────────────────────────────────────────────

    @property
    def _monitor(self):
        if self._monitor_pipeline is None:
            from core.crew_monitor_pipeline import MonitorPipeline
            self._monitor_pipeline = MonitorPipeline()
        return self._monitor_pipeline

    @property
    def _compliance(self):
        if self._compliance_crew is None:
            from core.crew_import_compliance import ImportComplianceCrew
            self._compliance_crew = ImportComplianceCrew()
        return self._compliance_crew

    @property
    def _trade_docs(self):
        if self._trade_docs_crew is None:
            from core.crew_trade_docs import TradeDocsCrew
            self._trade_docs_crew = TradeDocsCrew()
        return self._trade_docs_crew


def get_crew_orchestrator() -> CrewAIOrchestrator:
    """FastAPI dependency — returns the singleton orchestrator."""
    return CrewAIOrchestrator()
