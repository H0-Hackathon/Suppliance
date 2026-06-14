"""
CoastGuard — 5-Agent Tariff Monitoring Pipeline

Mock mode  (USE_MOCK_LLM=true):  hardcoded realistic output, no LLM call.
Real mode  (USE_MOCK_LLM=false): 5 CrewAI agents backed by Gemini.

Real tools (USE_REAL_TOOLS=true): the TariffMonitor agent additionally gets a
GDELT news-search tool (see services/gdelt.py) so its "risk_detected" output
is grounded in real headlines instead of pure LLM guesswork. This is a
separate flag from USE_MOCK_LLM so the two can be mixed during a demo, e.g.
real GDELT headlines + mocked LLM reasoning (free/instant), or real LLM +
mocked tools.

Agents:
  1. TariffMonitor       — detects risk events from GDELT news (+ optionally USITC / Sentinel Hub later)
  2. ImpactCalculator    — calculates dollar impact on pending orders in the DB
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
from services.coordinates import get_country_coordinates
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
settings = get_settings()

# CrewAI is an optional dependency — only required in real mode
try:
    from crewai import Agent, Task, Crew, LLM
    from crewai.tools import tool
    HAS_CREWAI = True
except ImportError:
    HAS_CREWAI = False


# ── GDELT tool ──────────────────────────────────────────────────────────────
# Wrapped as a CrewAI @tool so the TariffMonitor agent can call it directly.
# Only registered on the agent when USE_REAL_TOOLS=true (see _real_run below) —
# wrapping it here unconditionally is fine because @tool just builds a
# CrewAI Tool object, it doesn't make a network call until the agent uses it.
if HAS_CREWAI:
    @tool("GDELT Disruption Search")
    def gdelt_search_tool(country: str) -> str:
        """Search GDELT for recent news about tariffs, port disruptions, strikes,
        sanctions, or other supply-chain risks affecting a country. Pass a
        2-letter ISO country code (e.g. 'VN' for Vietnam). Returns a JSON list
        of recent news articles with title, url, seendate, and source_country."""
        from services.gdelt import search_disruption_events
        return json.dumps(search_disruption_events(country))


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
                "confidence": 0.92,
                "source": "mock_usitc",
            },
            "impact_calculator": {
                "extra_cost_usd": extra_cost_usd,
                "severity": "high",
                "affected_orders": affected_orders,
            },
            "alternatives_finder": {
                "options": [
                    {
                        "supplier": "Dhaka Garments Ltd",
                        "country": "BD",
                        "lead_time_weeks": 8,
                        "cost_delta_pct": -12,
                    },
                    {
                        "supplier": "Mumbai Exports",
                        "country": "IN",
                        "lead_time_weeks": 5,
                        "cost_delta_pct": 8,
                    },
                ]
            },
            "import_compliance": {
                "BD": ["Certificate of Origin", "Commercial Invoice update"],
                "IN": ["BIS certification check", "Certificate of Origin"],
            },
            "adversarial": {
                "verdict": "CAUTION",
                "flags": ["BD option misses Aug 1 deadline by 1 week"],
                "recommendation": (
                    "Use Mumbai Exports (IN). "
                    "Negotiate 1-week delivery extension with buyer before committing."
                ),
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
            summary=agent_outputs["adversarial"]["recommendation"],
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

        # ── Agent 1: TariffMonitor ─────────────────────────────────────────────
        # When USE_REAL_TOOLS=true, this agent gets a real GDELT search tool so
        # it can ground its answer in actual news headlines instead of pure
        # LLM guesswork. When false (default), it reasons from its backstory
        # alone — same behavior as before this feature was added.
        monitor_tools = [gdelt_search_tool] if settings.use_real_tools else []

        tariff_monitor = Agent(
            role="Tariff Risk Monitor",
            goal=(
                f"Detect tariff changes, port disruptions, and geopolitical events "
                f"affecting US SMB importers sourcing HS {hs_code} from {supplier_country}."
            ),
            backstory=(
                "You are a senior trade analyst who monitors USITC DataWeb, GDELT news feeds, "
                "and Sentinel Hub satellite imagery. You excel at spotting early signals of "
                "tariff changes and supply-chain disruptions that could financially hurt small "
                "importers before they check their email."
            ),
            tools=monitor_tools,
            llm=llm,
            verbose=True,
        )

        # ── Agent 2: ImpactCalculator ──────────────────────────────────────────
        impact_calculator = Agent(
            role="Financial Impact Calculator",
            goal="Calculate the exact dollar impact of a tariff event on pending import orders.",
            backstory=(
                "You are a financial analyst specializing in import cost modeling for SMBs. "
                "Given a tariff rate change and pending order values, you calculate the extra cost "
                "and classify severity: low (<5% increase), medium (5–20%), high (>20%), "
                "or critical (order cannot be fulfilled as planned)."
            ),
            llm=llm,
            verbose=True,
        )

        # ── Agent 3: AlternativesFinder ───────────────────────────────────────
        alternatives_finder = Agent(
            role="Alternative Supplier Finder",
            goal="Find 2–3 backup suppliers in countries NOT subject to the tariff.",
            backstory=(
                "You are a global supply chain expert with deep knowledge of Asian manufacturing "
                "hubs. When a primary supplier becomes unviable due to tariffs, you rapidly identify "
                "vetted alternatives with realistic lead times, cost comparisons, and minimum order "
                "quantities — ranked by best fit for the buyer's deadline."
            ),
            llm=llm,
            verbose=True,
        )

        # ── Agent 4: ImportCompliance ──────────────────────────────────────────
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

        # ── Agent 5: Adversarial ───────────────────────────────────────────────
        adversarial = Agent(
            role="Risk Challenger",
            goal=(
                "Challenge every recommendation from the other 4 agents. "
                "Flag missed deadlines, unverified suppliers, hidden compliance gaps, "
                "and quality risks before the alert reaches the human decision-maker."
            ),
            backstory=(
                "You are the devil's advocate of the supply chain team. Your only job is to find "
                "holes in the other agents' recommendations. You issue a CLEAR, CAUTION, or BLOCK "
                "verdict with a specific list of flags and a single concrete recommendation."
            ),
            llm=llm,
            verbose=True,
        )

        # ── Tasks ──────────────────────────────────────────────────────────────
        if settings.use_real_tools:
            monitor_instructions = (
                f"Use the 'GDELT Disruption Search' tool with country='{supplier_country}' "
                f"to find recent real news headlines. Then check for active tariff changes, "
                f"port disruptions, or geopolitical events affecting HS code '{hs_code}' "
                f"imported from '{supplier_country}' into the US. Base 'event' and "
                f"'confidence' on what the tool returns — if the tool returns no relevant "
                f"articles, set risk_detected=false and confidence low. "
                f"Set 'source' to 'gdelt'. Return valid JSON only."
            )
        else:
            monitor_instructions = (
                f"Check for active tariff changes, port disruptions, or geopolitical events "
                f"affecting HS code '{hs_code}' imported from '{supplier_country}' into the US. "
                f"Return valid JSON only."
            )

        monitor_task = Task(
            description=monitor_instructions,
            agent=tariff_monitor,
            expected_output=(
                'JSON: {"risk_detected": true, "event": "25% tariff on HS 6109 from VN", '
                '"confidence": 0.92, "source": "usitc"}'
            ),
        )

        # ImpactCalculator reasons over REAL pending-order data pulled from
        # Aurora, not a hardcoded "$40,000" placeholder. If there's no DB
        # session or no pending orders, fall back to a representative demo
        # number so the agent still has something concrete to calculate from.
        pending_total, pending_count = self._get_pending_orders_summary(db, customer_id)
        if pending_total <= 0:
            pending_total, pending_count = 40000.0, 1

        impact_task = Task(
            description=(
                f"A tariff event was detected for HS {hs_code} from {supplier_country}. "
                f"This customer has {pending_count} pending/in-transit order(s) totaling "
                f"${pending_total:,.2f} USD. "
                f"Calculate extra_cost_usd, classify severity, and count affected_orders. "
                f"Return valid JSON only."
            ),
            agent=impact_calculator,
            expected_output=(
                'JSON: {"extra_cost_usd": 10000, "severity": "high", "affected_orders": 1}'
            ),
        )

        alternatives_task = Task(
            description=(
                f"Find 2 alternative supplier countries for HS code {hs_code} "
                f"that are NOT subject to the same tariff as {supplier_country}. "
                f"For each option provide: supplier (company name), country (2-letter code), "
                f"lead_time_weeks (int), cost_delta_pct (signed int). Return valid JSON only."
            ),
            agent=alternatives_finder,
            expected_output=(
                'JSON: {"options": [{"supplier": "Dhaka Garments Ltd", "country": "BD", '
                '"lead_time_weeks": 8, "cost_delta_pct": -12}]}'
            ),
        )

        compliance_task = Task(
            description=(
                "For each alternative supplier country identified, list the specific US customs "
                "documents and certifications required to import HS code goods from that country. "
                "Return a JSON object keyed by 2-letter country code."
            ),
            agent=import_compliance,
            expected_output=(
                'JSON: {"BD": ["Certificate of Origin", "Commercial Invoice"], '
                '"IN": ["BIS certification", "Certificate of Origin"]}'
            ),
        )

        adversarial_task = Task(
            description=(
                "Review all prior agent outputs. Check: "
                "(1) Does any alternative miss the buyer's delivery deadline? "
                "(2) Are any recommended suppliers unverified or untested? "
                "(3) Are there compliance gaps or quality risks? "
                "Issue a CLEAR, CAUTION, or BLOCK verdict with specific flags and one recommendation. "
                "Return valid JSON only."
            ),
            agent=adversarial,
            expected_output=(
                'JSON: {"verdict": "CAUTION", '
                '"flags": ["BD misses deadline by 1 week"], '
                '"recommendation": "Use IN supplier, negotiate 1-week extension with buyer"}'
            ),
        )

        # ── Crew kickoff ───────────────────────────────────────────────────────
        crew = Crew(
            agents=[
                tariff_monitor,
                impact_calculator,
                alternatives_finder,
                import_compliance,
                adversarial,
            ],
            tasks=[
                monitor_task,
                impact_task,
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
            "tariff_monitor": _parse_task_output(monitor_task),
            "impact_calculator": _parse_task_output(impact_task),
            "alternatives_finder": _parse_task_output(alternatives_task),
            "import_compliance": _parse_task_output(compliance_task),
            "adversarial": _parse_task_output(adversarial_task),
        }

        severity = agent_outputs.get("impact_calculator", {}).get("severity", "medium")
        recommendation = agent_outputs.get("adversarial", {}).get(
            "recommendation", "Review the alert and take action."
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
            data_source="gemini",
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
