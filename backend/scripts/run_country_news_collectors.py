"""
CoastGuard — Run the tariff news collector for every country any customer
actually sources from.

Reads BusinessProfile.primary_origin_countries across all customers in
Aurora, converts each ISO-2 code to a full country name (via
services/coordinates.get_country_name), and runs
collectors/tariff.run_for_countries() for that set.

This is the "proper means" of grounding events for whatever countries are
in the live data — today that's India, South Africa (Acme Imports) and the
Netherlands (NorthStar Electronics), but if a future customer's profile
lists e.g. Vietnam or Mexico, running this script again will pull news for
those too without any code changes.

Run:
    python scripts/run_country_news_collectors.py [max_articles_per_country]
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
import models  # noqa: F401
from services.coordinates import get_country_name
from collectors.tariff import run_for_countries


def get_target_countries(db) -> list[str]:
    codes: set[str] = set()

    for profile in db.query(models.BusinessProfile).all():
        for code in profile.primary_origin_countries or []:
            codes.add(code)

    return sorted({get_country_name(code) for code in codes})


def main():
    max_articles = int(sys.argv[1]) if len(sys.argv) > 1 else 3

    db = SessionLocal()
    try:
        countries = get_target_countries(db)
    finally:
        db.close()

    if not countries:
        print("No BusinessProfile.primary_origin_countries found — run scripts/seed_business_profile.py first.")
        return

    print(f"Target countries (from BusinessProfile.primary_origin_countries): {countries}")

    new_records = run_for_countries(countries, max_articles_per_country=max_articles)

    print()
    print(f"Added {len(new_records)} new article(s):")
    for r in new_records:
        print(f"  - [{r['country_mentions']}] {r['title'][:90]} ({r['domain']})")


if __name__ == "__main__":
    main()
