"""
CoastGuard — Aurora v3 Migration (cumulative)
Creates agent_run_logs table AND re-applies the v2 historical_impacts columns
in case they didn't land (IF NOT EXISTS makes this idempotent).

Run once from project root:
  python backend/scripts/migrate_aurora_v3.py

Safe to re-run: all statements use IF NOT EXISTS.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine, SessionLocal, Base
import models  # noqa — registers all models including AgentRunLog


def run():
    print("CoastGuard — Aurora v3 migration (cumulative)\n")

    # 1. Create all tables (new ones: agent_run_logs; existing ones: skipped)
    print("Creating missing tables...")
    Base.metadata.create_all(bind=engine)
    print("  Done.\n")

    # 2. Re-apply v2 historical_impacts columns (IF NOT EXISTS = idempotent)
    V2_COLS = [
        ("run_id",                           "VARCHAR(64)"),
        ("customer_id",                      "INTEGER"),
        ("alert_id",                         "INTEGER"),
        ("severity",                         "VARCHAR(50)"),
        ("adversarial_verdict",              "VARCHAR(20)"),
        ("affected_hs_codes",                "JSON"),
        ("affected_countries",               "JSON"),
        ("articles_matched",                 "INTEGER DEFAULT 0"),
        ("source_credibility",               "VARCHAR(500)"),
        ("signal_age_hours",                 "FLOAT"),
        ("risk_source",                      "VARCHAR(100)"),
        ("supplier_alternatives_found",      "INTEGER DEFAULT 0"),
        ("best_alternative_lead_time_weeks", "INTEGER"),
        ("resolution_days",                  "INTEGER"),
    ]

    print("Ensuring historical_impacts v2 columns exist...")
    with engine.connect() as conn:
        for col_name, col_type in V2_COLS:
            try:
                conn.execute(text(
                    f"ALTER TABLE historical_impacts ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                ))
                print(f"  + historical_impacts.{col_name}")
            except Exception as e:
                print(f"  ! {col_name}: {e}")
        conn.commit()
    print()

    # 3. Indexes
    print("Adding indexes...")
    with engine.connect() as conn:
        index_stmts = [
            "CREATE INDEX IF NOT EXISTS ix_historical_impacts_run_id ON historical_impacts (run_id)",
            "CREATE INDEX IF NOT EXISTS ix_historical_impacts_customer_id ON historical_impacts (customer_id)",
            "CREATE INDEX IF NOT EXISTS ix_agent_runs_customer_id ON agent_runs (customer_id)",
            "CREATE INDEX IF NOT EXISTS ix_rss_articles_run_id ON rss_articles (run_id)",
            "CREATE INDEX IF NOT EXISTS ix_supplier_recommendations_customer_id ON supplier_recommendations (customer_id)",
            "CREATE INDEX IF NOT EXISTS ix_agent_run_logs_run_id ON agent_run_logs (run_id)",
            "CREATE INDEX IF NOT EXISTS ix_agent_run_logs_customer_id ON agent_run_logs (customer_id)",
            "CREATE INDEX IF NOT EXISTS ix_agent_run_logs_agent_name ON agent_run_logs (agent_name)",
        ]
        for stmt in index_stmts:
            try:
                conn.execute(text(stmt))
                idx_name = stmt.split("INDEX IF NOT EXISTS ")[1].split(" ON")[0]
                print(f"  + {idx_name}")
            except Exception as e:
                print(f"  ! {e}")
        conn.commit()
    print()

    # 4. Verify
    print("Verifying row counts...")
    with engine.connect() as conn:
        tables = [
            "customers", "tariff_alerts", "disruption_events",
            "historical_impacts", "agent_runs", "agent_run_logs",
            "rss_articles", "supplier_recommendations", "global_suppliers",
        ]
        for t in tables:
            try:
                row = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
                print(f"  {t:<30} {row} rows")
            except Exception as e:
                print(f"  {t:<30} ERROR: {e}")

    print("\nMigration complete.")


if __name__ == "__main__":
    run()
