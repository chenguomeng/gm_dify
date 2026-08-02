# 定制 by chengm xiaoyz抽卡模块ORM模型 start
"""
xiaoyz 小冒险抽卡模块 — 数据库模型

数据库表命名：chengm_ 前缀
模型类命名：Chengm 前缀
"""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from libs.datetime_utils import naive_utc_now
from libs.uuid_utils import uuidv7
from models.base import Base, DefaultFieldsMixin
from models.types import LongText, StringUUID


class ChengmXiaoyzConfig(Base, DefaultFieldsMixin):
    """小冒险抽卡主配置表"""

    __tablename__ = "chengm_xiaoyz_config"

    name: Mapped[str] = mapped_column(String(255), nullable=False, comment="配置名称")
    description: Mapped[str | None] = mapped_column(LongText, nullable=True, comment="配置描述")
    draw_count_per_time: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, default=10, comment="每次抽卡数量"
    )
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="active", comment="状态: active/archived"
    )
    tenant_id: Mapped[str | None] = mapped_column(
        StringUUID, nullable=True, comment="租户ID"
    )
    created_by: Mapped[str | None] = mapped_column(
        StringUUID, nullable=True, comment="创建者ID"
    )

    __table_args__ = (
        Index("idx_chengm_xiaoyz_config_tenant", "tenant_id"),
        Index("idx_chengm_xiaoyz_config_status", "status"),
    )


class ChengmXiaoyzRarityConfig(Base, DefaultFieldsMixin):
    """稀有度配置 + Dify应用绑定表"""

    __tablename__ = "chengm_xiaoyz_rarity_config"

    config_id: Mapped[str] = mapped_column(
        StringUUID, nullable=False, comment="关联主配置ID"
    )
    rarity: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="稀有度等级: SSR/SR/R"
    )
    rarity_name: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="稀有度显示名称"
    )
    probability: Mapped[float] = mapped_column(
        sa.Float, nullable=False, comment="概率 0.0000~1.0000"
    )
    dify_app_id: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Dify应用ID"
    )
    dify_app_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Dify应用名称（冗余）"
    )
    input_mapping: Mapped[str | None] = mapped_column(
        LongText, nullable=True, comment='输入变量映射 JSON: {"dify_var": "value_source"}'
    )
    output_mapping: Mapped[str | None] = mapped_column(
        LongText, nullable=True, comment='输出变量映射 JSON: {"dify_output": "card_field"}'
    )
    sort_order: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, default=0, comment="排序"
    )

    __table_args__ = (
        Index("idx_chengm_xiaoyz_rarity_config_id", "config_id"),
    )


class ChengmXiaoyzDrawRecord(Base, DefaultFieldsMixin):
    """抽卡记录表"""

    __tablename__ = "chengm_xiaoyz_draw_record"

    config_id: Mapped[str | None] = mapped_column(
        StringUUID, nullable=True, comment="关联配置ID"
    )
    user_id: Mapped[str] = mapped_column(
        StringUUID, nullable=False, comment="用户ID"
    )
    draw_count: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, comment="本次抽取数量"
    )
    results: Mapped[str | None] = mapped_column(
        LongText, nullable=True, comment='抽卡结果JSON: [{rarity, card_name, card_data}]'
    )

    __table_args__ = (
        Index("idx_chengm_xiaoyz_draw_record_user", "user_id"),
        Index("idx_chengm_xiaoyz_draw_record_config", "config_id"),
        Index("idx_chengm_xiaoyz_draw_record_created", "created_at"),
    )


class ChengmXiaoyzCardCollection(Base, DefaultFieldsMixin):
    """用户卡牌收藏表"""

    __tablename__ = "chengm_xiaoyz_card_collection"

    user_id: Mapped[str] = mapped_column(
        StringUUID, nullable=False, comment="用户ID"
    )
    rarity: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="稀有度: SSR/SR/R"
    )
    card_name: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="卡片名称"
    )
    card_data: Mapped[str | None] = mapped_column(
        LongText, nullable=True, comment="Dify返回的完整卡片数据JSON"
    )
    draw_record_id: Mapped[str | None] = mapped_column(
        StringUUID, nullable=True, comment="关联抽卡记录ID"
    )
    obtained_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=naive_utc_now, comment="获得时间"
    )

    __table_args__ = (
        UniqueConstraint("user_id", "card_name", name="uq_chengm_xiaoyz_collection_user_card"),
        Index("idx_chengm_xiaoyz_collection_user", "user_id"),
        Index("idx_chengm_xiaoyz_collection_rarity", "rarity"),
    )

# 定制 by chengm xiaoyz抽卡模块ORM模型 end
