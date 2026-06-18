"""
CoastGuard — Aurora v2 Migration
Adds new columns to historical_impacts and creates agent_runs, rss_articles,
supplier_recommendations tables.

Run once from project root:
  python backend/scripts/migrate_aurora_v2.py

Safe to re-run: all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine, SessionLocal, Base
import models  # noqa — registers all models


def run():
    print("CoastGuard — Aurora v2 migration\n")

    # 1. Create new tables (rss_articles, agent_runs, supplier_recommendations)
    print("Creating new tables if they don't exist...")
    Base.metadata.create_all(bind=engine)
    print("  Done.\n")

    # 2. Add new columns to historical_impacts (IF NOT EXISTS = idempotent)
    NEW_COLS = [
        ("run_id",                       "VARCHAR(64)"),
        ("customer_id",                  "INTEGER"),
        ("alert_id",                     "INTEGER"),
        ("severity",                     "VARCHAR(50)"),
        ("adversarial_verdict",          "VARCHAR(20)"),
        ("affected_hs_codes",            "JSON"),
        ("affected_countries",           "JSON"),
        ("articles_matched",             "INTEGER DEFAULT 0"),
        ("source_credibility",           "VARCHAR(500)"),
        ("signal_age_hours",             "FLOAT"),
        ("risk_source",                  "VARCHAR(100)"),
        ("supplier_alternatives_found",  "INTEGER DEFAULT 0"),
        ("best_alternative_lead_time_weeks", "INTEGER"),
        ("resolution_days",              "INTEGER"),
    ]

    print("Adding new columns to historical_impacts...")
    with engine.connect() as conn:
        for col_name, col_type in NEW_COLS:
            try:
                conn.execute(text(
                    f"ALTER TABLE historical_impacts ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                ))
                print(f"  + historical_impacts.{col_name}")
            except Exception as e:
                print(f"  ! {col_name}: {e}")
        conn.commit()

    print("\nAdding indexes...")
    with engine.connect() as conn:
        index_stmts = [
            "CREATE INDEX IF NOT EXISTS ix_historical_impacts_run_id ON historical_impacts (run_id)",
            "CREATE INDEX IF NOT EXISTS ix_historical_impacts_customer_id ON historical_impacts (customer_id)",
            "CREATE INDEX IF NOT EXISTS ix_agent_runs_customer_id ON agent_runs (customer_id)",
            "CREATE INDEX IF NOT EXISTS ix_rss_articles_run_id ON rss_articles (run_id)",
            "CREATE INDEX IF NOT EXISTS ix_supplier_recommendations_customer_id ON supplier_recommendations (customer_id)",
        ]
        for stmt in index_stmts:
            try:
                conn.execute(text(stmt))
                print(f"  + {stmt.split('INDEX IF NOT EXISTS ')[1].split(' ON')[0]}")
            except Exception as e:
                print(f"  ! {e}")
        conn.commit()

    print("\nVerifying row counts...")
    db = SessionLocal()
    try:
        from models import HistoricalImpact, AgentRun, RssArticle, SupplierRecommendation
        print(f"  historical_impacts:       {db.query(HistoricalImpact).count()} rows")
        print(f"  agent_runs:               {db.query(AgentRun).count()} rows")
        print(f"  rss_articles:             {db.query(RssArticle).count()} rows")
        print(f"  supplier_recommendations: {db.query(SupplierRecommendation).count()} rows")
    finally:
        db.close()

    print("\nMigration complete.")


if __name__ == "__main__":
    run()
