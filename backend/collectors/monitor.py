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

    "https://www.supplychaindive.com/feeds/news/",

    "https://theloadstar.com/feed/",

    "https://www.fibre2fashion.com/rss/latest-news.xml"

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


# Alias used by main.py and api/v2/monitor_routes.py
scrape_rss_feeds = run


if __name__ == "__main__":
    run()
