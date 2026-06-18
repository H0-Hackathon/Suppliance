"""
CoastGuard — Supply chain news collector.

Pulls recent entries from supply-chain RSS feeds, extracts full article text
+ keywords/summary via newspaper3k, and writes them to
data/supply_chain_dataset.jsonl.

This is the secondary event source for the Monitor Agent (Agent 1) — see
core/monitor_agent.py — which normalizes these records into structured
risk events without any LLM call.

Run on demand:
    python -m collectors.monitor
"""

import feedparser
import json
import hashlib
import time
import pathlib

from newspaper import Article
from datetime import datetime, UTC
from urllib.parse import urlparse

# ==========================================================
# CONFIG
# ==========================================================

DATA_DIR = pathlib.Path(__file__).resolve().parent.parent / "data"
OUTPUT_FILE = DATA_DIR / "supply_chain_dataset.jsonl"

MAX_ARTICLES = 10

# ==========================================================
# RSS FEEDS
# ==========================================================

RSS_FEEDS = [
    # General supply chain / logistics
    "https://www.supplychaindive.com/feeds/news/",
    "https://theloadstar.com/feed/",

    # Agriculture & food trade — directly relevant to food importers
    "https://www.usda.gov/rss/latest-releases.xml",
    "https://www.fas.usda.gov/data/rss",
    "https://www.foodnavigator-usa.com/rss/breaking-news",

    # US trade policy / tariffs
    "https://ustr.gov/rss.xml",
    "https://www.trade.gov/rss.xml",

    # Latin America trade news (Colombia, Brazil)
    "https://rss.app/feeds/latinamerica-trade.xml",
]

# Alternative supplier stability feeds — regional trade conditions, political risk,
# port/logistics disruptions, crop conditions in sourcing alternatives.
ALTERNATIVES_RSS_FEEDS = [
    # Latin America economy & trade (MercoPress — covers Mercosur + Andean region)
    "https://en.mercopress.com/rss",
    # Latinvex — Latin America business & investment news
    "https://latinvex.com/rss.xml",
    # SupplyChainBrain — global supply chain disruptions and logistics
    "https://www.supplychainbrain.com/rss",
    # FAO — global food/agriculture production, crop forecasts, supply conditions
    "https://www.fao.org/news/rss-feed/en/",
    # FAS USDA — country-level agricultural trade data and attaché reports
    "https://www.fas.usda.gov/data/rss",
    # World Bank development talk — country stability, economic outlooks
    "https://blogs.worldbank.org/developmenttalk/rss.xml",
    # UNCTAD — global trade trends and disruptions
    "https://unctad.org/rss.xml",
    # The Loadstar — shipping/port disruption news globally
    "https://theloadstar.com/feed/",
]

# Compliance-specific feeds — import regulations, customs rulings, FDA alerts,
# phytosanitary requirements. Used exclusively by the ImportCompliance agent.
COMPLIANCE_RSS_FEEDS = [
    # Federal Register — CBP customs rulings, new import requirements
    "https://www.federalregister.gov/agencies/customs-and-border-protection.rss",
    # Federal Register — FDA food import regulations
    "https://www.federalregister.gov/agencies/food-and-drug-administration.rss",
    # Federal Register — USDA APHIS phytosanitary & import permits
    "https://www.federalregister.gov/agencies/animal-and-plant-health-inspection-service.rss",
    # Federal Register — all import-topic notices
    "https://www.federalregister.gov/topics/imports.rss",
    # Food Safety News — FDA enforcement actions, import detentions
    "https://www.foodsafetynews.com/feed/",
    # USDA latest releases (already in main but scored differently here)
    "https://www.usda.gov/rss/latest-releases.xml",
]

# ==========================================================
# ARTICLE EXTRACTION
# ==========================================================

def extract_article(url):

    try:

        article = Article(url)

        article.config.request_timeout = 10

        article.download()
        article.parse()

        text = article.text.strip()

        if len(text) < 200:
            return None

        try:

            article.nlp()

            summary = article.summary
            keywords = article.keywords

        except Exception:

            summary = text[:800]
            keywords = []

        domain = urlparse(url).netloc

        article_id = hashlib.sha256(
            url.encode("utf-8")
        ).hexdigest()

        content_hash = hashlib.sha256(
            text.encode("utf-8")
        ).hexdigest()

        return {

            "article_id": article_id,

            "content_hash": content_hash,

            "title": article.title,

            "url": url,

            "domain": domain,

            "authors": article.authors,

            "summary": summary,

            "full_text": text,

            "keywords": keywords,

            "meta_keywords":
                article.meta_keywords,

            "meta_description":
                article.meta_description,

            "top_image":
                article.top_image,

            "text_length":
                len(text),

            "title_length":
                len(article.title),

            "scraped_at":
                datetime.now(
                    UTC
                ).isoformat(),

            "collector_version":
                "1.0"
        }

    except Exception as e:

        print(
            f"Failed: {url}"
        )

        print(e)

        return None

# ==========================================================
# MAIN
# ==========================================================

def run(max_articles: int = MAX_ARTICLES, output_file: pathlib.Path = OUTPUT_FILE) -> list[dict]:
    """Run the collector and write data/supply_chain_dataset.jsonl. Returns the dataset."""

    dataset = []

    seen_titles = set()

    seen_content = set()

    saved_count = 0

    for feed_url in RSS_FEEDS:

        if saved_count >= max_articles:
            break

        print()
        print("=" * 60)
        print(feed_url)
        print("=" * 60)

        try:

            feed = feedparser.parse(
                feed_url
            )

        except Exception as e:

            print(
                f"Feed error: {e}"
            )

            continue

        source_name = (
            feed.feed.get(
                "title",
                "Unknown"
            )
        )

        entries = feed.entries[:20]

        for entry in entries:

            if saved_count >= max_articles:
                break

            url = entry.get("link")

            if not url:
                continue

            print(
                "Checking:",
                entry.get(
                    "title",
                    "Unknown"
                )[:100]
            )

            record = extract_article(
                url
            )

            if not record:
                continue

            title_key = (
                record["title"]
                .strip()
                .lower()
            )

            if title_key in seen_titles:

                print(
                    "Duplicate title"
                )

                continue

            if (
                record["content_hash"]
                in seen_content
            ):

                print(
                    "Duplicate content"
                )

                continue

            seen_titles.add(
                title_key
            )

            seen_content.add(
                record["content_hash"]
            )

            record["source"] = source_name

            record["rss_source"] = feed_url

            record["published"] = (
                entry.get(
                    "published",
                    ""
                )
            )

            record["feed_title"] = (
                entry.get(
                    "title",
                    ""
                )
            )

            record["feed_description"] = (
                entry.get(
                    "summary",
                    ""
                )
            )

            try:

                record["feed_tags"] = [

                    tag.get("term")

                    for tag in entry.get(
                        "tags",
                        []
                    )
                ]

            except Exception:

                record["feed_tags"] = []

            record["source_type"] = "news"

            dataset.append(
                record
            )

            saved_count += 1

            print(
                f"Saved: {record['title']}"
            )

            print(
                f"Text Length: {record['text_length']}"
            )

            print("-" * 60)

            time.sleep(0.1)

    dataset.sort(
        key=lambda x:
        x["text_length"],
        reverse=True
    )

    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(
        output_file,
        "w",
        encoding="utf-8"
    ) as f:

        for record in dataset:

            f.write(
                json.dumps(
                    record,
                    ensure_ascii=False
                ) + "\n"
            )

    print()
    print("=" * 60)
    print(
        f"TOTAL ARTICLES: {len(dataset)}"
    )
    print(
        f"OUTPUT FILE: {output_file}"
    )
    print("=" * 60)

    return dataset


def fast_run(max_articles: int = 40, emit_fn=None) -> list[dict]:
    """
    Fast RSS fetch — all feeds fetched in parallel with a 7s per-feed timeout.
    emit_fn: optional callback(event, msg) for live frontend progress.
    """
    import requests
    from concurrent.futures import ThreadPoolExecutor, as_completed

    FEED_TIMEOUT = 7  # seconds per feed

    def _fetch_one(feed_url: str) -> tuple[str, list[dict], str | None]:
        try:
            resp = requests.get(
                feed_url, timeout=FEED_TIMEOUT,
                headers={"User-Agent": "CoastGuard/1.0"},
            )
            resp.raise_for_status()
            feed = feedparser.parse(resp.content)
            source_name = feed.feed.get("title", "") or feed_url.split("/")[2]
            entries = []
            for entry in feed.entries:
                uid = entry.get("id") or entry.get("link", "")
                if not uid:
                    continue
                entries.append({
                    "article_id": uid,
                    "title": entry.get("title", ""),
                    "url": entry.get("link", ""),
                    "source": source_name,
                    "published": entry.get("published", ""),
                    "summary": entry.get("summary", ""),
                    "feed_description": entry.get("summary", ""),
                    "keywords": [],
                    "full_text": (
                        entry.get("content", [{}])[0].get("value", "")
                        if entry.get("content") else ""
                    ),
                })
            return feed_url, entries, None
        except Exception as exc:
            return feed_url, [], str(exc)

    articles: list[dict] = []
    seen_ids: set[str] = set()

    with ThreadPoolExecutor(max_workers=len(RSS_FEEDS)) as pool:
        futures = {pool.submit(_fetch_one, url): url for url in RSS_FEEDS}
        for future in as_completed(futures, timeout=FEED_TIMEOUT + 3):
            feed_url, entries, error = future.result()
            label = feed_url.split("/")[2] if "//" in feed_url else feed_url
            if error:
                if emit_fn:
                    emit_fn("rss_feed_skip", f"⚠ {label} — {error[:70]}")
                continue
            added = 0
            for entry in entries:
                uid = entry["article_id"]
                if uid in seen_ids:
                    continue
                seen_ids.add(uid)
                articles.append(entry)
                added += 1
                if len(articles) >= max_articles:
                    break
            if emit_fn:
                emit_fn("rss_feed", f"✓ {label} — {added} entries ({len(articles)} total)")
            if len(articles) >= max_articles:
                break

    return articles[:max_articles]


def fast_run_compliance(
    origin_countries: list[str],
    hs_codes: list[str],
    dest_port: str = "",
    max_articles: int = 20,
    emit_fn=None,
) -> list[dict]:
    """
    Fetch compliance-specific RSS feeds (Federal Register, FDA, APHIS, Food Safety News).
    Scores articles by: compliance keywords, HS codes, origin countries, destination port.
    Used exclusively by the ImportCompliance agent to get live regulatory context.
    """
    import requests
    from concurrent.futures import ThreadPoolExecutor, as_completed

    FEED_TIMEOUT = 7

    # Compliance signal keywords — things that indicate a regulatory requirement change
    COMPLIANCE_KEYWORDS = [
        "import requirement", "certificate of origin", "customs ruling", "import permit",
        "phytosanitary", "sanitary", "import alert", "detention", "FDA", "APHIS", "CBP",
        "customs declaration", "commercial invoice", "entry requirements", "import ban",
        "import restriction", "trade compliance", "country of origin", "prior notice",
        "fumigation", "inspection", "labeling requirement", "tariff classification",
    ]

    def _fetch_one(feed_url: str) -> tuple[str, list[dict], str | None]:
        try:
            resp = requests.get(
                feed_url, timeout=FEED_TIMEOUT,
                headers={"User-Agent": "CoastGuard-Compliance/1.0"},
            )
            resp.raise_for_status()
            feed = feedparser.parse(resp.content)
            source_name = feed.feed.get("title", "") or feed_url.split("/")[2]
            entries = []
            for entry in feed.entries:
                uid = entry.get("id") or entry.get("link", "")
                if not uid:
                    continue
                entries.append({
                    "article_id": uid,
                    "title": entry.get("title", ""),
                    "url": entry.get("link", ""),
                    "source": source_name,
                    "published": entry.get("published", ""),
                    "summary": entry.get("summary", ""),
                    "feed_description": entry.get("summary", ""),
                    "full_text": (
                        entry.get("content", [{}])[0].get("value", "")
                        if entry.get("content") else ""
                    ),
                })
            return feed_url, entries, None
        except Exception as exc:
            return feed_url, [], str(exc)

    def _score(article: dict) -> int:
        haystack = " ".join(filter(None, [
            article.get("title", ""),
            article.get("summary", ""),
            article.get("full_text", "")[:800],
        ])).lower()
        s = 0
        for kw in COMPLIANCE_KEYWORDS:
            if kw.lower() in haystack:
                s += 2
        for country in origin_countries:
            if country.lower() in haystack:
                s += 3
        for hs in hs_codes:
            if hs[:4] in haystack:  # match by chapter (first 4 digits)
                s += 4
        if dest_port and dest_port.lower() in haystack:
            s += 2
        return s

    all_entries: list[dict] = []
    seen_ids: set[str] = set()

    with ThreadPoolExecutor(max_workers=len(COMPLIANCE_RSS_FEEDS)) as pool:
        futures = {pool.submit(_fetch_one, url): url for url in COMPLIANCE_RSS_FEEDS}
        for future in as_completed(futures, timeout=FEED_TIMEOUT + 3):
            feed_url, entries, error = future.result()
            label = feed_url.split("/")[2] if "//" in feed_url else feed_url
            if error:
                if emit_fn:
                    emit_fn("compliance_feed_skip", f"⚠ {label} — {error[:70]}")
                continue
            added = 0
            for entry in entries:
                uid = entry["article_id"]
                if uid in seen_ids:
                    continue
                seen_ids.add(uid)
                all_entries.append(entry)
                added += 1
            if emit_fn:
                emit_fn("compliance_feed", f"✓ {label} — {added} compliance entries")

    # Return top-scored articles — compliance relevance ranked
    scored = sorted(all_entries, key=_score, reverse=True)
    top = scored[:max_articles]

    if emit_fn:
        matched = [a for a in top if _score(a) > 0]
        emit_fn("compliance_scored", f"{len(matched)} compliance articles matched HS codes/countries out of {len(top)} fetched")

    return top


def fast_run_alternatives(
    alternative_regions: list[str],
    product_categories: list[str],
    origin_countries: list[str],
    max_articles: int = 20,
    emit_fn=None,
) -> list[dict]:
    """
    Fetch supplier-stability RSS feeds for alternative sourcing regions.
    Scores articles by: positive/negative trade signals in alternative regions,
    product category conditions, and whether origin countries are also mentioned
    (which would indicate the event affects everyone, reducing value of switching).

    Positive signals boost score  → good conditions in alternative country
    Negative signals boost score  → risks in alternative country (agent should flag these)
    Both types are returned — the agent reasons about them.
    """
    import requests
    from concurrent.futures import ThreadPoolExecutor, as_completed

    FEED_TIMEOUT = 7

    # Signals that indicate a country is a GOOD alternative right now
    POSITIVE_SIGNALS = [
        "trade agreement", "free trade", "FTA", "CAFTA", "USMCA", "preferential tariff",
        "record export", "bumper harvest", "crop surplus", "production increase",
        "port expansion", "new terminal", "logistics improvement", "capacity increase",
        "quality certification", "USDA approved", "food safety approved",
        "investment", "infrastructure", "economic growth", "stable",
        "duty-free", "zero tariff", "trade deal",
    ]

    # Signals that indicate a country is RISKY as an alternative right now
    NEGATIVE_SIGNALS = [
        "strike", "port strike", "labor strike", "work stoppage", "walkout", "labor dispute",
        "political unrest", "protest", "riot", "coup", "election crisis", "instability",
        "drought", "flood", "hurricane", "earthquake", "crop failure", "supply shortage",
        "sanctions", "embargo", "trade restriction", "export ban", "export restriction",
        "corruption", "fraud", "counterfeit", "smuggling",
        "port congestion", "shipping delay", "backlog", "customs delay",
        "tariff increase", "new tariff", "new tax", "duty increase",
        "currency crisis", "devaluation", "inflation",
    ]

    def _fetch_one(feed_url: str) -> tuple[str, list[dict], str | None]:
        try:
            resp = requests.get(
                feed_url, timeout=FEED_TIMEOUT,
                headers={"User-Agent": "CoastGuard-Alternatives/1.0"},
            )
            resp.raise_for_status()
            feed = feedparser.parse(resp.content)
            source_name = feed.feed.get("title", "") or feed_url.split("/")[2]
            entries = []
            for entry in feed.entries:
                uid = entry.get("id") or entry.get("link", "")
                if not uid:
                    continue
                entries.append({
                    "article_id": uid,
                    "title": entry.get("title", ""),
                    "url": entry.get("link", ""),
                    "source": source_name,
                    "published": entry.get("published", ""),
                    "summary": entry.get("summary", ""),
                    "feed_description": entry.get("summary", ""),
                    "full_text": (
                        entry.get("content", [{}])[0].get("value", "")
                        if entry.get("content") else ""
                    ),
                })
            return feed_url, entries, None
        except Exception as exc:
            return feed_url, [], str(exc)

    def _score(article: dict) -> int:
        haystack = " ".join(filter(None, [
            article.get("title", ""),
            article.get("summary", ""),
            article.get("full_text", "")[:800],
        ])).lower()

        s = 0
        # Alternative regions mentioned — this is the core relevance signal
        for region in alternative_regions:
            if region.lower() in haystack:
                s += 4
        # Product category relevance
        for cat in product_categories:
            if cat.lower() in haystack:
                s += 3
        # Positive stability signals
        for sig in POSITIVE_SIGNALS:
            if sig.lower() in haystack:
                s += 2
        # Negative risk signals (also scored positively — agent needs to see both)
        for sig in NEGATIVE_SIGNALS:
            if sig.lower() in haystack:
                s += 2
        # If origin country is also affected, the article is less useful
        # (a global event isn't a reason to switch suppliers)
        for country in origin_countries:
            if country.lower() in haystack:
                s -= 1
        return max(s, 0)

    all_entries: list[dict] = []
    seen_ids: set[str] = set()

    with ThreadPoolExecutor(max_workers=len(ALTERNATIVES_RSS_FEEDS)) as pool:
        futures = {pool.submit(_fetch_one, url): url for url in ALTERNATIVES_RSS_FEEDS}
        for future in as_completed(futures, timeout=FEED_TIMEOUT + 3):
            feed_url, entries, error = future.result()
            label = feed_url.split("/")[2] if "//" in feed_url else feed_url
            if error:
                if emit_fn:
                    emit_fn("alt_feed_skip", f"⚠ {label} — {error[:70]}")
                continue
            added = 0
            for entry in entries:
                uid = entry["article_id"]
                if uid in seen_ids:
                    continue
                seen_ids.add(uid)
                all_entries.append(entry)
                added += 1
            if emit_fn:
                emit_fn("alt_feed", f"✓ {label} — {added} entries")

    scored = sorted(all_entries, key=_score, reverse=True)
    top = scored[:max_articles]

    if emit_fn:
        matched = [a for a in top if _score(a) > 0]
        emit_fn("alt_scored", f"{len(matched)} supplier-region articles matched out of {len(all_entries)} fetched")

    return top


# Alias used by main.py and api/v2/monitor_routes.py
scrape_rss_feeds = run


if __name__ == "__main__":
    run()
