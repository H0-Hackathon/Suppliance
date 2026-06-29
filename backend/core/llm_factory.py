"""
Shared LLM construction for every CrewAI pipeline (monitor, import
compliance, trade docs, profile normalizer) so provider selection lives in
one place instead of being duplicated four times.

Default provider is Gemini — works locally with just a free API key, no AWS
account or Bedrock model-access request needed. Set LLM_PROVIDER=bedrock to
switch to AWS Bedrock (Claude) instead, via CrewAI's native Bedrock support
(boto3 — no litellm dependency required).
"""
from __future__ import annotations

import os
from typing import TYPE_CHECKING

from config import get_settings

if TYPE_CHECKING:
    from crewai import LLM

settings = get_settings()


def llm_configured() -> bool:
    """Whether enough credentials exist to construct a real LLM for the active provider."""
    if settings.llm_provider == "gemini":
        return bool(settings.gemini_api_key)
    return bool(settings.aws_access_key_id and settings.aws_secret_access_key)


def build_llm() -> "LLM":
    """Construct a CrewAI LLM for whichever provider is configured."""
    from crewai import LLM

    if settings.llm_provider == "gemini":
        api_key = settings.gemini_api_key
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set.")
        os.environ.setdefault("GOOGLE_API_KEY", api_key)
        return LLM(model=settings.gemini_model, api_key=api_key)

    if not (settings.aws_access_key_id and settings.aws_secret_access_key):
        raise RuntimeError(
            "AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are not set — required for AWS Bedrock. "
            "See backend/.env.example for how to get them and enable Claude model access."
        )
    return LLM(
        model=settings.bedrock_model_id,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        aws_session_token=settings.aws_session_token,
        region_name=settings.bedrock_region,
    )
