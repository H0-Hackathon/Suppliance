"""
CoastGuard — 5-Agent Tariff Monitoring Pipeline

Mock mode  (USE_MOCK_LLM=true):  hardcoded realistic output, no LLM call.
Real mode  (USE_MOCK_LLM=false): deterministic Agent1/Agent2 + 3 CrewAI agents backed by Gemini.

Agent1 (TariffMonitor) and Agent2 (ImpactCalculator) are deterministic — no LLM
call, no GDELT. They read real collector data (core/monitor_agent.py,
services/impact_service.py) instead of GDELT or an LLM guess. AlternativesFinder,
ImportCompliance, and Adversarial remain Gemini-backed CrewAI agents that reason
over Agent1+Agent2's structured JSON.

Agents:
  1. TariffMonitor       — (deterministic) normalizes tariff/supply-chain events from collectors/*.py JSONL data
  2. ImpactCalculator    — (deterministic) calculates dollar impact on pending orders via ImpactEngine
  3. AlternativesFinder  — finds backup suppliers and alternate sourcing routes
  4. ImportCompliance    — lists required customs documents per alternative
  5. Adversarial         — challenges every recommendation before it reaches the human
"""

import json
import logging
import re
import uuid
from typing import Optional

from config import get_settings
from core.agent_rules import ALTERNATIVES_RULES, COMPLIANCE_RULES, ADVERSARIAL_RULES
from services.coordinates import get_country_coordinates
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
settings = get_settings()

# CrewAI is an optional dependency — only required in real mode
try:
    from crewai import Agent, Task, Crew, LLM
    HAS_CREWAI = True
except ImportError:
    HAS_CREWAI = False


# ── LLM initializer ───────────────────────────────────────────────────────────

def _init_gemini_llm() -> "LLM":
    """
    Build a Gemini LLM instance for CrewAI.

    Requires:
      - crewai installed  (pip install crewai>=1.7.0)
      - GEMINI_API_KEY set in .env
      - google-generativeai installed  (pip install google-generativeai)
    """
    if not HAS_CREWAI:
        raise RuntimeError("CrewAI is not installed. Run: pip install crewai>=1.7.0")

    api_key = settings.gemini_api_key
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. "
            "Add it to backend/.env and set USE_MOCK_LLM=false."
        )

    import os
    os.environ.setdefault("GOOGLE_API_KEY", api_key)

    # Validate the key before building the full crew. CrewAI's LLM expects
    # "gemini/<model>" (LiteLLM provider-prefixed form), but the raw
    # google-generativeai SDK used here for the validation ping wants just
    # "<model>" — strip the "gemini/" prefix so both stay in sync.
    validation_model = settings.gemini_model.removeprefix("gemini/")
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        genai.GenerativeModel(validation_model).generate_content("ping")
        logger.info("Gemini API key validated successfully")
    except Exception as exc:
        raise RuntimeError(f"Gemini API key validation failed: {exc}") from exc

    return LLM(model=settings.gemini_model, api_key=api_key)


# ── Pipeline ──────────────────────────────────────────────────────────────────

class MonitorPipeline:
    """
    Orchestrates the 5-agent tariff monitoring pipeline.

    Usage:
        pipeline = MonitorPipeline()
        result = pipeline.run(customer_id=1, hs_code="6109", supplier_country="VN", db=db)

    Result shape:
        {
            "run_id":          str,
            "customer_id":     int,
            "alerts_generated": int,
            "agent_outputs": {
                "tariff_monitor":     {...},
                "impact_calculator":  {...},
                "alternatives_finder":{...},
                "import_compliance":  {...},
                "adversarial":        {...},
            }
        }
    """

    def __init__(self):
        self._llm = None

    @property
    def llm(self):
        if self._llm is None:
            self._llm = _init_gemini_llm()
        return self._llm

    def run(
        self,
        customer_id: int,
        hs_code: str,
        supplier_country: str,
        db: Optional[Session] = None,
    ) -> dict:
        if settings.use_mock_llm:
            return self._mock_run(customer_id, hs_code, supplier_country, db)
        return self._real_run(customer_id, hs_code, supplier_country, db)

    # ── Mock mode ─────────────────────────────────────────────────────────────

    def _mock_run(
        self,
        customer_id: int,
        hs_code: str,
        supplier_country: str,
        db: Optional[Session],
    ) -> dict:
        """Hardcoded realistic output. ImpactCalculator still queries the real DB."""

        # ImpactCalculator uses real order data when the DB is available
        pending_total, affected_orders = self._get_pending_orders_summary(db, customer_id)
        extra_cost_usd = round(pending_total * 0.25, 2) if pending_total else 10000
        affected_orders = affected_orders or 1

        agent_outputs = {
            "tariff_monitor": {
                "risk_detected": True,
                "event": f"25% tariff added on HS {hs_code} from {supplier_country}",
                "event_type": "TARIFF",
                "country": supplier_country,
                "product": "Textiles",
                "tariff_rate": 25.0,
                "severity": "HIGH",
                "confidence": 0.92,
                "source": "mock",
                "source_url": None,
                "summary": f"A 25% tariff was announced on HS {hs_code} imports from {supplier_country}.",
            },
            "impact_calculator": {
                "affected": True,
                "direct_cost": extra_cost_usd,
                "extra_cost_usd": extra_cost_usd,
                "exposure_score": 100.0,
                "risk_score": round(min(extra_cost_usd / 1000.0, 100.0), 2),
                "severity": "high",
                "affected_orders": affected_orders,
                "eta_risk": "high",
                "supplier_dependency": 0.8,
                "reasons": [
                    f"Event detected affecting {supplier_country} (Textiles)",
                    "25% tariff rate detected (TARIFF)",
                    f"Direct cost = order value x 25% = ${extra_cost_usd:,.2f} across {affected_orders} pending order(s)",
                ],
            },
            "alternatives_finder": {
                "alternatives": [
                    {
                        "rank": 1,
                        "supplier_name": "Dhaka Garments Ltd",
                        "country": "BD",
                        "country_full": "Bangladesh",
                        "source": "internal",
                        "lead_time_weeks": 8,
                        "can_meet_deadline": True,
                        "deadline_reasoning": "8-week lead time fits within the order's delivery window.",
                        "cost_delta_pct": -12,
                        "cost_delta_usd": round(extra_cost_usd * -0.12, 2),
                        "selection_reasoning": "Existing verified supplier in the same product category at lower cost.",
                        "risks": ["Higher minimum order quantity than the current supplier"],
                    },
                    {
                        "rank": 2,
                        "supplier_name": "Mumbai Exports",
                        "country": "IN",
                        "country_full": "India",
                        "source": "estimated",
                        "lead_time_weeks": 5,
                        "can_meet_deadline": True,
                        "deadline_reasoning": "Faster 5-week lead time comfortably meets the deadline.",
                        "cost_delta_pct": 8,
                        "cost_delta_usd": round(extra_cost_usd * 0.08, 2),
                        "selection_reasoning": "Estimated based on known Indian textile manufacturing hubs.",
                        "risks": ["Not yet a verified relationship with this buyer"],
                    },
                ],
                "recommendation_summary": (
                    "Dhaka Garments Ltd (BD) is the strongest option: verified, lower cost, "
                    "and within the delivery window."
                ),
            },
            "import_compliance": {
                "compliance_by_country": {
                    "BD": {
                        "sanctions_clear": True,
                        "sanctions_note": None,
                        "mandatory_documents": [
                            {"document": "Certificate of Origin", "regulatory_basis": "19 CFR 102", "timeline_days": 5},
                            {"document": "Commercial Invoice", "regulatory_basis": "19 CFR 141.86", "timeline_days": 1},
                        ],
                        "conditional_documents": [],
                        "recommended_documents": ["Packing List"],
                        "compliance_timeline_days": 10,
                        "overall_compliance_risk": "low",
                        "compliance_explanation": (
                            "Bangladesh has straightforward textile import requirements once GSP "
                            "eligibility is confirmed."
                        ),
                    },
                    "IN": {
                        "sanctions_clear": True,
                        "sanctions_note": None,
                        "mandatory_documents": [
                            {"document": "Certificate of Origin", "regulatory_basis": "19 CFR 102", "timeline_days": 5},
                            {"document": "BIS Certification", "regulatory_basis": "Bureau of Indian Standards", "timeline_days": 14},
                        ],
                        "conditional_documents": [
                            {"document": "Anti-dumping duty declaration", "condition": "product falls under an active AD order", "regulatory_basis": "19 CFR 351"},
                        ],
                        "recommended_documents": [],
                        "compliance_timeline_days": 14,
                        "overall_compliance_risk": "medium",
                        "compliance_explanation": (
                            "India requires an additional BIS certification step that can extend "
                            "onboarding by up to two weeks."
                        ),
                    },
                },
                "summary": "Bangladesh has the lower compliance burden; India requires extra certification time.",
            },
            "adversarial": {
                "verdict": "CAUTION",
                "flags": [
                    {
                        "flag": "Dhaka Garments Ltd's 8-week lead time is close to the buyer's delivery deadline.",
                        "severity": "medium",
                        "resolution": "Confirm the exact delivery date and consider partial air freight for the first shipment.",
                    },
                ],
                "recommended_action": (
                    "Switch this order to Dhaka Garments Ltd (Bangladesh) and confirm the 8-week "
                    "lead time against your delivery deadline before placing the order."
                ),
                "confidence_in_recommendation": 0.85,
                "reasoning_chain": [
                    "Step 1: Confirmed the 25% tariff directly impacts this customer's pending order.",
                    "Step 2: Identified Dhaka Garments Ltd as a verified, lower-cost alternative supplier.",
                    "Step 3: Flagged the lead time as the main remaining risk and recommended confirming the deadline.",
                ],
            },
        }

        run_id = str(uuid.uuid4())
        self._save_results(
            db=db,
            customer_id=customer_id,
            hs_code=hs_code,
            supplier_country=supplier_country,
            agent_outputs=agent_outputs,
            severity=agent_outputs["impact_calculator"]["severity"],
            summary=agent_outputs["adversarial"]["recommended_action"],
            data_source="mock",
        )

        return {
            "run_id": run_id,
            "customer_id": customer_id,
            "alerts_generated": 1,
            "agent_outputs": agent_outputs,
        }

    # ── Real mode — 5 Gemini-backed CrewAI agents ─────────────────────────────

    def _real_run(
        self,
        customer_id: int,
        hs_code: str,
        supplier_country: str,
        db: Optional[Session],
    ) -> dict:
        if not HAS_CREWAI:
            raise RuntimeError("CrewAI is not installed. Run: pip install crewai>=1.7.0")

        llm = self.llm

        # ── Agent 1: TariffMonitor (deterministic) ───────────────────────────
        # Reads collectors/tariff.py + collectors/monitor.py JSONL output and
        # picks the most relevant normalized event. No LLM call, no GDELT.
        from core.monitor_agent import get_latest_event
        monitor_event = get_latest_event(supplier_country=supplier_country, hs_code=hs_code)

        # ── Agent 2: ImpactCalculator (deterministic) ───────────────────────
        # Runs Agent 1's event through ImpactEngine against this customer's real
        # pending orders in Aurora. No LLM call, no "$40,000" guess.
        from services.impact_service import calculate_impact
        impact_result = calculate_impact(db, customer_id, monitor_event)

        event_country = monitor_event.get("country") or supplier_country
        event_product = monitor_event.get("product") or f"HS {hs_code} goods"
        tariff_rate = monitor_event.get("tariff_rate")
        tariff_desc = f"{tariff_rate:g}%" if tariff_rate is not None else "an unspecified rate"

        # ── Internal alternatives — this buyer's own active suppliers ────────
        # not located in the affected country. AlternativesFinder ranks these
        # real, verified suppliers above any LLM-estimated ones.
        internal_alternatives = self._find_internal_alternatives(db, customer_id, event_country)
        if internal_alternatives:
            internal_alternatives_formatted = "\n".join(
                f"- {a['name']} ({a['country']}), product category: "
                f"{a['product_category'] or 'unspecified'}, reliability score: "
                f"{a['reliability_score']:.0f}/100"
                for a in internal_alternatives
            )
        else:
            internal_alternatives_formatted = (
                "None — this buyer has no other active suppliers outside the affected country."
            )

        # ── Agent 3: AlternativesFinder ───────────────────────────
        alternatives_finder = Agent(
            role="Alternative Supplier Finder",
            goal="Find 2-3 backup suppliers in countries NOT subject to the tariff.",
            backstory=(
                "You are a global supply chain expert with deep knowledge of Asian manufacturing "
                "hubs. When a primary supplier becomes unviable due to tariffs, you rapidly identify "
                "vetted alternatives with realistic lead times, cost comparisons, and minimum order "
                "quantities — ranked by best fit for the buyer's deadline."
            ),
            llm=llm,
            verbose=True,
        )

        # ── Agent 4: ImportCompliance ────────────────────────────
        import_compliance = Agent(
            role="Import Compliance Specialist",
            goal="List the exact US customs documents required for each alternative supplier country.",
            backstory=(
                "You are a licensed US customs broker with 15 years of experience in HS code "
                "classification, country-of-origin rules, and per-country documentation requirements. "
                "You know exactly when a GSP Form A, BIS certification, or phytosanitary certificate "
                "is needed, and you never miss a filing deadline."
            ),
            llm=llm,
            verbose=True,
        )

        # ── Agent 5: Adversarial ───────────────────────────────
        adversarial = Agent(
            role="Risk Challenger",
            goal=(
                "Challenge every recommendation from the other agents. "
                "Flag missed deadlines, unverified suppliers, hidden compliance gaps, "
                "and quality risks before the alert reaches the human decision-maker."
            ),
            backstory=(
                "You are the devil's advocate of the supply chain team. Your only job is to find "
                "holes in the other agents' recommendations. You issue a CLEAR, CAUTION, or BLOCK "
                "verdict with a specific list of flags, a recommended action written for the "
                "business owner, and a short reasoning chain."
            ),
            llm=llm,
            verbose=True,
        )

        # ── Tasks ─────────────────────────────────────────────────────────
        # AlternativesFinder and Adversarial reason over Agent1's detected event
        # and Agent2's deterministic cost numbers — they are told the facts
        # directly rather than asked to "detect" or "calculate" them.
        alternatives_task = Task(
            description=(
                f"{ALTERNATIVES_RULES}\n\n"
                f"A {monitor_event.get('event_type') or 'TARIFF'} event was detected: "
                f"\"{monitor_event.get('event')}\" affecting {event_country} "
                f"({event_product}), tariff rate {tariff_desc}. "
                f"This customer's pending orders show a direct cost impact of "
                f"${impact_result['direct_cost']:,.2f} across {impact_result['affected_orders']} "
                f"order(s), severity={impact_result['severity']}, ETA risk={impact_result['eta_risk']}.\n\n"
                f"Internal alternatives (this buyer's own active suppliers, NOT in {event_country}):\n"
                f"{internal_alternatives_formatted}\n\n"
                "Instructions:\n"
                "1. First evaluate whether any internal alternative above can absorb this order. "
                "State your reasoning in deadline_reasoning / selection_reasoning.\n"
                "2. If fewer than 2 viable alternatives exist, propose additional external options "
                "using your knowledge of manufacturing hubs for this product category. Label these "
                "source=\"estimated\".\n"
                f"3. For each option, assess: can it meet the delivery timeline given ETA risk="
                f"{impact_result['eta_risk']}? what is the cost delta vs. the current supplier? "
                "what compliance complexity should be expected for that country?\n"
                "4. Rank by (1) deadline feasibility, (2) cost delta, (3) compliance simplicity.\n"
                f"5. Do NOT suggest {event_country} as an alternative.\n"
                "6. Return 2-3 ranked alternatives total."
            ),
            agent=alternatives_finder,
            expected_output=(
                'JSON: {"alternatives": [{"rank": 1, "supplier_name": "Dhaka Garments Ltd", '
                '"country": "BD", "country_full": "Bangladesh", "source": "internal", '
                '"lead_time_weeks": 8, "can_meet_deadline": true, '
                '"deadline_reasoning": "...", "cost_delta_pct": -12, "cost_delta_usd": -4800.0, '
                '"selection_reasoning": "...", "risks": ["..."]}], '
                '"recommendation_summary": "..."}'
            ),
        )

        compliance_task = Task(
            description=(
                f"{COMPLIANCE_RULES}\n\n"
                "You are a licensed US customs broker. The buyer is considering switching suppliers "
                f"to avoid a {monitor_event.get('event_type') or 'TARIFF'} event affecting "
                f"{event_country} ({event_product}, HS code {hs_code}).\n\n"
                "For each alternative country (2-letter code) identified in the prior agent's output, "
                "determine:\n"
                "1. Is this country subject to any active US sanctions or trade restrictions relevant "
                "to this HS code?\n"
                f"2. What customs entry documents are MANDATORY for HS code {hs_code} from that country?\n"
                "3. Are there country-specific certifications required (RECOMMENDED or CONDITIONAL)?\n"
                "4. Estimated compliance timeline in days.\n"
                "5. Overall compliance risk: low, medium, or high."
            ),
            agent=import_compliance,
            context=[alternatives_task],
            expected_output=(
                'JSON: {"compliance_by_country": {"BD": {"sanctions_clear": true, '
                '"sanctions_note": null, "mandatory_documents": [{"document": "Certificate of '
                'Origin", "regulatory_basis": "19 CFR 102", "timeline_days": 5}], '
                '"conditional_documents": [], "recommended_documents": [], '
                '"compliance_timeline_days": 10, "overall_compliance_risk": "low", '
                '"compliance_explanation": "..."}}, "summary": "..."}'
            ),
        )

        adversarial_task = Task(
            description=(
                f"{ADVERSARIAL_RULES}\n\n"
                "You are the final decision-maker on this supply chain risk. The underlying event "
                f"is: \"{monitor_event.get('event')}\" (type={monitor_event.get('event_type')}, "
                f"confidence={monitor_event.get('confidence')}, severity={impact_result['severity']}, "
                f"direct cost=${impact_result['direct_cost']:,.2f}, eta_risk={impact_result['eta_risk']}).\n"
                f"Supporting reasons: {'; '.join(impact_result['reasons']) or 'none'}.\n\n"
                "Review the alternatives and compliance outputs above (provided as context) and go "
                "through this challenge checklist:\n"
                "1. Does the top-ranked alternative actually address the ETA risk "
                f"({impact_result['eta_risk']})? If not, flag it.\n"
                "2. Is each alternative's cost estimate based on this buyer's own supplier data "
                "(source=\"internal\") or LLM assumptions (source=\"estimated\")? Flag if assumptions.\n"
                "3. Are any compliance requirements uncertain or marked CONDITIONAL without being "
                "resolved? Flag if so.\n"
                "4. Does the recommended alternative have a verified relationship with this buyer "
                "(source=\"internal\")? Flag if not.\n"
                f"5. Is the detected event's confidence ({monitor_event.get('confidence')}) high "
                "enough (>= 0.6) to justify switching suppliers?\n\n"
                "After the challenge, issue your verdict: CLEAR (proceed, risks manageable), "
                "CAUTION (proceed with specific precautions), or BLOCK (do not proceed until flags "
                "are resolved)."
            ),
            agent=adversarial,
            context=[alternatives_task, compliance_task],
            expected_output=(
                'JSON: {"verdict": "CAUTION", "flags": [{"flag": "...", "severity": "medium", '
                '"resolution": "..."}], "recommended_action": "...", '
                '"confidence_in_recommendation": 0.75, "reasoning_chain": ["Step 1: ...", '
                '"Step 2: ...", "Step 3: ..."]}'
            ),
        )

        # ── Crew kickoff ────────────────────────────────────────────────
        crew = Crew(
            agents=[
                alternatives_finder,
                import_compliance,
                adversarial,
            ],
            tasks=[
                alternatives_task,
                compliance_task,
                adversarial_task,
            ],
            verbose=True,
        )

        try:
            crew.kickoff()
        except Exception as exc:
            logger.error(f"Crew kickoff failed: {exc}")
            raise

        agent_outputs = {
            "tariff_monitor": monitor_event,
            "impact_calculator": impact_result,
            "alternatives_finder": _parse_task_output(alternatives_task),
            "import_compliance": _parse_task_output(compliance_task),
            "adversarial": _parse_task_output(adversarial_task),
        }

        severity = impact_result.get("severity", "medium")
        recommendation = agent_outputs.get("adversarial", {}).get(
            "recommended_action", "Review the alert and take action."
        )

        run_id = str(uuid.uuid4())
        self._save_results(
            db=db,
            customer_id=customer_id,
            hs_code=hs_code,
            supplier_country=supplier_country,
            agent_outputs=agent_outputs,
            severity=severity,
            summary=recommendation,
            data_source="monitor_agent+gemini",
        )

        return {
            "run_id": run_id,
            "customer_id": customer_id,
            "alerts_generated": 1,
            "agent_outputs": agent_outputs,
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _get_pending_orders_summary(
        db: Optional[Session], customer_id: int
    ) -> tuple[float, int]:
        """
        Look up this customer's pending/in-transit orders in Aurora.

        Returns (total_order_value_usd, order_count). Returns (0.0, 0) if
        there's no DB session, the customer has no orders, or the query
        fails for any reason — callers are expected to fall back to a
        demo-friendly default in that case.
        """
        if db is None:
            return 0.0, 0
        try:
            from models import ImportOrder
            orders = (
                db.query(ImportOrder)
                .filter(
                    ImportOrder.customer_id == customer_id,
                    ImportOrder.status.in_(["pending", "in_transit"]),
                )
                .all()
            )
            total = sum(o.order_value_usd for o in orders if o.order_value_usd)
            return float(total), len(orders)
        except Exception as exc:
            logger.warning(f"Pending orders lookup failed: {exc}")
            return 0.0, 0

    @staticmethod
    def _find_internal_alternatives(
        db: Optional[Session], customer_id: int, event_country: Optional[str], limit: int = 3
    ) -> list[dict]:
        """
        This buyer's own active suppliers that are NOT located in the
        affected country — the "internal alternatives" AlternativesFinder
        should rank above any LLM-estimated supplier.
        """
        if db is None:
            return []
        try:
            from models import Supplier
            event_country_lower = (event_country or "").strip().lower()
            suppliers = (
                db.query(Supplier)
                .filter(Supplier.customer_id == customer_id, Supplier.is_active == True)
                .all()
            )
            alternatives = []
            for s in suppliers:
                if event_country_lower and event_country_lower in s.country.lower():
                    continue
                alternatives.append({
                    "name": s.name,
                    "country": s.country,
                    "product_category": s.product_category,
                    "reliability_score": s.reliability_score or 50.0,
                })
            return alternatives[:limit]
        except Exception as exc:
            logger.warning(f"Internal alternatives lookup failed: {exc}")
            return []

    @staticmethod
    def _save_results(
        db: Optional[Session],
        customer_id: int,
        hs_code: str,
        supplier_country: str,
        agent_outputs: dict,
        severity: str,
        summary: str,
        data_source: str,
    ) -> None:
        """
        Persist one monitor run to Aurora as two linked rows:

          1. DisruptionEvent — structured record (lat/lon, hs codes, etc.)
             used by the globe visualization. Coordinates come from the
             hardcoded services/coordinates.py lookup, NOT from the LLM.
          2. TariffAlert — the JSON blob the alert feed UI (AlertCard)
             already knows how to render, now linked back to the
             DisruptionEvent via disruption_event_id.

        No-op if db is None (e.g. unit-testing the pipeline without a
        database).
        """
        if db is None:
            return

        from models import DisruptionEvent, TariffAlert

        tariff_monitor_output = agent_outputs.get("tariff_monitor", {})
        location = get_country_coordinates(supplier_country)

        disruption_event = None
        try:
            disruption_event = DisruptionEvent(
                incident_id=str(uuid.uuid4()),
                event_type="tariff_change",
                title=tariff_monitor_output.get(
                    "event", f"Tariff event detected for HS {hs_code} from {supplier_country}"
                ),
                description=summary,
                location_name=location["location_name"] if location else None,
                latitude=location["latitude"] if location else None,
                longitude=location["longitude"] if location else None,
                hs_codes=[hs_code],
                countries_affected=[supplier_country],
                severity=severity,
                confidence=tariff_monitor_output.get("confidence"),
                source=tariff_monitor_output.get("source", data_source),
                raw_data=agent_outputs,
            )
            db.add(disruption_event)
            db.flush()  # assign disruption_event.id without committing yet
        except Exception as exc:
            logger.error(f"Failed to save DisruptionEvent: {exc}")
            db.rollback()
            disruption_event = None

        try:
            alert = TariffAlert(
                customer_id=customer_id,
                disruption_event_id=disruption_event.id if disruption_event else None,
                alert_type="tariff_change",
                severity=severity,
                summary=summary,
                agent_output=json.dumps(agent_outputs),
                data_source=data_source,
                status="active",
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            logger.info(f"TariffAlert id={alert.id} saved (severity={severity})")
        except Exception as exc:
            logger.error(f"Failed to save TariffAlert: {exc}")
            db.rollback()


def _parse_task_output(task) -> dict:
    """Extract the JSON dict from a CrewAI Task's output field."""
    try:
        raw = task.output.raw if (hasattr(task, "output") and task.output) else ""
        return json.loads(raw)
    except Exception:
        pass
    try:
        raw = task.output.raw if (hasattr(task, "output") and task.output) else ""
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception:
        pass
    return {"raw": str(getattr(getattr(task, "output", None), "raw", ""))}
