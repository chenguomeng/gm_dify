"""add chengm xiaoyz card-draw tables

定制 by chengm xiaoyz抽卡模块 建表迁移

Revision ID: b1c2d3e4f5a6
Revises: 7a1c2d9e4b60
Create Date: 2026-08-09 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

import models

# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "7a1c2d9e4b60"
branch_labels = None
depends_on = None


def _uuid_pk():
    kwargs = {"nullable": False}
    if op.get_bind().dialect.name == "postgresql":
        kwargs["server_default"] = sa.text("uuidv7()")
    return sa.Column("id", models.types.StringUUID(), **kwargs)


def _timestamps():
    return (
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )


def upgrade() -> None:
    op.create_table(
        "chengm_xiaoyz_config",
        _uuid_pk(),
        sa.Column("name", sa.String(length=255), nullable=False, comment="配置名称"),
        sa.Column("description", models.types.LongText(), nullable=True, comment="配置描述"),
        sa.Column("draw_count_per_time", sa.Integer(), nullable=False, comment="每次抽卡数量"),
        sa.Column("status", sa.String(length=50), nullable=False, comment="状态: active/archived"),
        sa.Column("tenant_id", models.types.StringUUID(), nullable=True, comment="租户ID"),
        sa.Column("created_by", models.types.StringUUID(), nullable=True, comment="创建者ID"),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="chengm_xiaoyz_config_pkey"),
    )
    op.create_index("idx_chengm_xiaoyz_config_tenant", "chengm_xiaoyz_config", ["tenant_id"])
    op.create_index("idx_chengm_xiaoyz_config_status", "chengm_xiaoyz_config", ["status"])

    op.create_table(
        "chengm_xiaoyz_rarity_config",
        _uuid_pk(),
        sa.Column("config_id", models.types.StringUUID(), nullable=False, comment="关联主配置ID"),
        sa.Column("rarity", sa.String(length=10), nullable=False, comment="稀有度等级: SSR/SR/R"),
        sa.Column("rarity_name", sa.String(length=100), nullable=True, comment="稀有度显示名称"),
        sa.Column("probability", sa.Float(), nullable=False, comment="概率 0.0000~1.0000"),
        sa.Column("dify_app_id", sa.String(length=255), nullable=False, comment="Dify应用ID"),
        sa.Column("dify_app_name", sa.String(length=255), nullable=True, comment="Dify应用名称（冗余）"),
        sa.Column("input_mapping", models.types.LongText(), nullable=True, comment="输入变量映射 JSON"),
        sa.Column("output_mapping", models.types.LongText(), nullable=True, comment="输出变量映射 JSON"),
        sa.Column("sort_order", sa.Integer(), nullable=False, comment="排序"),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="chengm_xiaoyz_rarity_config_pkey"),
    )
    op.create_index("idx_chengm_xiaoyz_rarity_config_id", "chengm_xiaoyz_rarity_config", ["config_id"])

    op.create_table(
        "chengm_xiaoyz_draw_record",
        _uuid_pk(),
        sa.Column("config_id", models.types.StringUUID(), nullable=True, comment="关联配置ID"),
        sa.Column("user_id", models.types.StringUUID(), nullable=False, comment="用户ID"),
        sa.Column("draw_count", sa.Integer(), nullable=False, comment="本次抽取数量"),
        sa.Column("results", models.types.LongText(), nullable=True, comment="抽卡结果JSON"),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="chengm_xiaoyz_draw_record_pkey"),
    )
    op.create_index("idx_chengm_xiaoyz_draw_record_user", "chengm_xiaoyz_draw_record", ["user_id"])
    op.create_index("idx_chengm_xiaoyz_draw_record_config", "chengm_xiaoyz_draw_record", ["config_id"])
    op.create_index("idx_chengm_xiaoyz_draw_record_created", "chengm_xiaoyz_draw_record", ["created_at"])

    op.create_table(
        "chengm_xiaoyz_card_collection",
        _uuid_pk(),
        sa.Column("user_id", models.types.StringUUID(), nullable=False, comment="用户ID"),
        sa.Column("rarity", sa.String(length=10), nullable=False, comment="稀有度: SSR/SR/R"),
        sa.Column("card_name", sa.String(length=255), nullable=False, comment="卡片名称"),
        sa.Column("card_data", models.types.LongText(), nullable=True, comment="Dify返回的完整卡片数据JSON"),
        sa.Column("draw_record_id", models.types.StringUUID(), nullable=True, comment="关联抽卡记录ID"),
        sa.Column("obtained_at", sa.DateTime(), nullable=False, comment="获得时间"),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="chengm_xiaoyz_card_collection_pkey"),
        sa.UniqueConstraint("user_id", "card_name", name="uq_chengm_xiaoyz_collection_user_card"),
    )
    op.create_index("idx_chengm_xiaoyz_collection_user", "chengm_xiaoyz_card_collection", ["user_id"])
    op.create_index("idx_chengm_xiaoyz_collection_rarity", "chengm_xiaoyz_card_collection", ["rarity"])


def downgrade() -> None:
    op.drop_index("idx_chengm_xiaoyz_collection_rarity", table_name="chengm_xiaoyz_card_collection")
    op.drop_index("idx_chengm_xiaoyz_collection_user", table_name="chengm_xiaoyz_card_collection")
    op.drop_table("chengm_xiaoyz_card_collection")

    op.drop_index("idx_chengm_xiaoyz_draw_record_created", table_name="chengm_xiaoyz_draw_record")
    op.drop_index("idx_chengm_xiaoyz_draw_record_config", table_name="chengm_xiaoyz_draw_record")
    op.drop_index("idx_chengm_xiaoyz_draw_record_user", table_name="chengm_xiaoyz_draw_record")
    op.drop_table("chengm_xiaoyz_draw_record")

    op.drop_index("idx_chengm_xiaoyz_rarity_config_id", table_name="chengm_xiaoyz_rarity_config")
    op.drop_table("chengm_xiaoyz_rarity_config")

    op.drop_index("idx_chengm_xiaoyz_config_status", table_name="chengm_xiaoyz_config")
    op.drop_index("idx_chengm_xiaoyz_config_tenant", table_name="chengm_xiaoyz_config")
    op.drop_table("chengm_xiaoyz_config")