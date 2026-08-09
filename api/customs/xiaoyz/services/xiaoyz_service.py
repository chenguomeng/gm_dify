# 定制 by chengm xiaoyz抽卡模块 service start
"""xiaoyz 小冒险抽卡模块 — 核心业务逻辑"""

import json
import logging
import random
from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Session

from customs.xiaoyz.models.xiaoyz_model import (
    ChengmXiaoyzCardCollection,
    ChengmXiaoyzConfig,
    ChengmXiaoyzDrawRecord,
    ChengmXiaoyzRarityConfig,
)
from customs.xiaoyz.repositories.xiaoyz_repo import XiaoyzRepository
from customs.xiaoyz.schemas.xiaoyz_schema import (
    CardCollectionItem,
    CardCollectionListResponse,
    ConversationLookupResponse,
    ConversationMessageItem,
    DifyAppItem,
    DifyAppListResponse,
    DifyAppVariablesResponse,
    DifyVariableItem,
    DrawRequest,
    DrawResponse,
    DrawResultItem,
    RarityConfigResponse,
    XiaoyzConfigListResponse,
    XiaoyzConfigPayload,
    XiaoyzConfigResponse,
)
from libs.helper import escape_like_pattern
from libs.pagination import paginate_query
from models.model import App, AppMode, Conversation, Message
from services.workflow_service import WorkflowService

_logger = logging.getLogger(__name__)


class XiaoyzService:
    """xiaoyz 小冒险抽卡核心服务"""

    def __init__(self, session: Session):
        self._session = session
        self._repo = XiaoyzRepository(session)

    # ── Dify 应用桥接 ──

    def get_dify_apps(
        self,
        tenant_id: str,
        user_id: str,
        keyword: str | None = None,
        page: int = 1,
        limit: int = 50,
        mode: str | None = None,
    ) -> DifyAppListResponse:
        """获取 Dify 平台的编排型应用列表

        Args:
            mode: 过滤模式，'workflow' → WORKFLOW（抽卡用），
                  'chat' → CHAT+ADVANCED_CHAT+AGENT_CHAT+AGENT（对话用），
                  None → 全部。

        AppListParams.mode 只接受单个模式，而抽卡需要的是「带 graph 的编排应用」，
        即 workflow(工作流) 与 advanced-chat(Chatflow) 两种，所以这里直接查 App 表。
        """
        del user_id  # 租户内配置页，按 tenant 维度取应用即可
        try:
            # 根据 mode 参数决定要查哪些 AppMode
            if mode == "chat":
                target_modes = [AppMode.CHAT, AppMode.ADVANCED_CHAT, AppMode.AGENT_CHAT, AppMode.AGENT]
            elif mode == "workflow":
                target_modes = [AppMode.WORKFLOW]
            else:
                target_modes = [
                    AppMode.WORKFLOW,
                    AppMode.ADVANCED_CHAT,
                    AppMode.CHAT,
                    AppMode.AGENT_CHAT,
                    AppMode.AGENT,
                ]

            filters = [
                App.tenant_id == tenant_id,
                App.is_universal == False,  # noqa: E712 SQLAlchemy 需要 == 而非 is
                App.mode.in_(target_modes),
            ]
            if keyword:
                escaped = escape_like_pattern(keyword[:30])
                filters.append(App.name.ilike(f"%{escaped}%", escape="\\"))

            pagination = paginate_query(
                sa.select(App).where(*filters).order_by(App.updated_at.desc()),
                page=page,
                per_page=limit,
                session=self._session,
            )

            items = []
            for app in pagination.items:
                items.append(
                    DifyAppItem(
                        id=str(app.id),
                        name=app.name or "",
                        mode=app.mode or "",
                        description=getattr(app, "description", None),
                        icon=getattr(app, "icon", None),
                        icon_background=getattr(app, "icon_background", None),
                    )
                )
            return DifyAppListResponse(data=items, total=pagination.total or 0)
        except Exception as e:
            _logger.exception("Failed to fetch Dify apps: %s", e)
            return DifyAppListResponse(data=[], total=0)

    def get_dify_app_variables(
        self, app_id: str, tenant_id: str
    ) -> DifyAppVariablesResponse:
        """获取 Dify 工作流应用的输入/输出变量"""
        try:
            app = self._session.get(App, app_id)
            if not app:
                return DifyAppVariablesResponse()

            workflow_service = WorkflowService()
            draft_workflow = workflow_service.get_draft_workflow(
                app_model=app, session=self._session
            )

            if not draft_workflow:
                return DifyAppVariablesResponse()

            # graph 字段存储的是 JSON 字符串，必须用 graph_dict 属性反序列化
            graph = draft_workflow.graph_dict
            nodes = graph.get("nodes", [])

            inputs: list[DifyVariableItem] = []
            outputs: list[DifyVariableItem] = []

            for node in nodes:
                node_data = node.get("data", {})
                node_type = node_data.get("type", "")

                if node_type == "start":
                    # 解析 start 节点的输入变量
                    variables = node_data.get("variables", [])
                    for var in variables:
                        inputs.append(
                            DifyVariableItem(
                                name=var.get("variable", ""),
                                type=var.get("type", "string"),
                                label=var.get("label", var.get("variable", "")),
                                required=var.get("required", False),
                                options=var.get("options"),
                                max_length=var.get("max_length"),
                                default=var.get("default"),
                            )
                        )

                elif node_type == "end":
                    # workflow 模式：end 节点声明输出变量
                    outputs_config = node_data.get("outputs", [])
                    for out in outputs_config:
                        outputs.append(
                            DifyVariableItem(
                                name=out.get("variable", out.get("name", "")),
                                type=out.get("type", "string"),
                                label=out.get("label", out.get("variable", "")),
                            )
                        )

                elif node_type == "answer":
                    # advanced-chat(Chatflow) 模式：没有 end 节点，产出走 answer 节点
                    outputs.append(
                        DifyVariableItem(
                            name="answer",
                            type="string",
                            label=node_data.get("title") or "answer",
                        )
                    )

            # Chatflow 可能有多个 answer 节点，按变量名去重
            seen_outputs: set[str] = set()
            unique_outputs: list[DifyVariableItem] = []
            for out in outputs:
                if out.name in seen_outputs:
                    continue
                seen_outputs.add(out.name)
                unique_outputs.append(out)

            return DifyAppVariablesResponse(inputs=inputs, outputs=unique_outputs)
        except Exception as e:
            _logger.exception("Failed to get app variables for %s: %s", app_id, e)
            return DifyAppVariablesResponse()

    # ── 配置管理 ──

    def create_config(
        self,
        payload: XiaoyzConfigPayload,
        tenant_id: str | None = None,
        created_by: str | None = None,
    ) -> XiaoyzConfigResponse:
        config = self._repo.create_config(payload, tenant_id, created_by)
        self._session.flush()
        return self._to_config_response(config)

    def get_config(self, config_id: str) -> XiaoyzConfigResponse | None:
        config, rarities = self._repo.get_config_with_rarities(config_id)
        if not config:
            return None
        return self._to_config_response(config, rarities)

    def list_configs(
        self,
        tenant_id: str | None = None,
        status: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> XiaoyzConfigListResponse:
        configs, total = self._repo.list_configs(tenant_id, status, page, limit)
        data = []
        for config in configs:
            rarities = self._repo.get_rarities_by_config(config.id)
            data.append(self._to_config_response(config, rarities))
        return XiaoyzConfigListResponse(
            data=data,
            total=total,
            page=page,
            limit=limit,
            has_more=(page * limit) < total,
        )

    def update_config(
        self, config_id: str, payload: XiaoyzConfigPayload
    ) -> XiaoyzConfigResponse | None:
        existing = self._repo.get_config(config_id)
        if not existing:
            return None
        config = self._repo.update_config(existing, payload)
        self._session.flush()
        rarities = self._repo.get_rarities_by_config(config.id)
        return self._to_config_response(config, rarities)

    def delete_config(self, config_id: str) -> bool:
        existing = self._repo.get_config(config_id)
        if not existing:
            return False
        self._repo.delete_config(existing)
        return True

    # ── 抽卡核心逻辑 ──

    def draw_cards(
        self,
        request: DrawRequest,
        user_id: str,
        tenant_id: str,
    ) -> DrawResponse:
        """执行抽卡：按概率随机→调用 Dify 工作流→返回卡片"""
        config, rarities = self._repo.get_config_with_rarities(request.config_id)
        if not config:
            raise ValueError(f"Config not found: {request.config_id}")
        if not rarities:
            raise ValueError("No rarity configs found")

        # 按概率权重随机选择稀有度
        rarity_names = [r.rarity for r in rarities]
        rarity_probs = [r.probability for r in rarities]

        results: list[dict[str, Any]] = []
        for _ in range(request.count):
            chosen_rarity = self._weighted_random(rarity_names, rarity_probs)
            rarity_config = next(
                (r for r in rarities if r.rarity == chosen_rarity), None
            )
            if not rarity_config:
                continue

            # 调用 Dify 工作流获取卡片数据
            card_data = self._call_dify_workflow(
                app_id=rarity_config.dify_app_id,
                rarity=chosen_rarity,
                user_id=user_id,
                input_mapping=(
                    json.loads(rarity_config.input_mapping)
                    if rarity_config.input_mapping
                    else {}
                ),
            )

            card_name = self._extract_card_name(
                card_data,
                json.loads(rarity_config.output_mapping)
                if rarity_config.output_mapping
                else {},
            )

            results.append(
                {
                    "rarity": chosen_rarity,
                    "card_name": card_name or f"{chosen_rarity}_card_{_+1}",
                    "card_data": card_data,
                }
            )

        # 记录抽卡结果
        record = self._repo.create_draw_record(
            config_id=config.id,
            user_id=user_id,
            draw_count=request.count,
            results=results,
        )

        # 将新卡加入收藏
        for result in results:
            self._repo.add_to_collection(
                user_id=user_id,
                rarity=result["rarity"],
                card_name=result["card_name"],
                card_data=result["card_data"],
                draw_record_id=record.id,
            )

        return DrawResponse(
            id=record.id,
            config_id=config.id,
            user_id=user_id,
            draw_count=request.count,
            results=[
                DrawResultItem(
                    rarity=r["rarity"],
                    card_name=r["card_name"],
                    card_data=r["card_data"],
                )
                for r in results
            ],
            created_at=record.created_at.isoformat() if record.created_at else None,
        )

    def _weighted_random(self, items: list[str], weights: list[float]) -> str:
        """加权随机选择"""
        if not items:
            raise ValueError("Empty items")
        return random.choices(items, weights=weights, k=1)[0]

    def _call_dify_workflow(
        self,
        app_id: str,
        rarity: str,
        user_id: str,
        input_mapping: dict[str, str],
    ) -> dict[str, Any]:
        """调用 Dify 工作流获取卡片数据"""
        try:
            from services.app_generate_service import AppGenerateService

            app = self._session.get(App, app_id)
            if not app:
                _logger.warning("App not found: %s, returning mock card", app_id)
                return self._mock_card_data(rarity)

            # 构建输入参数（映射 input_mapping）
            inputs = {}
            for dify_var, source in input_mapping.items():
                if source == "{{rarity}}":
                    inputs[dify_var] = rarity
                elif source == "{{user_id}}":
                    inputs[dify_var] = user_id
                else:
                    inputs[dify_var] = source

            # 通过 AppGenerateService 运行工作流
            generator = AppGenerateService()
            # 使用 draft workflow run 来获取结果
            # 由于运行工作流需要完整的 app runner 环境，
            # 这里使用简化方式：直接返回模拟数据用于开发测试
            _logger.info(
                "Workflow call: app_id=%s, rarity=%s, inputs=%s",
                app_id, rarity, inputs,
            )
            return self._mock_card_data(rarity)

        except Exception as e:
            _logger.exception("Failed to call Dify workflow: %s", e)
            return self._mock_card_data(rarity)

    def _mock_card_data(self, rarity: str) -> dict[str, Any]:
        """生成模拟卡片数据（开发阶段，实际应调用 Dify 工作流）"""
        mock_cards = {
            "SSR": [
                {"name": "传说之龙", "attack": 9500, "defense": 8000, "skill": "龙息烈焰"},
                {"name": "暗影刺客", "attack": 8800, "defense": 6000, "skill": "暗杀突袭"},
                {"name": "神圣骑士", "attack": 7500, "defense": 9500, "skill": "圣光护盾"},
            ],
            "SR": [
                {"name": "火焰法师", "attack": 6500, "defense": 5000, "skill": "烈焰风暴"},
                {"name": "冰霜射手", "attack": 6200, "defense": 4500, "skill": "冰冻之箭"},
                {"name": "风暴战士", "attack": 6800, "defense": 5500, "skill": "旋风斩"},
            ],
            "R": [
                {"name": "见习剑士", "attack": 3500, "defense": 3000, "skill": "普通斩击"},
                {"name": "新手弓手", "attack": 3200, "defense": 2500, "skill": "瞄准射击"},
                {"name": "小法师", "attack": 3800, "defense": 2200, "skill": "小火球"},
            ],
        }
        cards = mock_cards.get(rarity, mock_cards["R"])
        return random.choice(cards)

    def _extract_card_name(
        self, card_data: dict[str, Any], output_mapping: dict[str, str]
    ) -> str:
        """根据 output_mapping 从卡片数据中提取卡片名称"""
        # 遍历 output_mapping 找到 name 相关映射
        for dify_output, card_field in output_mapping.items():
            if card_field in ("card_name", "name"):
                # 尝试从 card_data 中提取
                # 如果 dify_output 匹配 card_data 的 key
                if dify_output in card_data:
                    return str(card_data[dify_output])
        # fallback: 直接取 card_data 的 name
        return str(card_data.get("name", "Unknown"))

    # ── 对话持久化 ──

    def find_user_conversation(
        self,
        app_id: str,
        account_id: str,
    ) -> ConversationLookupResponse:
        """查找当前用户在该 App 下最近一次未删除的对话

        每个用户（account）在一个 App 下只有一个持久化的会话，
        页面重新打开时复用该会话，保持对话记录连续性。
        """
        conv = (
            self._session.query(Conversation)
            .filter(
                Conversation.app_id == app_id,
                Conversation.from_account_id == account_id,
                Conversation.is_deleted == False,  # noqa: E712
            )
            .order_by(Conversation.updated_at.desc())
            .first()
        )

        if not conv:
            return ConversationLookupResponse(conversation_id=None, messages=[])

        # 加载消息列表
        msgs = (
            self._session.query(Message)
            .filter(
                Message.conversation_id == conv.id,
            )
            .order_by(Message.created_at.asc())
            .all()
        )

        message_items: list[ConversationMessageItem] = []
        for m in msgs:
            # 每个 Message 行同时包含 user query 和 assistant answer，
            # 需要拆成两条 UI 消息
            if m.query:
                message_items.append(
                    ConversationMessageItem(
                        id=f"{m.id}-user",
                        role="user",
                        content=m.query,
                        created_at=m.created_at.isoformat() if m.created_at else None,
                    )
                )
            if m.answer:
                message_items.append(
                    ConversationMessageItem(
                        id=f"{m.id}-assistant",
                        role="assistant",
                        content=m.answer,
                        created_at=m.created_at.isoformat() if m.created_at else None,
                    )
                )

        return ConversationLookupResponse(
            conversation_id=str(conv.id),
            messages=message_items,
        )

    # ── 抽卡记录 ──

    def list_draw_records(
        self,
        user_id: str | None = None,
        config_id: str | None = None,
        page: int = 1,
        limit: int = 20,
    ):
        from customs.xiaoyz.schemas.xiaoyz_schema import DrawRecordListResponse

        records, total = self._repo.list_draw_records(
            user_id, config_id, page, limit
        )
        data = [self._to_draw_response(r) for r in records]
        return DrawRecordListResponse(
            data=data,
            total=total,
            page=page,
            limit=limit,
            has_more=(page * limit) < total,
        )

    def _to_draw_response(self, record: ChengmXiaoyzDrawRecord) -> DrawResponse:
        results = []
        if record.results:
            try:
                raw = json.loads(record.results)
                results = [
                    DrawResultItem(
                        rarity=r.get("rarity", ""),
                        card_name=r.get("card_name", ""),
                        card_data=r.get("card_data", {}),
                    )
                    for r in raw
                ]
            except (json.JSONDecodeError, TypeError):
                pass

        return DrawResponse(
            id=record.id,
            config_id=record.config_id,
            user_id=record.user_id,
            draw_count=record.draw_count,
            results=results,
            created_at=record.created_at.isoformat() if record.created_at else None,
        )

    # ── 卡牌收藏 ──

    def list_collection(
        self,
        user_id: str,
        rarity: str | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> CardCollectionListResponse:
        cards, total = self._repo.list_collection(user_id, rarity, page, limit)
        data = [self._to_collection_item(c) for c in cards]
        return CardCollectionListResponse(
            data=data,
            total=total,
            page=page,
            limit=limit,
            has_more=(page * limit) < total,
        )

    def _to_collection_item(
        self, card: ChengmXiaoyzCardCollection
    ) -> CardCollectionItem:
        card_data = {}
        if card.card_data:
            try:
                card_data = json.loads(card.card_data)
            except (json.JSONDecodeError, TypeError):
                pass

        return CardCollectionItem(
            id=card.id,
            user_id=card.user_id,
            rarity=card.rarity,
            card_name=card.card_name,
            card_data=card_data,
            obtained_at=card.obtained_at.isoformat() if card.obtained_at else None,
        )

    # ── 序列化辅助 ──

    def _to_config_response(
        self,
        config: ChengmXiaoyzConfig,
        rarities: list[ChengmXiaoyzRarityConfig] | None = None,
    ) -> XiaoyzConfigResponse:
        rarity_responses = []
        if rarities:
            for r in rarities:
                input_mapping = {}
                output_mapping = {}
                if r.input_mapping:
                    try:
                        input_mapping = json.loads(r.input_mapping)
                    except (json.JSONDecodeError, TypeError):
                        pass
                if r.output_mapping:
                    try:
                        output_mapping = json.loads(r.output_mapping)
                    except (json.JSONDecodeError, TypeError):
                        pass

                rarity_responses.append(
                    RarityConfigResponse(
                        id=r.id,
                        config_id=r.config_id,
                        rarity=r.rarity,
                        rarity_name=r.rarity_name,
                        probability=r.probability,
                        dify_app_id=r.dify_app_id,
                        dify_app_name=r.dify_app_name,
                        input_mapping=input_mapping,
                        output_mapping=output_mapping,
                        sort_order=r.sort_order,
                        created_at=r.created_at.isoformat() if r.created_at else None,
                        updated_at=r.updated_at.isoformat() if r.updated_at else None,
                    )
                )

        return XiaoyzConfigResponse(
            id=config.id,
            name=config.name,
            description=config.description,
            draw_count_per_time=config.draw_count_per_time,
            status=config.status,
            tenant_id=config.tenant_id,
            created_by=config.created_by,
            rarities=rarity_responses,
            created_at=config.created_at.isoformat() if config.created_at else None,
            updated_at=config.updated_at.isoformat() if config.updated_at else None,
        )

# 定制 by chengm xiaoyz抽卡模块 service end
