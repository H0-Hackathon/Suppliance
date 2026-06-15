"""
CoastGuard — Tariff news collector.

Scrapes Bing News + Google News for tariff/trade-policy articles, extracts
full text + structured signals (countries, products, trade actions, tariff
percentages, relevance score), and writes them to data/tariff_dataset.jsonl.

This is the primary event source for the Monitor Agent (Agent 1) — see
core/monitor_agent.py — which normalizes these records into structured
risk events without any LLM call.

Run on demand:
    python -m collectors.tariff                  # default fixed search terms
    python -m collectors.scripts.run_country_news_collectors  # per-country, see scripts/
"""

import requests
import trafilatura
import json
import hashlib
import re
import sys
import time
import pathlib

from bs4 import BeautifulSoup
from datetime import datetime, UTC
from urllib.parse import urlparse, quote_plus

from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

import feedparser

from googlenewsdecoder import gnewsdecoder

from services.coordinates import COUNTRY_COORDINATES

# Article titles often contain non-ASCII characters (accents, Turkish "ı",
# curly quotes, etc.). On Windows the console/redirected-file encoding is
# cp1252, which raises UnicodeEncodeError on print() for those characters.
# Reconfigure stdout/stderr to UTF-8 (with replacement) so collection never
# crashes mid-run on a single article title.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

# ==========================================================
# CONFIG
# ==========================================================

DATA_DIR = pathlib.Path(__file__).resolve().parent.parent / "data"
OUTPUT_FILE = DATA_DIR / "tariff_dataset.jsonl"

MAX_ARTICLES = 10

HEADERS = {
    "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

# ==========================================================
# SESSION WITH RETRIES
# ==========================================================

session = requests.Session()

retries = Retry(
    total=3,
    connect=3,
    read=3,
    backoff_factor=1,
    status_forcelist=[
        429,
        500,
        502,
        503,
        504
    ]
)

adapter = HTTPAdapter(max_retries=retries)

session.mount("http://", adapter)
session.mount("https://", adapter)

# ==========================================================
# SEARCH TERMS
# ==========================================================
SEARCH_TERMS = [

    "tariff",

    "tariffs",

    "trade policy",

    "trade deal",

    "trade agreement",

    "reciprocal tariff",

    "section 301 tariff",

    "section 232 tariff",

    "USTR tariff",

    "DGFT notification",

    "export restriction",

    "export control",

    "anti-dumping",

    "countervailing duty",

    "customs duty",

    "import duty",

    "trade war",

    "WTO trade dispute",

    "India US trade",

    "China tariff"
]

# ==========================================================
# DOMAIN FILTER
# ==========================================================

GOOD_DOMAINS = [

    "reuters.com",

    "livemint.com",

    "financialexpress.com",

    "timesofindia.com",

    "hindustantimes.com",

    "firstpost.com",

    "business-standard.com",

    "economictimes.com",

    "thehindu.com",

    "thehindubusinessline.com",

    "cnbc.com"
]

# ==========================================================
# RELEVANCE TERMS
# ==========================================================

TARIFF_TERMS = [

    "tariff",
    "tariffs",

    "trade policy",

    "customs duty",

    "import duty",

    "trade war",

    "anti-dumping",

    "countervailing",

    "section 301",

    "section 232",

    "export restriction",

    "export control",

    "wto",

    "ustr",

    "dgft"
]

# ==========================================================
# COUNTRIES
#
# Derived from services/coordinates.py so this stays in sync with every
# country a customer's BusinessProfile can list — adding a country there
# automatically makes it detectable here as a country_mention, without
# editing this collector. "european union" is kept as an extra bloc-level
# term since trade-policy articles often refer to the EU rather than a
# single member state.
# ==========================================================

COUNTRIES = sorted(
    {loc["country_name"].lower() for loc in COUNTRY_COORDINATES.values()}
    | {"european union"}
)

# ==========================================================
# NATIONALITY ALIASES
#
# Articles often refer to a country by demonym/adjective rather than its
# name (e.g. "Dutch exporters" rather than "Netherlands"). For most
# countries the demonym contains the country name as a substring (e.g.
# "Indian" contains "india"), so extract_matches() already catches those.
# This dict covers the ones that don't, mapping demonym -> COUNTRIES entry.
# ==========================================================

NATIONALITY_ALIASES: dict[str, str] = {
    "mexican": "mexico",
    "thai": "thailand",
    "dutch": "netherlands",
    "german": "germany",
    "french": "france",
    "british": "united kingdom",
    "britain": "united kingdom",
    "italian": "italy",
    "spanish": "spain",
    "korean": "south korea",
    "filipino": "philippines",
    "turkish": "turkey",
    "argentine": "argentina",
    "argentinian": "argentina",
    "saudi": "saudi arabia",
    "emirati": "united arab emirates",
    "uae": "united arab emirates",
    "polish": "poland",
    "czech": "czech republic",
    "greek": "greece",
    "portuguese": "portugal",
    "belgian": "belgium",
    "swiss": "switzerland",
    "swedish": "sweden",
    "norwegian": "norway",
    "danish": "denmark",
    "finnish": "finland",
    "irish": "ireland",
    "hungarian": "hungary",
    "ukrainian": "ukraine",
}

# ==========================================================
# PRODUCTS
# ==========================================================

PRODUCTS = [

    "steel",
    "aluminum",
    "automobile",
    "vehicle",
    "semiconductor",
    "chip",
    "electronics",
    "battery",
    "solar",
    "textile",
    "cotton",
    "garment",
    "apparel",
    "pharmaceutical",
    "food",
    "agriculture"
]

# ==========================================================
# TRADE ACTIONS
# ==========================================================

TRADE_ACTIONS = [

    "imposed",

    "raised",

    "increased",

    "reduced",

    "removed",

    "announced",

    "retaliated",

    "suspended",

    "expanded",

    "extended",

    "exempted"
]
TRADE_ENTITIES = [

    "ustr",

    "wto",

    "dgft",

    "commerce department",

    "trade ministry",

    "customs",

    "white house",

    "treasury department"
]
# ==========================================================
# HELPERS
# ==========================================================

def extract_matches(text, terms):

    text_lower = text.lower()

    return sorted(list(set(

        term

        for term in terms

        if term in text_lower
    )))


def extract_countries(text):
    """
    Country mentions, including ones only referred to by demonym/adjective
    (see NATIONALITY_ALIASES) — e.g. an article saying "Dutch exporters"
    will register "netherlands" as a country mention even though the word
    "netherlands" never appears.
    """

    text_lower = text.lower()

    matches = set(extract_matches(text, COUNTRIES))

    for demonym, country in NATIONALITY_ALIASES.items():
        if demonym in text_lower:
            matches.add(country)

    return sorted(matches)

def extract_percentages(text):

    return sorted(list(set(

        re.findall(
            r"\d+(?:\.\d+)?%",
            text
        )
    )))

def calculate_relevance(text):

    text_lower = text.lower()

    score = 0

    matched_terms = []

    for term in TARIFF_TERMS:

        count = text_lower.count(term)

        if count > 0:

            score += min(count, 5)

            matched_terms.append(term)

    return score, matched_terms

# ==========================================================
# BING SEARCH
# ==========================================================

def get_bing_articles(search_term):

    try:

        url = (
            "https://www.bing.com/news/search?q="
            + search_term
        )

        response = session.get(
            url,
            headers=HEADERS,
            timeout=(5, 15)
        )

        soup = BeautifulSoup(
            response.text,
            "html.parser"
        )

        urls = []

        for a in soup.select("a.title"):

            href = a.get("href")

            if href:

                urls.append({

                    "title":
                        a.get_text(
                            strip=True
                        ),

                    "url":
                        href
                })

        return urls

    except Exception as e:

        print(
            f"Bing Error: {search_term}"
        )

        print(e)

        return []

# ==========================================================
# GOOGLE NEWS RSS SEARCH
# ==========================================================

def get_google_news_articles(search_term, max_results=10):
    """
    Fetch article title/url candidates from Google News RSS for a search
    term. Returns the same [{"title": ..., "url": ...}, ...] shape as
    get_bing_articles() so both feed the same extract_article() pipeline.

    Google News RSS entries link to a news.google.com redirect page (a JS
    app shell with no extractable article text), not the publisher's page.
    Each link is resolved to its real source URL via gnewsdecoder() before
    being returned; entries that fail to decode are dropped.
    """

    try:

        url = (
            "https://news.google.com/rss/search?q="
            + quote_plus(search_term)
            + "&hl=en-US&gl=US&ceid=US:en"
        )

        feed = feedparser.parse(url)

        results = []

        for entry in feed.entries[:max_results]:

            link = getattr(entry, "link", None)
            if not link:
                continue

            try:
                decoded = gnewsdecoder(link)
            except Exception:
                continue

            if not decoded.get("status"):
                continue

            results.append({"title": entry.title, "url": decoded["decoded_url"]})

        return results

    except Exception as e:

        print(
            f"Google News Error: {search_term}"
        )

        print(e)

        return []

# ==========================================================
# ARTICLE EXTRACTION
# ==========================================================

def extract_article(url):

    try:

        response = session.get(
            url,
            headers=HEADERS,
            timeout=(5, 15)
        )

        if response.status_code != 200:
            return None

        # Use the post-redirect URL for domain/source_url — Google News RSS
        # links go through a news.google.com redirect, so the original `url`
        # would otherwise record "news.google.com" instead of the publisher.
        resolved_url = response.url or url

        text = trafilatura.extract(
            response.text,
            include_tables=True,
            include_comments=False
        )

        if not text:
            return None

        if len(text) < 500:
            return None

        relevance_score, matched_terms = \
            calculate_relevance(text)

        if relevance_score < 5:
            return None

        content_hash = hashlib.sha256(
            text.encode("utf-8")
        ).hexdigest()

        article_id = hashlib.sha256(
            url.encode("utf-8")
        ).hexdigest()

        return {

            "article_id":
                article_id,

            "content_hash":
                content_hash,

            "source_type":
                "tariff",

            "collector_version":
                "2.0",

            "url":
                url,

            "domain":
                urlparse(resolved_url).netloc,

            "summary":
                text[:2000],

            "full_text":
                text,

            "text_length":
                len(text),

            "relevance_score":
                relevance_score,

            "matched_terms":
                matched_terms,

            "country_mentions":
                extract_countries(
                    text
                ),

            "products_mentioned":
                extract_matches(
                    text,
                    PRODUCTS
                ),

            "trade_actions":
                extract_matches(
                    text,
                    TRADE_ACTIONS
                ),

            "tariff_percentages":
                extract_percentages(
                    text
                ),
            "trade_entities":
                extract_matches(
                    text,
                    TRADE_ENTITIES
                ),
            "event_keywords":
                sorted(
                    list(
                        set(
                            extract_countries(text)
                            +
                            extract_matches(text, PRODUCTS)
                            +
                            extract_matches(text, TRADE_ENTITIES)
                            +
                            extract_matches(text, TRADE_ACTIONS)
                        )
                    )
                ),
            "source_url": resolved_url,
            "scraped_at":
                datetime.now(
                    UTC
                ).isoformat()

        }

    except Exception as e:

        print(
            f"Extraction failed: {url}"
        )

        print(e)

        return None

# ==========================================================
# MAIN
# ==========================================================

def run(max_articles: int = MAX_ARTICLES, output_file: pathlib.Path = OUTPUT_FILE) -> list[dict]:
    """Run the collector and write data/tariff_dataset.jsonl. Returns the dataset."""

    dataset = []

    seen_urls = set()
    seen_content = set()

    for search_term in SEARCH_TERMS:

        print()
        print("=" * 60)
        print(f"SEARCHING: {search_term}")
        print("=" * 60)

        if len(dataset) >= max_articles:
            break

        articles = get_bing_articles(
            search_term
        )

        time.sleep(2)

        for article in articles:

            if len(dataset) >= max_articles:
                break

            title = article["title"]

            url = article["url"]

            if not url.startswith("http"):
                continue

            domain = urlparse(url).netloc.lower()

            if not any(
                good in domain
                for good in GOOD_DOMAINS
            ):
                continue

            if url in seen_urls:
                continue

            print(
                f"Checking: {title[:100]}"
            )

            try:

                record = extract_article(
                    url
                )

            except Exception as e:

                print(
                    f"FAILED ARTICLE: {url}"
                )

                print(e)

                continue

            if not record:
                continue

            if (
                record["content_hash"]
                in seen_content
            ):
                continue

            seen_urls.add(url)

            seen_content.add(
                record["content_hash"]
            )

            record["title"] = title

            record["source"] = domain
            record["published"] = ""

            dataset.append(
                record
            )

            print(
                f"Saved | Score: {record['relevance_score']}"
            )

            time.sleep(0.25)

    dataset.sort(
        key=lambda x:
            x["relevance_score"],
        reverse=True
    )

    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(
        output_file,
        "w",
        encoding="utf-8"
    ) as f:

        for row in dataset:

            f.write(
                json.dumps(
                    row,
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


# ==========================================================
# PER-COUNTRY COLLECTION (additive, country-agnostic)
# ==========================================================

def _load_existing(output_file: pathlib.Path) -> list[dict]:
    if not output_file.exists():
        return []

    rows = []

    with open(output_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    return rows


def run_for_countries(
    countries: list[str],
    max_articles_per_country: int = 3,
    output_file: pathlib.Path = OUTPUT_FILE,
) -> list[dict]:
    """
    Country-agnostic live news collection: for each country name, search
    Google News (with Bing as a fallback) for tariff/trade-policy articles
    and merge newly-found records into output_file.

    This is additive — existing rows in output_file are kept, new rows are
    appended and deduped by content_hash/url, then the whole file is
    re-sorted by relevance_score and rewritten.

    Unlike run(), this does not filter by GOOD_DOMAINS (that allowlist is
    India-news-centric and would exclude legitimate sources for most other
    countries). Instead, an article only counts for a given country if its
    extracted `country_mentions` actually include that country — combined
    with extract_article()'s existing relevance_score/length gates, this
    keeps quality high without hardcoding a domain list per country.

    `countries` should be full country names (e.g. "South Africa", "Vietnam")
    — see services/coordinates.get_country_name() to convert from ISO codes.
    """

    existing = _load_existing(output_file)
    seen_urls = {row["url"] for row in existing if "url" in row}
    seen_content = {row["content_hash"] for row in existing if "content_hash" in row}

    new_records: list[dict] = []

    for country in countries:

        country_lower = country.lower()
        added_for_country = 0

        for query in (f"{country} tariff", f"{country} trade policy"):

            if added_for_country >= max_articles_per_country:
                break

            print()
            print("=" * 60)
            print(f"SEARCHING ({country}): {query}")
            print("=" * 60)

            candidates = get_google_news_articles(query)
            time.sleep(1)
            candidates += get_bing_articles(query)
            time.sleep(1)

            for article in candidates:

                if added_for_country >= max_articles_per_country:
                    break

                url = article.get("url")
                if not url or not url.startswith("http"):
                    continue

                if url in seen_urls:
                    continue

                print(f"Checking: {article['title'][:100]}")

                try:
                    record = extract_article(url)
                except Exception as e:
                    print(f"FAILED ARTICLE: {url}")
                    print(e)
                    continue

                if not record:
                    continue

                if record["content_hash"] in seen_content:
                    continue

                if country_lower not in [c.lower() for c in record["country_mentions"]]:
                    continue

                seen_urls.add(url)
                seen_content.add(record["content_hash"])

                record["title"] = article["title"]
                record["source"] = record["domain"]
                record["published"] = ""

                new_records.append(record)
                added_for_country += 1

                print(
                    f"Saved | Country: {country} | Score: {record['relevance_score']}"
                )

                time.sleep(0.25)

    dataset = existing + new_records
    dataset.sort(key=lambda x: x["relevance_score"], reverse=True)

    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        for row in dataset:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print()
    print("=" * 60)
    print(f"NEW ARTICLES: {len(new_records)}")
    print(f"TOTAL ARTICLES: {len(dataset)}")
    print(f"OUTPUT FILE: {output_file}")
    print("=" * 60)

    return new_records


if __name__ == "__main__":
    run()
