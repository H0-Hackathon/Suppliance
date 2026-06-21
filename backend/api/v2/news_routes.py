"""
CoastGuard — Live news routes.

GET /api/v2/news   real trade/supply-chain/tariff/logistics headlines for the
                   dashboard ticker (aggregated RSS, cached server-side).
"""

from fastapi import APIRouter

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
