"""
CoastGuard — Live news routes.

GET /api/v2/news               real trade/supply-chain headlines (RSS, cached ~10 min)
GET /api/v2/news/pipeline      headlines from the most recent pipeline run for a customer
"""

import time
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from services import news_feed

router = APIRouter(prefix="/api/v2", tags=["News"])


@router.get("/news")
def get_news(force: bool = False):
    """
    Return the latest aggregated trade/supply-chain headlines.

    Each item: {title, url, source, category, published, published_ts}.
    Results are cached server-side (~10 min); pass ?force=true to refresh now.
    """
    return news_feed.get_headlines(force=force)


@router.get("/news/pipeline")
def get_pipeline_news(customer_id: int, db: Session = Depends(get_db)):
    """
    Return RSS headlines from the most recent pipeline run for this customer.

    Pulls from pipeline_headlines (written at pipeline end, kept for 3 runs).
    Returns the same {items, fetched_at} shape as /news so NewsTicker works
    with both endpoints without any shape mapping.
    """
    from models import PipelineHeadline

    latest = (
        db.query(PipelineHeadline.run_id, func.max(PipelineHeadline.created_at).label("ts"))
        .filter(PipelineHeadline.customer_id == customer_id)
        .group_by(PipelineHeadline.run_id)
        .order_by(func.max(PipelineHeadline.created_at).desc())
        .first()
    )
    if not latest:
        return {"items": [], "fetched_at": None}

    rows = (
        db.query(PipelineHeadline)
        .filter(PipelineHeadline.run_id == latest.run_id)
        .order_by(PipelineHeadline.relevance_score.desc())
        .limit(30)
        .all()
    )

    items = [
        {
            "title": r.title or "",
            "url": r.url or "#",
            "source": r.source or "Pipeline",
            "category": r.category or "Trade",
            "published": r.published_at,
            "published_ts": r.published_ts or 0.0,
        }
        for r in rows
        if r.title and r.url
    ]
    return {"items": items, "fetched_at": time.time()}
