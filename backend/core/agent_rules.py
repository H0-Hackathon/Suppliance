"""
CoastGuard — Shared agent behavior rules.

One rule block per LLM-backed agent in core/crew_monitor_pipeline.py. Each
block is prepended to that agent's task description so the constraints are
part of the prompt CrewAI actually sends, without bloating the Agent
backstory text.
"""

ALTERNATIVES_RULES = """Rules:
1) Internal alternatives (from the buyer's own suppliers table) always rank above estimated ones.
2) Clearly label each alternative's "source" as "internal" (verified) or "estimated" (LLM reasoning).
3) Deadline feasibility is the primary ranking criterion, not cost.
4) Do not suggest the affected country as an alternative.
5) Output valid JSON only — no markdown, no prose outside the JSON structure."""

COMPLIANCE_RULES = """Rules:
1) Tag every compliance requirement as MANDATORY, RECOMMENDED, or CONDITIONAL (state the condition for CONDITIONAL items).
2) Cite the regulatory basis for each requirement (e.g. "19 CFR 102", "GSP Form A", "ISF 10+2").
3) If you are unsure whether a requirement applies, say so explicitly in the explanation — do not guess.
4) Use plain English in explanation fields — define any abbreviation on first use.
5) Output valid JSON only — no markdown, no prose outside the JSON structure."""

ADVERSARIAL_RULES = """Rules:
1) Your output is what the business owner reads first. Write recommended_action for them, not for other agents.
2) recommended_action must be one to two plain English sentences with a clear, concrete next step.
3) Do not use supply chain jargon ("synergize", "leverage", "pivot", "proactive", "actionable insights").
4) If the detected event's confidence is below 0.6, your verdict must be CAUTION at most — never CLEAR.
5) Output valid JSON only — no markdown, no prose outside the JSON structure."""
