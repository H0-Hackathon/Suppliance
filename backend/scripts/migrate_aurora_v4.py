"""
CoastGuard — Aurora v4 Migration
Adds agent_target column to rss_articles so each buffered article is tagged
with which agent it belongs to (tariff_monitor | alternatives_finder | import_compliance).

Run once from project root:
  python backend/scripts/migrate_aurora_v4.py

Safe to re-run: uses IF NOT EXISTS.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine


def run():
    print("CoastGuard — Aurora v4 migration\n")

    print("Adding agent_target column to rss_articles...")
    with engine.connect() as conn:
        try:
            conn.execute(text(
                "ALTER TABLE rss_articles ADD COLUMN IF NOT EXISTS agent_target VARCHAR(50)"
            ))
            conn.commit()
            print("  + rss_articles.agent_target")
        except Exception as e:
            print(f"  ! {e}")

    print("\nAdding index on agent_target...")
    with engine.connect() as conn:
        try:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_rss_articles_agent_target ON rss_articles (agent_target)"
            ))
            conn.commit()
            print("  + ix_rss_articles_agent_target")
        except Exception as e:
            print(f"  ! {e}")

    print("\nVerifying rss_articles columns...")
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_name = 'rss_articles' ORDER BY ordinal_position"
        )).fetchall()
        for r in rows:
            print(f"  {r[0]:<30} {r[1]}")

    print("\nMigration complete.")


if __name__ == "__main__":
    run()
