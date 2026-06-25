"""baseline schema

Captures the full current schema (models/__init__.py) as the Alembic
baseline. Uses Base.metadata.create_all/drop_all directly rather than
hand-written op.create_table() calls for every column, since this is meant
to describe "everything that exists right now," not a single incremental change.

For a FRESH database: `alembic upgrade head` creates every table.
For the existing populated Aurora database (tables already created ad hoc
via Base.metadata.create_all() at app startup): run `alembic stamp head`
instead — this records the baseline as applied without re-running DDL
against tables that already exist. All migrations after this one should be
written as normal incremental op.* calls.

Revision ID: 409ecf1f09d7
Revises:
Create Date: 2026-06-24 23:35:28.560621

"""
from typing import Sequence, Union

from alembic import op

from database import Base
import models  # noqa: F401 — registers all model classes on Base.metadata


# revision identifiers, used by Alembic.
revision: str = '409ecf1f09d7'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
