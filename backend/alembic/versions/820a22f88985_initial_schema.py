"""initial_schema

Revision ID: 820a22f88985
Revises:
Create Date: 2026-03-28 14:06:14.067436

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '820a22f88985'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- vendors ---
    op.create_table(
        "vendors",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("phone_number", sa.String(20), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("pin_hash", sa.String(255), nullable=False),
        sa.Column(
            "preferred_language",
            sa.Enum("HT", "FR", "EN", name="preferredlanguage"),
            nullable=False,
        ),
        sa.Column("market_zone", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("failed_login_attempts", sa.Integer(), nullable=False),
        sa.Column("locked_until", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_vendors_phone_number", "vendors", ["phone_number"], unique=True)

    # --- products ---
    op.create_table(
        "products",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("vendor_id", sa.Uuid(), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("name_creole", sa.String(200), nullable=True),
        sa.Column("unit", sa.String(50), nullable=False),
        sa.Column("current_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("stock_quantity", sa.Numeric(10, 2), nullable=False),
        sa.Column("low_stock_threshold", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_products_vendor_id", "products", ["vendor_id"])

    # --- transactions ---
    op.create_table(
        "transactions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("vendor_id", sa.Uuid(), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.Uuid(), sa.ForeignKey("products.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "transaction_type",
            sa.Enum("SALE", "PURCHASE", "ADJUSTMENT", name="transactiontype"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recorded_offline", sa.Boolean(), nullable=False),
        sa.Column("synced_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_transactions_vendor_id", "transactions", ["vendor_id"])

    # --- credit_entries ---
    op.create_table(
        "credit_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("vendor_id", sa.Uuid(), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_name", sa.String(200), nullable=False),
        sa.Column("customer_phone", sa.String(20), nullable=True),
        sa.Column(
            "entry_type",
            sa.Enum("CREDIT_GIVEN", "PAYMENT_RECEIVED", name="creditentrytype"),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("balance_after", sa.Numeric(10, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("reminder_sent", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_credit_entries_vendor_id", "credit_entries", ["vendor_id"])

    # --- reports ---
    op.create_table(
        "reports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("vendor_id", sa.Uuid(), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "report_type",
            sa.Enum("DAILY", "WEEKLY", name="reporttype"),
            nullable=False,
        ),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("total_revenue", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("net_profit", sa.Numeric(12, 2), nullable=False),
        sa.Column("report_image_url", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_reports_vendor_id", "reports", ["vendor_id"])


def downgrade() -> None:
    op.drop_table("reports")
    op.drop_table("credit_entries")
    op.drop_table("transactions")
    op.drop_table("products")
    op.drop_table("vendors")
    op.execute("DROP TYPE IF EXISTS reporttype")
    op.execute("DROP TYPE IF EXISTS creditentrytype")
    op.execute("DROP TYPE IF EXISTS transactiontype")
    op.execute("DROP TYPE IF EXISTS preferredlanguage")
