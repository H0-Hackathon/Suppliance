"""
CoastGuard — Import Compliance Crew

5-agent pipeline for checking US customs compliance when switching to an alternative supplier.

Agents:
  1. TariffRegulationResearcher — looks up HS code duty rates and GSP eligibility
  2. TradeDocumentAnalyst       — identifies all CBP entry documents required
  3. CustomsSpecialist          — per-country customs requirements and bilateral agreements
  4. ImportRiskOfficer          — assesses audit risk and penalty exposure
  5. AlertReportWriter          — synthesizes findings into a structured action list
"""

import json
import logging
import re

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

try:
    from crewai import Agent, Task, Crew, LLM
    HAS_CREWAI = True
except ImportError:
    HAS_CREWAI = False

# Injected into every agent's backstory so they stay in scope
IMPORT_COMPLIANCE_CONTEXT = """
US Import Compliance Reference:
- All shipments require: commercial invoice, packing list, bill of lading
- Certificate of Origin (CoO) is required for any GSP or FTA tariff claim
- ISF (Importer Security Filing, 10+2) must be filed 24 h before vessel departure
- HS code misclassification penalties: up to $250,000 per violation (CBP 19 CFR 111)
- Bangladesh: Form A (GSP) enables 0% duty on eligible textiles
- India: BIS certification required for electronics; standard CoO for textiles
- China: Section 301 additional duties (7.5%–25%) require a surety bond
- FDA registration required for food, cosmetics, medical devices (prior notice)
- CPSC compliance required for children's products and apparel under 16 CFR 1610
"""

# Realistic mock responses by country code
_MOCK_COMPLIANCE = {
    "BD": ["Certificate of Origin (GSP Form A)", "Commercial Invoice update", "Packing List"],
    "IN": ["BIS certification check", "Certificate of Origin", "Commercial Invoice"],
    "CN": ["Section 301 surety bond", "Certificate of Origin", "Commercial Invoice"],
    "VN": ["Certificate of Origin", "Commercial Invoice", "ISF (10+2) filing"],
    "MX": ["USMCA Certificate of Origin", "Commercial Invoice", "Packing List"],
    "KH": ["Certificate of Origin", "Commercial Invoice"],
    "ID": ["Certificate of Origin", "Commercial Invoice", "Halal certificate (food only)"],
    "TH": ["Certificate of Origin", "Commercial Invoice"],
    "PK": ["Certificate of Origin", "Commercial Invoice"],
    "TR": ["Certificate of Origin", "Commercial Invoice", "EUR.1 movement certificate"],
}


class ImportComplianceCrew:
    """
    Checks US import compliance requirements when switching to an alternative supplier.

    Usage:
        crew = ImportComplianceCrew()
        if crew.is_available:
            result = crew.check_compliance(hs_code="6109", alternatives=["BD", "IN"])
        else:
            result = crew.mock_compliance(alternatives=["BD", "IN"])

    Returns:
        Dict keyed by 2-letter country code, each value a list of required action items.
        Example: {"BD": ["Certificate of Origin (GSP Form A)", "Commercial Invoice update"]}
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
        self._llm = None

    @property
    def is_available(self) -> bool:
        """True if CrewAI is installed and the active LLM provider is configured."""
        from core.llm_factory import llm_configured
        return HAS_CREWAI and llm_configured()

    @property
    def llm(self) -> "LLM":
        if self._llm is None:
            if not HAS_CREWAI:
                raise RuntimeError("CrewAI not installed. Run: pip install crewai>=1.7.0")
            from core.llm_factory import build_llm
            self._llm = build_llm()
        return self._llm

    def check_compliance(self, hs_code: str, alternatives: list) -> dict:
        """
        Run the 5-agent compliance check for a list of alternative supplier countries.

        Falls back to mock_compliance() if CrewAI or the LLM provider is unavailable.
        """
        if not self.is_available:
            logger.info("ImportComplianceCrew: falling back to mock response")
            return self.mock_compliance(alternatives)

        countries_str = ", ".join(alternatives)

        tariff_researcher = Agent(
            role="Tariff Regulation Researcher",
            goal=f"Look up US duty rates and GSP eligibility for HS code {hs_code} from {countries_str}.",
            backstory=(
                "You are a trade compliance expert specializing in the HTS Schedule B. "
                "You look up the exact duty rate, Section 301 / anti-dumping charges, "
                "and GSP eligibility for each sourcing country.\n\n" + IMPORT_COMPLIANCE_CONTEXT
            ),
            llm=self.llm,
            verbose=True,
        )

        doc_analyst = Agent(
            role="Trade Document Analyst",
            goal="Identify all CBP entry documents required for the import shipment.",
            backstory=(
                "You are a licensed customs broker who knows exactly which forms CBP requires "
                "for entry: ISF, commercial invoice, packing list, Certificate of Origin, "
                "and any special permits for regulated products.\n\n" + IMPORT_COMPLIANCE_CONTEXT
            ),
            llm=self.llm,
            verbose=True,
        )

        customs_specialist = Agent(
            role="Customs Specialist",
            goal=f"Detail per-country customs requirements for {countries_str}.",
            backstory=(
                "You are a customs specialist who knows bilateral trade agreements, GSP programs, "
                "and country-specific entry requirements for every major US trading partner. "
                "You know when Form A is needed vs a standard CoO.\n\n" + IMPORT_COMPLIANCE_CONTEXT
            ),
            llm=self.llm,
            verbose=True,
        )

        risk_officer = Agent(
            role="Import Risk Officer",
            goal="Assess customs audit risk and penalty exposure for each alternative country.",
            backstory=(
                "You are an import compliance risk officer who has worked hundreds of CBP audits. "
                "You flag when incorrect HS codes, missing certificates, or country-of-origin "
                "disputes could trigger penalties, seizure, or delays.\n\n" + IMPORT_COMPLIANCE_CONTEXT
            ),
            llm=self.llm,
            verbose=True,
        )

        report_writer = Agent(
            role="Alert Report Writer",
            goal=(
                "Synthesize all compliance findings into a clean JSON dict keyed by country code, "
                "each value a list of required action items."
            ),
            backstory=(
                "You translate complex compliance analysis into clear, actionable bullet points "
                "that a small business owner can understand and act on immediately. "
                "You always output valid JSON — no markdown, no prose, just the JSON object."
            ),
            llm=self.llm,
            verbose=True,
        )

        tasks = [
            Task(
                description=f"Look up HS {hs_code} duty rates and GSP eligibility for {countries_str}.",
                agent=tariff_researcher,
                expected_output='JSON with duty rates and GSP eligibility per country code.',
            ),
            Task(
                description="List all CBP entry documents required for this shipment type.",
                agent=doc_analyst,
                expected_output='JSON list of required document types.',
            ),
            Task(
                description=f"Detail country-specific customs requirements for {countries_str}.",
                agent=customs_specialist,
                expected_output='JSON keyed by country code, each with a requirements list.',
            ),
            Task(
                description="Assess compliance audit risk for each alternative.",
                agent=risk_officer,
                expected_output='JSON with risk_level and potential penalties per country.',
            ),
            Task(
                description=(
                    f"Synthesize all findings for {countries_str}. "
                    "Return a JSON object keyed by 2-letter country code, "
                    "each value a list of required action items (strings). "
                    "Return valid JSON only — no markdown, no extra text."
                ),
                agent=report_writer,
                expected_output='{"BD": ["action 1", "action 2"], "IN": ["action 1"]}',
            ),
        ]

        crew = Crew(
            agents=[tariff_researcher, doc_analyst, customs_specialist, risk_officer, report_writer],
            tasks=tasks,
            verbose=True,
        )

        try:
            crew.kickoff()
            raw = getattr(getattr(tasks[-1], "output", None), "raw", "{}")
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                return json.loads(match.group())
        except Exception as exc:
            logger.error(f"ImportComplianceCrew kickoff failed: {exc}")

        return self.mock_compliance(alternatives)

    @staticmethod
    def mock_compliance(alternatives: list) -> dict:
        """Return hardcoded realistic compliance requirements per country."""
        return {
            c: _MOCK_COMPLIANCE.get(c, ["Certificate of Origin", "Commercial Invoice"])
            for c in alternatives
        }


def get_import_compliance_crew() -> ImportComplianceCrew:
    """Factory / FastAPI dependency."""
    return ImportComplianceCrew()
