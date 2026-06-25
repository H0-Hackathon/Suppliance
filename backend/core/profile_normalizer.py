"""
CoastGuard — BusinessProfile Normalizer

One Gemini call that turns raw onboarding input (industry, HQ location, the
supplier list the user typed in, revenue bracket) into every narrative
BusinessProfile field the pipeline's agents read from — the same fields
populated on the five reference companies (customer_id 240-244): HS codes,
product descriptions, compliance notes, alternative regions/countries, RSS
keywords, lead times, etc. If this call fails (no key, quota, bad response),
callers fall back to the existing rule-based derivation in
crew_monitor_pipeline._load_profile instead of leaving the profile empty.
"""
import logging
from typing import Optional

from pydantic import BaseModel
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class NormalizedBusinessProfile(BaseModel):
    business_type: str
    destination_country: str
    destination_port: str
    import_region: str
    risk_tolerance: str
    annual_import_volume_usd: float
    typical_order_value_usd: float
    avg_lead_time_days: int
    min_supplier_rating: float
    primary_hs_codes: list[str]
    primary_origin_countries: list[str]
    product_categories: list[str]
    product_descriptions: list[str]
    rss_keywords: list[str]
    compliance_notes: str
    preferred_alternative_regions: list[str]
    preferred_alternative_countries: list[str]
    hq_country: str
    hq_city: str


def normalize_business_profile(
    industry: str,
    raw_location: str,
    suppliers: list[dict],
    average_revenue: str,
    company_name: str = "",
) -> Optional[dict]:
    """
    suppliers: [{"name": ..., "country": ...}, ...] as entered during onboarding.
    Returns a dict matching every BusinessProfile narrative column, or None if
    the LLM call fails.
    """
    if not settings.gemini_api_key:
        return None
    try:
        from crewai import LLM
        llm = LLM(model=settings.gemini_model, api_key=settings.gemini_api_key)
        supplier_lines = "\n".join(
            f"- {s.get('name')} ({s.get('country')})" for s in suppliers if s.get("name")
        ) or "(none provided)"

        prompt = f"""You are setting up a new importer's profile for a supply-chain risk monitoring system.

Company: {company_name or industry}
Industry: {industry}
HQ location (as typed by the user — may be a city, state, or country): {raw_location}
Average annual revenue: {average_revenue}
Current suppliers:
{supplier_lines}

Infer a complete, realistic business profile for this company:
- Use the suppliers' countries as the basis for primary_origin_countries (if no suppliers given, pick 2-3 realistic countries for this industry).
- Pick 2-4 realistic HS codes for goods this industry would import.
- Write 1-3 short product_descriptions for what this company actually imports.
- Write a one-paragraph compliance_notes covering the most relevant import regulations for this industry and these origin countries.
- Suggest 2-3 preferred_alternative_regions and preferred_alternative_countries for sourcing, distinct from the current suppliers' countries, in case of disruption.
- Resolve the HQ location down to its country (hq_country) and city if discernible (hq_city), and set destination_country to that same country with a realistic destination_port.
- import_region should describe the broad region the current suppliers are concentrated in (e.g. "East Asia", "South Asia", "Latin America").
"""
        result = llm.call(prompt, response_model=NormalizedBusinessProfile)
        if isinstance(result, NormalizedBusinessProfile):
            return result.model_dump()
        if isinstance(result, dict):
            return result
        return None
    except Exception as exc:
        logger.warning(f"normalize_business_profile failed, caller will fall back to rule-based defaults: {exc}")
        return None
