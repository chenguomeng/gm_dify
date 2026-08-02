# 定制 by chengm xiaoyz抽卡模块 repository start
"""xiaoyz 小冒险抽卡模块 — 数据库操作层"""

import json
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from customs.xiaoyz.models.xiaoyz_model import (
    ChengmXiaoyzCardCollection,
    ChengmXiaoyzConfig,
    ChengmXiaoyzDrawRecord,
    ChengmXiaoyzRarityConfig,
)
from customs.xiaoyz.schemas.xiaoyz_schema import (
    RarityConfigPayload,
    XiaoyzConfigPayload,
)
from libs.uuid_utils import uuidv7


class XiaoyzRepository:
    """xiaoyz 数据库操作"""

    def __init__(self, session: Session):
        self._session = session

    # ── 配置 CRUD ──

    def create_config(
        self,
        payload: XiaoyzConfigPayload,
        tenant_id: str | None = None,
        created_by: str | None = None,
    ) -> ChengmXiaoyzConfig:
        config = ChengmXiaoyzConfig(
            id=str(uuidv7()),
            name=payload.name,
            description=payload.description,
            draw_count_per_time=payload.draw_count_per_time,
            tenant_id=tenant_id,
            created_by=created_by,
        )
        self._session.add(config)

        for rarity_payload in payload.rarities:
            rarity = ChengmXiaoyzRarityConfig(
                id=str(uuidv7()),
                config_id=config.id,
                rarity=rarity_payload.rarity,
                rarity_name=rarity_payload.rarity_name,
                probability=rarity_payload.probability,
                dify_app_id=rarity_payload.dify_app_id,
                dify_app_name=rarity_payload.dify_app_name,
                input_mapping=(
                    json.dumps(rarity_payload.input_mapping, ensure_ascii=False)
                    if rarity_payload.input_mapping
                    else None
                ),
                output_mapping=(
                    json.dumps(rarity_payload.output_mapping, ensure_ascii=False)
                    if rarity_payload.output_mapping
                    else None
                ),
                sort_order=rarity_payload.sort_order,
            )
            self._session.add(rarity)

        return config

    def get_config(self, config_id: str) -> ChengmXiaoyzConfig | None:
        return self._session.get(ChengmXiaoyzConfig, config_id)

    def get_config_with_rarities(
        self, config_id: str
    ) -> tuple[ChengmXiaoyzConfig | None, list[ChengmXiaoyzRarityConfig]]:
        config = self._session.get(ChengmXiaoyzConfig, config_id)
        if not config:
            return None, []
        rarities = (
            self._session.execute(
                select(ChengmXiaoyzRarityConfig)
                .where(ChengmXiaoyzRarityConfig.config_id == config_id)
                .order_by(ChengmXiaoyzRarityConfig.sort_order)
            )
            .scalars()
            .all()
        )
        return config, list(rarities)

    def list_configs(
        self,
        tenant_id: str | None = None,
        status: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[ChengmXiaoyzConfig], int]:
        query = select(ChengmXiaoyzConfig)
        count_query = select(func.count(ChengmXiaoyzConfig.id))

        if tenant_id:
            query = query.where(ChengmXiaoyzConfig.tenant_id == tenant_id)
            count_query = count_query.where(ChengmXiaoyzConfig.tenant_id == tenant_id)
        if status:
            query = query.where(ChengmXiaoyzConfig.status == status)
            count_query = count_query.where(ChengmXiaoyzConfig.status == status)

        total = self._session.scalar(count_query) or 0
        configs = (
            self._session.execute(
                query.order_by(ChengmXiaoyzConfig.created_at.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
            .scalars()
            .all()
        )
        return list(configs), total

    def update_config(
        self, config: ChengmXiaoyzConfig, payload: XiaoyzConfigPayload
    ) -> ChengmXiaoyzConfig:
        config.name = payload.name
        config.description = payload.description
        config.draw_count_per_time = payload.draw_count_per_time

        # 删除旧稀有度配置
        self._session.execute(
            select(ChengmXiaoyzRarityConfig).where(
                ChengmXiaoyzRarityConfig.config_id == config.id
            )
        )
        old_rarities = (
            self._session.execute(
                select(ChengmXiaoyzRarityConfig).where(
                    ChengmXiaoyzRarityConfig.config_id == config.id
                )
            )
            .scalars()
            .all()
        )
        for r in old_rarities:
            self._session.delete(r)

        # 添加新稀有度配置
        for rarity_payload in payload.rarities:
            rarity = ChengmXiaoyzRarityConfig(
                id=str(uuidv7()),
                config_id=config.id,
                rarity=rarity_payload.rarity,
                rarity_name=rarity_payload.rarity_name,
                probability=rarity_payload.probability,
                dify_app_id=rarity_payload.dify_app_id,
                dify_app_name=rarity_payload.dify_app_name,
                input_mapping=(
                    json.dumps(rarity_payload.input_mapping, ensure_ascii=False)
                    if rarity_payload.input_mapping
                    else None
                ),
                output_mapping=(
                    json.dumps(rarity_payload.output_mapping, ensure_ascii=False)
                    if rarity_payload.output_mapping
                    else None
                ),
                sort_order=rarity_payload.sort_order,
            )
            self._session.add(rarity)

        return config

    def delete_config(self, config: ChengmXiaoyzConfig) -> None:
        rarities = (
            self._session.execute(
                select(ChengmXiaoyzRarityConfig).where(
                    ChengmXiaoyzRarityConfig.config_id == config.id
                )
            )
            .scalars()
            .all()
        )
        for r in rarities:
            self._session.delete(r)
        self._session.delete(config)

    # ── 抽卡记录 ──

    def create_draw_record(
        self,
        config_id: str,
        user_id: str,
        draw_count: int,
        results: list[dict[str, Any]],
    ) -> ChengmXiaoyzDrawRecord:
        record = ChengmXiaoyzDrawRecord(
            id=str(uuidv7()),
            config_id=config_id,
            user_id=user_id,
            draw_count=draw_count,
            results=json.dumps(results, ensure_ascii=False),
        )
        self._session.add(record)
        return record

    def list_draw_records(
        self,
        user_id: str | None = None,
        config_id: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[ChengmXiaoyzDrawRecord], int]:
        query = select(ChengmXiaoyzDrawRecord)
        count_query = select(func.count(ChengmXiaoyzDrawRecord.id))

        if user_id:
            query = query.where(ChengmXiaoyzDrawRecord.user_id == user_id)
            count_query = count_query.where(ChengmXiaoyzDrawRecord.user_id == user_id)
        if config_id:
            query = query.where(ChengmXiaoyzDrawRecord.config_id == config_id)
            count_query = count_query.where(ChengmXiaoyzDrawRecord.config_id == config_id)

        total = self._session.scalar(count_query) or 0
        records = (
            self._session.execute(
                query.order_by(ChengmXiaoyzDrawRecord.created_at.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
            .scalars()
            .all()
        )
        return list(records), total

    # ── 卡牌收藏 ──

    def add_to_collection(
        self,
        user_id: str,
        rarity: str,
        card_name: str,
        card_data: dict[str, Any],
        draw_record_id: str,
    ) -> ChengmXiaoyzCardCollection | None:
        # 检查是否已存在同名卡片
        existing = (
            self._session.execute(
                select(ChengmXiaoyzCardCollection).where(
                    ChengmXiaoyzCardCollection.user_id == user_id,
                    ChengmXiaoyzCardCollection.card_name == card_name,
                )
            )
            .scalars()
            .first()
        )
        if existing:
            return None  # 已有，不重复添加

        card = ChengmXiaoyzCardCollection(
            id=str(uuidv7()),
            user_id=user_id,
            rarity=rarity,
            card_name=card_name,
            card_data=json.dumps(card_data, ensure_ascii=False),
            draw_record_id=draw_record_id,
        )
        self._session.add(card)
        return card

    def list_collection(
        self,
        user_id: str,
        rarity: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[ChengmXiaoyzCardCollection], int]:
        query = select(ChengmXiaoyzCardCollection).where(
            ChengmXiaoyzCardCollection.user_id == user_id
        )
        count_query = select(func.count(ChengmXiaoyzCardCollection.id)).where(
            ChengmXiaoyzCardCollection.user_id == user_id
        )

        if rarity:
            query = query.where(ChengmXiaoyzCardCollection.rarity == rarity)
            count_query = count_query.where(ChengmXiaoyzCardCollection.rarity == rarity)

        total = self._session.scalar(count_query) or 0
        cards = (
            self._session.execute(
                query.order_by(ChengmXiaoyzCardCollection.obtained_at.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
            .scalars()
            .all()
        )
        return list(cards), total

    # ── 稀有度配置查询 ──

    def get_rarities_by_config(self, config_id: str) -> list[ChengmXiaoyzRarityConfig]:
        return (
            self._session.execute(
                select(ChengmXiaoyzRarityConfig)
                .where(ChengmXiaoyzRarityConfig.config_id == config_id)
                .order_by(ChengmXiaoyzRarityConfig.sort_order)
            )
            .scalars()
            .all()
        )

# 定制 by chengm xiaoyz抽卡模块 repository end
