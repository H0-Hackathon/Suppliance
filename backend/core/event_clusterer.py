"""
CoastGuard — LLM-based event clustering for Agent 1.

One Gemini Flash call per /monitor/run: takes all in-flight articles
from the RSS cache + targeted Google News query, groups them into event
clusters, and fully synthesizes the top cluster most relevant to the
given supplier country and HS code.

Articles are purely in-memory — they flow through one pipeline run and
are never persisted. The RSS cache (core/article_cache) stages them
between scrape cycles but writes nothing to disk.

Estimated cost: ~$0.001 per run at Gemini Flash pricing (~8k tokens in,
~512 tokens out). 100 calls/day ≈ $0.10/day.
"""

import json
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# HS chapter (first 2 digits) → human-readable label for the LLM prompt.
# Keeps the prompt concrete about what product category the importer sources.
_HS2_LABELS: dict[str, str] = {
    "61": "apparel and textiles",
    "62": "apparel and textiles",
    "63": "textiles and home goods",
    "72": "steel",
    "73": "steel products",
    "76": "aluminum",
    "84": "machinery and electronics",
    "85": "electronics and batteries",
    "87": "vehicles and automotive parts",
    "30": "pharmaceuticals",
}

_CLUSTERING_PROMPT = """\
You are a supply chain risk analyst. Classify and synthesize {n} trade news items.

IMPORTANT: Output fields in EXACTLY this order so partial responses are still useful.

Return ONLY this JSON object (no markdown, no extra text):
{{
  "top_cluster": {{
    "event_type": "TARIFF or EXPORT_CONTROL or PORT_DISRUPTION or WEATHER or GEOPOLITICAL or SUPPLY_CHAIN",
    "article_indices": [0],
    "affected_country": "full country name",
    "tariff_rate": null,
    "title": "Your own concise headline (max 12 words)",
    "description": "One original sentence on what happened. One sentence on importer impact."
  }}
}}

Rules:
- Pick the cluster most relevant to an importer sourcing {hs_desc} from {country}.
- tariff_rate: a number like 46 for 46 percent, or null. Never a string.
- article_indices: integer labels from the list below that belong to this cluster.
- title and description must be original — do not copy text from the articles.
- If nothing matches {country}, pick the globally most significant trade disruption.

Articles:
{article_list}
"""


def cluster_articles(
    articles: list[dict],
    supplier_country: str,
    hs_code: Optional[str],
    api_key: str,
) -> Optional[dict]:
    """
    Send all in-flight articles to Gemini Flash for event clustering.

    Returns a synthesized cluster dict:
        {title, description, event_type, affected_country, tariff_rate, article_indices}

    Returns None on any failure (network, quota, bad JSON) so the caller can
    fall back to deterministic ranking.
    """
    if not articles or not api_key:
        return None

    try:
        from google import genai
        from google.genai import types as genai_types
    except ImportError:
        logger.warning("google-genai not installed — skipping LLM clustering")
        return None

    from config import get_settings
    # google.genai uses the bare model name without the "gemini/" LiteLLM prefix
    model_name = get_settings().gemini_model.removeprefix("gemini/")

    hs_desc = _hs_desc(hs_code)
    article_list = _format_articles(articles)

    prompt = _CLUSTERING_PROMPT.format(
        n=len(articles),
        country=supplier_country or "any country",
        hs_desc=hs_desc,
        article_list=article_list,
    )

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=4096,
            ),
        )
        raw = response.text or ""
        # Log finish reason — RECITATION means Gemini's content filter trimmed the output
        if response.candidates:
            finish_reason = str(response.candidates[0].finish_reason)
            logger.info("LLM finish_reason: %s | raw_len=%d", finish_reason, len(raw))
        logger.debug("LLM clustering raw response: %.600s", raw)
    except Exception as exc:
        logger.warning("Gemini clustering call failed: %s", exc)
        return None

    try:
        data = _parse_json(raw)
        cluster = data.get("top_cluster") or data
    except (ValueError, AttributeError) as exc:
        # Complete JSON parse failed — try rescuing individual fields via regex.
        # This handles RECITATION truncation: Gemini stops mid-string but we
        # can still get title + event_type from the partial output.
        logger.warning("Full JSON parse failed (%s) — attempting field rescue from partial output", exc)
        cluster = _rescue_partial_json(raw)
        if not cluster:
            logger.warning("Field rescue also failed — raw: %.300s", raw)
            return None
        logger.info("Rescued cluster from partial LLM output: %s", cluster.get("title", "?"))

    if not isinstance(cluster, dict):
        logger.warning("Unexpected LLM cluster type: %s", type(cluster))
        return None

    if not cluster.get("title") or not cluster.get("event_type"):
        logger.warning("LLM cluster missing required fields: %s", list(cluster.keys()))
        return None

    # Normalise article_indices — LLM sometimes returns strings or floats
    raw_indices = cluster.get("article_indices") or []
    cluster["article_indices"] = [
        int(i) for i in raw_indices
        if str(i).isdigit() and 0 <= int(i) < len(articles)
    ]

    # Normalise tariff_rate — LLM sometimes returns "25%" as a string
    raw_rate = cluster.get("tariff_rate")
    if isinstance(raw_rate, str):
        try:
            cluster["tariff_rate"] = float(raw_rate.rstrip("%"))
        except ValueError:
            cluster["tariff_rate"] = None
    elif isinstance(raw_rate, (int, float)):
        cluster["tariff_rate"] = float(raw_rate)
    else:
        cluster["tariff_rate"] = None

    logger.info(
        "LLM cluster: type=%s country=%s rate=%s articles=%d",
        cluster.get("event_type"),
        cluster.get("affected_country"),
        cluster.get("tariff_rate"),
        len(cluster["article_indices"]),
    )
    return cluster


def _rescue_partial_json(raw: str) -> Optional[dict]:
    """
    When the LLM response is truncated (RECITATION or MAX_TOKENS), extract
    whatever key fields are present. With the new prompt ordering (event_type
    comes FIRST), we usually have event_type + article_indices + affected_country
    even when title/description get cut off.
    """
    etype_m = re.search(r'"event_type"\s*:\s*"(TARIFF|EXPORT_CONTROL|PORT_DISRUPTION|WEATHER|GEOPOLITICAL|SUPPLY_CHAIN)"', raw)
    title_m = re.search(r'"title"\s*:\s*"([^"]+)"', raw)

    # Need at least one of these to produce a useful result
    if not etype_m and not title_m:
        return None

    # Infer event_type from title keywords if the field wasn't in the partial output
    inferred_etype = "SUPPLY_CHAIN"
    if etype_m:
        inferred_etype = etype_m.group(1)
    elif title_m:
        t = title_m.group(1).lower()
        if any(k in t for k in ("tariff", "duty", "levy")):
            inferred_etype = "TARIFF"
        elif any(k in t for k in ("export control", "sanction", "restriction")):
            inferred_etype = "EXPORT_CONTROL"
        elif any(k in t for k in ("port", "shipping", "freight", "vessel")):
            inferred_etype = "PORT_DISRUPTION"
        elif any(k in t for k in ("storm", "typhoon", "flood", "earthquake")):
            inferred_etype = "WEATHER"
        elif any(k in t for k in ("war", "conflict", "geopolit")):
            inferred_etype = "GEOPOLITICAL"

    country_m = re.search(r'"affected_country"\s*:\s*"([^"]+)"', raw)
    rate_m = re.search(r'"tariff_rate"\s*:\s*(\d+(?:\.\d+)?)', raw)
    desc_m = re.search(r'"description"\s*:\s*"([^"]*)"', raw)
    indices_m = re.search(r'"article_indices"\s*:\s*\[([^\]]*)\]', raw)

    indices: list[int] = []
    if indices_m:
        for x in indices_m.group(1).split(","):
            x = x.strip()
            if x.isdigit():
                indices.append(int(x))
    if not indices:
        indices = [0]  # default: assume the first article

    rescued_title = title_m.group(1) if title_m else f"{inferred_etype.title()} event detected"
    return {
        "title": rescued_title,
        "description": desc_m.group(1) if desc_m else "",
        "event_type": inferred_etype,
        "affected_country": country_m.group(1) if country_m else None,
        "tariff_rate": float(rate_m.group(1)) if rate_m else None,
        "article_indices": indices,
    }


def _parse_json(raw: str) -> dict:
    """
    Extract a JSON object from LLM output that may include markdown fences,
    trailing commas, or explanatory text before/after the JSON block.
    Raises ValueError if no valid JSON object can be found.
    """
    # Strategy 1: direct parse (ideal — response_mime_type="application/json")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Strategy 2: strip ```json ... ``` markdown fences if the model added them
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if fence:
        try:
            return json.loads(fence.group(1))
        except json.JSONDecodeError:
            pass

    # Strategy 3: find the outermost {...} block (handles leading/trailing text)
    brace = re.search(r"\{.*\}", raw, re.DOTALL)
    if brace:
        try:
            return json.loads(brace.group())
        except json.JSONDecodeError:
            pass

    raise ValueError(f"No valid JSON found in LLM output: {raw[:200]}")


def _format_articles(articles: list[dict]) -> str:
    """Format articles as compact '[idx] title | summary' lines for the LLM prompt."""
    lines = []
    for i, a in enumerate(articles):
        title = (a.get("title") or "").strip()[:120]
        summary = (
            a.get("summary") or a.get("full_text") or ""
        )[:200].replace("\n", " ").strip()
        lines.append(f"[{i}] {title} | {summary}")
    return "\n".join(lines)


def _hs_desc(hs_code: Optional[str]) -> str:
    if not hs_code:
        return "general goods"
    return _HS2_LABELS.get(hs_code[:2], f"HS {hs_code} goods")
