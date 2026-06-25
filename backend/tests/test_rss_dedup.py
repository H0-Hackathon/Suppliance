"""
Tests for the RSS de-dup buffer (core/crew_monitor_pipeline.py).

Goal: a pipeline run must not re-cite an article that a run within the last
RSS_DEDUP_WINDOW_HOURS already used, and articles older than that window
must get pruned so the rss_articles table doesn't grow forever.
"""
from datetime import datetime, timedelta

from core.crew_monitor_pipeline import _seen_article_urls, RSS_DEDUP_WINDOW_HOURS
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


def test_seen_article_urls_excludes_recent_articles(db_session, test_customer):
    _insert_article(db_session, test_customer.id, "https://example.com/recent", "tariff_monitor", hours_ago=1)

    seen = _seen_article_urls(test_customer.id, "tariff_monitor", db_session)
    assert "https://example.com/recent" in seen


def test_seen_article_urls_excludes_articles_outside_window(db_session, test_customer):
    _insert_article(
        db_session, test_customer.id, "https://example.com/stale", "tariff_monitor",
        hours_ago=RSS_DEDUP_WINDOW_HOURS + 1,
    )

    seen = _seen_article_urls(test_customer.id, "tariff_monitor", db_session)
    assert "https://example.com/stale" not in seen


def test_seen_article_urls_is_scoped_per_agent_target(db_session, test_customer):
    """An article buffered for alternatives_finder shouldn't block tariff_monitor
    from citing a URL that happens to match — each agent pulls from different feeds."""
    _insert_article(db_session, test_customer.id, "https://example.com/x", "alternatives_finder", hours_ago=1)

    seen = _seen_article_urls(test_customer.id, "tariff_monitor", db_session)
    assert "https://example.com/x" not in seen


def test_seen_article_urls_is_scoped_per_customer(db_session, test_customer):
    from models import Customer

    other = Customer(clerk_id="other_rss_user", name="Other")
    db_session.add(other)
    db_session.commit()
    _insert_article(db_session, other.id, "https://example.com/theirs", "tariff_monitor", hours_ago=1)

    seen = _seen_article_urls(test_customer.id, "tariff_monitor", db_session)
    assert "https://example.com/theirs" not in seen


def test_candidate_articles_filtered_against_seen_urls(db_session, test_customer):
    """End-to-end of the filtering step used in _fetch_and_buffer_articles /
    _fetch_compliance_articles / _fetch_alternatives_articles: candidates whose
    URL was already buffered get dropped before scoring/selection."""
    _insert_article(db_session, test_customer.id, "https://example.com/already-used", "tariff_monitor", hours_ago=2)

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
