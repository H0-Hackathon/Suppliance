"""
Tests for the RSS de-dup buffer (core/crew_monitor_pipeline.py).

Goal: a pipeline run must never re-cite an article already shown to a given
customer for a given agent_target — a permanent ledger (SeenArticle), not a
rolling time window. Separately, the per-run RssArticle scratch buffer still
gets pruned by age so it doesn't grow forever (tested below).
"""
from datetime import datetime, timedelta

from core.crew_monitor_pipeline import _seen_article_urls, _mark_articles_seen, RSS_DEDUP_WINDOW_HOURS
from models import RssArticle


def _insert_article(db, customer_id, url, agent_target, hours_ago):
    row = RssArticle(
        run_id="test-run",
        customer_id=customer_id,
        title=f"Article at {url}",
        url=url,
        source="Test Source",
        agent_target=agent_target,
        created_at=datetime.utcnow() - timedelta(hours=hours_ago),
    )
    db.add(row)
    db.commit()
    return row


def test_seen_article_urls_excludes_previously_cited_articles(db_session, test_customer):
    _mark_articles_seen(test_customer.id, "tariff_monitor", ["https://example.com/recent"], "test-run", db_session)

    seen = _seen_article_urls(test_customer.id, "tariff_monitor", db_session)
    assert "https://example.com/recent" in seen


def test_seen_article_urls_never_expires(db_session, test_customer):
    """Unlike the old rolling-window buffer, the SeenArticle ledger is permanent —
    an article cited long ago must still be excluded today."""
    _mark_articles_seen(test_customer.id, "tariff_monitor", ["https://example.com/old"], "test-run", db_session)
    from models import SeenArticle
    row = db_session.query(SeenArticle).filter(SeenArticle.url == "https://example.com/old").first()
    row.created_at = datetime.utcnow() - timedelta(hours=RSS_DEDUP_WINDOW_HOURS + 100)
    db_session.commit()

    seen = _seen_article_urls(test_customer.id, "tariff_monitor", db_session)
    assert "https://example.com/old" in seen


def test_seen_article_urls_is_scoped_per_agent_target(db_session, test_customer):
    """A URL marked seen for alternatives_finder shouldn't block tariff_monitor
    from citing it — each agent pulls from different feeds."""
    _mark_articles_seen(test_customer.id, "alternatives_finder", ["https://example.com/x"], "test-run", db_session)

    seen = _seen_article_urls(test_customer.id, "tariff_monitor", db_session)
    assert "https://example.com/x" not in seen


def test_seen_article_urls_is_scoped_per_customer(db_session, test_customer):
    from models import Customer

    other = Customer(clerk_id="other_rss_user", name="Other")
    db_session.add(other)
    db_session.commit()
    _mark_articles_seen(other.id, "tariff_monitor", ["https://example.com/theirs"], "test-run", db_session)

    seen = _seen_article_urls(test_customer.id, "tariff_monitor", db_session)
    assert "https://example.com/theirs" not in seen


def test_candidate_articles_filtered_against_seen_urls(db_session, test_customer):
    """End-to-end of the filtering step used in _fetch_and_buffer_articles /
    _fetch_compliance_articles / _fetch_alternatives_articles: candidates whose
    URL was already cited to this customer get dropped before scoring/selection."""
    _mark_articles_seen(test_customer.id, "tariff_monitor", ["https://example.com/already-used"], "test-run", db_session)

    raw_articles = [
        {"url": "https://example.com/already-used", "title": "Old news"},
        {"url": "https://example.com/brand-new", "title": "Fresh news"},
    ]
    seen_urls = _seen_article_urls(test_customer.id, "tariff_monitor", db_session)
    filtered = [a for a in raw_articles if a.get("url") not in seen_urls]

    assert len(filtered) == 1
    assert filtered[0]["url"] == "https://example.com/brand-new"


def test_age_based_prune_keeps_recent_drops_stale(db_session, test_customer):
    """Mirrors the prune query at the end of the pipeline run (step 9):
    delete rows older than the de-dup window, keep everything inside it."""
    recent = _insert_article(db_session, test_customer.id, "https://example.com/keep", "tariff_monitor", hours_ago=1)
    stale = _insert_article(
        db_session, test_customer.id, "https://example.com/drop", "tariff_monitor",
        hours_ago=RSS_DEDUP_WINDOW_HOURS + 5,
    )

    cutoff = datetime.utcnow() - timedelta(hours=RSS_DEDUP_WINDOW_HOURS)
    db_session.query(RssArticle).filter(RssArticle.created_at < cutoff).delete()
    db_session.commit()

    remaining_urls = {r.url for r in db_session.query(RssArticle).all()}
    assert "https://example.com/keep" in remaining_urls
    assert "https://example.com/drop" not in remaining_urls
