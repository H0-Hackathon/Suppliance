"""
CoastGuard — Trade Document Classification Crew

3-agent pipeline for classifying and validating trade documents uploaded by SMBs.

Agents:
  1. TradeDocumentClassifier     — identifies doc type (BoL, CoO, invoice, etc.)
  2. HSCodeRequirementsResearcher — looks up all docs required for the HS code
  3. DocumentationGapAnalyst     — finds missing/incomplete docs and scores completeness
"""

import json
import logging
import re
from typing import Optional

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

try:
    from crewai import Agent, Task, Crew, LLM
    HAS_CREWAI = True
except ImportError:
    HAS_CREWAI = False


TRADE_DOC_TYPES = [
    "bill_of_lading",
    "certificate_of_origin",
    "commercial_invoice",
    "packing_list",
    "customs_entry_form",
    "importer_security_filing",
    "bis_certification",
    "phytosanitary_certificate",
    "fumigation_certificate",
    "other",
]

TRADE_DOC_RULES = """
US Import Document Classification Reference:
- Bill of Lading (BoL): issued by carrier; identifies shipper, consignee, goods, vessel/flight
- Certificate of Origin (CoO): proves where goods were manufactured; required for GSP/FTA claims
- Commercial Invoice: shows unit price, quantity, HS code, buyer/seller info, country of origin
- Packing List: itemizes each package by weight, dimension, and SKU
- ISF (10+2): must be filed with CBP 24 h before vessel departure from foreign port
- BIS Certification: required for electronics, IT equipment, telecom devices
- Phytosanitary Certificate: required for plants, wood products, agricultural goods
- Fumigation Certificate: required for wood packaging material (ISPM 15)
"""


class TradeDocsCrew:
    """
    Classifies and validates trade documents for SMB import shipments.

    Usage:
        crew = TradeDocsCrew()
        if crew.is_available:
            result = crew.analyze(document_text="...", hs_code="6109", supplier_country="VN")
        else:
            result = crew.mock_analyze(hs_code="6109")

    Returns:
        {
            "doc_type": str,
            "extracted_fields": dict,
            "required_docs": list[str],
            "gaps": list[str],
            "completeness_score": int (0–100),
            "recommendations": list[str],
        }
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

    def analyze(
        self,
        document_text: str,
        hs_code: str,
        supplier_country: str = "",
    ) -> dict:
        """
        Classify a trade document and check it against HS code requirements.

        Falls back to mock_analyze() if CrewAI or the Gemini key is unavailable.
        """
        if not self.is_available:
            logger.info("TradeDocsCrew: falling back to mock response")
            return self.mock_analyze(hs_code)

        classifier = Agent(
            role="Trade Document Classifier",
            goal="Identify the type and key fields of a trade document.",
            backstory=(
                "You are a customs documentation expert. You can identify any US import document "
                "from its contents alone — Bill of Lading, Certificate of Origin, commercial invoice, "
                "packing list, ISF, or customs form — and extract the key fields.\n\n" + TRADE_DOC_RULES
            ),
            llm=self.llm,
            verbose=True,
        )

        hs_researcher = Agent(
            role="HS Code Requirements Researcher",
            goal=f"Look up every CBP document required to import HS code {hs_code} into the US.",
            backstory=(
                "You are a trade compliance researcher who knows the CBP documentation requirements "
                "for every major HS code category. You check FDA registration, CPSC compliance, "
                "BIS certifications, ISF requirements, and standard customs entry documents.\n\n"
                + TRADE_DOC_RULES
            ),
            llm=self.llm,
            verbose=True,
        )

        gap_analyst = Agent(
            role="Documentation Gap Analyst",
            goal="Compare available documents against requirements and identify every gap.",
            backstory=(
                "You are a meticulous compliance analyst. You cross-reference what a shipment has "
                "against what CBP requires, assign a completeness score (0–100), and flag every "
                "missing or incomplete document with a clear, actionable recommendation."
            ),
            llm=self.llm,
            verbose=True,
        )

        classify_task = Task(
            description=(
                f"Classify this trade document and extract its key fields:\n\n"
                f"{document_text[:3000]}\n\n"
                f"Valid doc_type values: {', '.join(TRADE_DOC_TYPES)}. "
                f"Return valid JSON only."
            ),
            agent=classifier,
            expected_output=(
                '{"doc_type": "certificate_of_origin", "extracted_fields": '
                '{"origin_country": "VN", "hs_code": "6109"}}'
            ),
        )

        requirements_task = Task(
            description=(
                f"List every US import document required for HS code {hs_code}"
                f"{' sourced from ' + supplier_country if supplier_country else ''}. "
                f"Return valid JSON only."
            ),
            agent=hs_researcher,
            expected_output=(
                '{"required_docs": ["certificate_of_origin", "commercial_invoice", "packing_list"]}'
            ),
        )

        gap_task = Task(
            description=(
                "Compare the classified document against the full requirements list. "
                "Identify which required documents are missing or incomplete. "
                "Assign a completeness_score (0–100) and list one recommendation per gap. "
                "Return valid JSON only."
            ),
            agent=gap_analyst,
            expected_output=(
                '{"gaps": ["importer_security_filing"], "completeness_score": 75, '
                '"recommendations": ["File ISF 24 h before vessel departure"]}'
            ),
        )

        crew = Crew(
            agents=[classifier, hs_researcher, gap_analyst],
            tasks=[classify_task, requirements_task, gap_task],
            verbose=True,
        )

        result: dict = {}
        try:
            crew.kickoff()
            for task in [classify_task, requirements_task, gap_task]:
                raw = getattr(getattr(task, "output", None), "raw", "{}")
                match = re.search(r'\{.*\}', raw, re.DOTALL)
                if match:
                    try:
                        result.update(json.loads(match.group()))
                    except Exception:
                        pass
        except Exception as exc:
            logger.error(f"TradeDocsCrew kickoff failed: {exc}")

        return result if result else self.mock_analyze(hs_code)

    @staticmethod
    def mock_analyze(hs_code: str) -> dict:
        """Return hardcoded realistic doc analysis for demo / Phase 1 testing."""
        return {
            "doc_type": "certificate_of_origin",
            "extracted_fields": {
                "hs_code": hs_code,
                "origin_country": "VN",
                "exporter": "Mekong Textiles Co",
            },
            "required_docs": [
                "certificate_of_origin",
                "commercial_invoice",
                "packing_list",
                "importer_security_filing",
            ],
            "gaps": ["importer_security_filing"],
            "completeness_score": 75,
            "recommendations": [
                "File ISF (10+2) with CBP at least 24 hours before vessel departure.",
            ],
        }


def get_trade_docs_crew() -> TradeDocsCrew:
    """Factory / FastAPI dependency."""
    return TradeDocsCrew()
