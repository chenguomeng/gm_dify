# 定制 by chengm xiaoyz抽卡模块 schemas start
"""xiaoyz 小冒险抽卡模块 — Pydantic 请求/响应 Schema"""

from typing import Any

from pydantic import BaseModel, Field


# ── Dify 应用相关 ──

class DifyAppItem(BaseModel):
    """Dify 应用列表项"""
    id: str
    name: str
    mode: str
    description: str | None = None
    icon: str | None = None
    icon_background: str | None = None


class DifyAppListResponse(BaseModel):
    """Dify 应用列表响应"""
    data: list[DifyAppItem]
    total: int = 0


class DifyVariableItem(BaseModel):
    """Dify 应用变量"""
    name: str
    type: str
    label: str | None = None
    required: bool = False
    options: list[str] | None = None
    max_length: int | None = None
    default: str | None = None


class DifyAppVariablesResponse(BaseModel):
    """Dify 应用变量响应"""
    inputs: list[DifyVariableItem] = Field(default_factory=list)
    outputs: list[DifyVariableItem] = Field(default_factory=list)


# ── 稀有度配置 ──

class RarityConfigPayload(BaseModel):
    """稀有度配置请求"""
    rarity: str = Field(..., description="稀有度等级: SSR/SR/R")
    rarity_name: str | None = Field(None, description="稀有度显示名称")
    probability: float = Field(..., description="概率 0.0000~1.0000")
    dify_app_id: str = Field(..., description="Dify应用ID")
    dify_app_name: str | None = Field(None, description="Dify应用名称")
    input_mapping: dict[str, str] | None = Field(None, description="输入变量映射")
    output_mapping: dict[str, str] | None = Field(None, description="输出变量映射")
    sort_order: int = Field(default=0, description="排序")


class RarityConfigResponse(BaseModel):
    """稀有度配置响应"""
    id: str
    config_id: str
    rarity: str
    rarity_name: str | None = None
    probability: float
    dify_app_id: str
    dify_app_name: str | None = None
    input_mapping: dict[str, str] | None = None
    output_mapping: dict[str, str] | None = None
    sort_order: int = 0
    created_at: str | None = None
    updated_at: str | None = None


# ── 主配置 ──

class XiaoyzConfigPayload(BaseModel):
    """创建/更新配置请求"""
    name: str = Field(..., min_length=1, max_length=255, description="配置名称")
    description: str | None = Field(None, description="配置描述")
    draw_count_per_time: int = Field(default=10, ge=1, le=100, description="每次抽卡数量")
    rarities: list[RarityConfigPayload] = Field(
        default_factory=list, description="稀有度配置列表"
    )


class XiaoyzConfigResponse(BaseModel):
    """配置响应"""
    id: str
    name: str
    description: str | None = None
    draw_count_per_time: int = 10
    status: str = "active"
    tenant_id: str | None = None
    created_by: str | None = None
    rarities: list[RarityConfigResponse] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None


class XiaoyzConfigListResponse(BaseModel):
    """配置列表响应"""
    data: list[XiaoyzConfigResponse]
    total: int = 0
    page: int = 1
    limit: int = 20
    has_more: bool = False


# ── 抽卡相关 ──

class DrawRequest(BaseModel):
    """抽卡请求"""
    config_id: str = Field(..., description="配置ID")
    count: int = Field(default=10, ge=1, le=100, description="抽取数量")


class DrawResultItem(BaseModel):
    """单次抽卡结果"""
    rarity: str
    card_name: str
    card_data: dict[str, Any] = Field(default_factory=dict)


class DrawResponse(BaseModel):
    """抽卡响应"""
    id: str
    config_id: str | None = None
    user_id: str
    draw_count: int
    results: list[DrawResultItem] = Field(default_factory=list)
    created_at: str | None = None


class DrawRecordListResponse(BaseModel):
    """抽卡记录列表响应"""
    data: list[DrawResponse]
    total: int = 0
    page: int = 1
    limit: int = 20
    has_more: bool = False


# ── 收藏相关 ──

class CardCollectionItem(BaseModel):
    """收藏卡片项"""
    id: str
    user_id: str
    rarity: str
    card_name: str
    card_data: dict[str, Any] = Field(default_factory=dict)
    obtained_at: str | None = None


class CardCollectionListResponse(BaseModel):
    """收藏列表响应"""
    data: list[CardCollectionItem]
    total: int = 0
    page: int = 1
    limit: int = 20
    has_more: bool = False


# ── 智能对话 ──


class ChatRequest(BaseModel):
    """对话请求"""
    app_id: str = Field(..., description="Dify 应用 ID")
    query: str = Field(..., min_length=1, description="用户消息")
    conversation_id: str | None = Field(None, description="会话 ID（新对话不传）")
    inputs: dict[str, Any] = Field(default_factory=dict, description="输入变量")


class ChatStopRequest(BaseModel):
    """停止生成请求"""
    task_id: str = Field(..., description="任务 ID")


# ── 对话持久化 ──


class ConversationMessageItem(BaseModel):
    """对话消息项"""
    id: str
    role: str  # 'user' | 'assistant'
    content: str
    created_at: str | None = None


class ConversationLookupResponse(BaseModel):
    """查找用户对话响应"""
    conversation_id: str | None = None
    messages: list[ConversationMessageItem] = Field(default_factory=list)


# ── 通用 ──

class SimpleResult(BaseModel):
    """操作结果"""
    result: str = "success"

# 定制 by chengm xiaoyz抽卡模块 schemas end
