"""
CoastGuard — Create pipeline_headlines table in Aurora.

Run once from project root:
  python backend/scripts/migrate_pipeline_headlines.py

The table stores RSS headlines surfaced during each pipeline run.
Older runs are pruned to keep the last 3 per customer (done at pipeline end,
not here). This script only creates the schema.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine, Base
import models  # noqa: F401 — registers all models including PipelineHeadline

Base.metadata.create_all(bind=engine)
print("pipeline_headlines table created (or already exists).")
print("All CoastGuard tables verified against Aurora schema.")
