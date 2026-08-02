# 定制 by chengm xiaoyz抽卡模块 API 路由 start
"""xiaoyz 小冒险抽卡模块 — Flask-RESTX API 路由"""

import logging

from flask import Blueprint, request
from flask_restx import Namespace, Resource, fields
from pydantic import BaseModel, Field
from werkzeug.exceptions import BadRequest, NotFound

from customs.xiaoyz.schemas.xiaoyz_schema import (
    DrawRequest,
    SimpleResult,
    XiaoyzConfigPayload,
)
from customs.xiaoyz.services.xiaoyz_service import XiaoyzService
from extensions.ext_database import db
from libs.login import login_required

_logger = logging.getLogger(__name__)

# 创建独立的 Blueprint 和 Namespace
xiaoyz_bp = Blueprint("xiaoyz", __name__, url_prefix="/console/api/customs/xiaoyz")
xiaoyz_ns = Namespace("xiaoyz", description="小冒险抽卡模块 API")


# ── 请求体模型（flask-restx） ──

draw_request_model = xiaoyz_ns.model(
    "DrawRequest",
    {
        "config_id": fields.String(required=True, description="配置ID"),
        "count": fields.Integer(default=10, description="抽取数量"),
    },
)

config_payload_model = xiaoyz_ns.model(
    "XiaoyzConfigPayload",
    {
        "name": fields.String(required=True, description="配置名称"),
        "description": fields.String(description="配置描述"),
        "draw_count_per_time": fields.Integer(default=10, description="每次抽卡数量"),
    },
)


def _get_service() -> XiaoyzService:
    return XiaoyzService(db.session())


# ═══════════════════════════════════════════════════════════
# Dify 应用桥接
# ═══════════════════════════════════════════════════════════

@xiaoyz_ns.route("/dify-apps")
class DifyAppsApi(Resource):
    @xiaoyz_ns.doc("list_dify_apps")
    @xiaoyz_ns.doc(params={"keyword": "搜索关键词", "page": "页码", "limit": "每页数量"})
    @login_required
    def get(self):
        """获取 Dify 工作流应用列表"""
        keyword = request.args.get("keyword")
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 50))
        # 从请求上下文获取 tenant_id 和 user_id
        tenant_id = getattr(request, "tenant_id", None) or "default"
        user_id = getattr(request, "user_id", None) or "default"

        service = _get_service()
        result = service.get_dify_apps(tenant_id, user_id, keyword, page, limit)
        return result.model_dump(mode="json")


@xiaoyz_ns.route("/dify-apps/<string:app_id>/variables")
class DifyAppVariablesApi(Resource):
    @xiaoyz_ns.doc("get_dify_app_variables")
    @login_required
    def get(self, app_id: str):
        """获取 Dify 工作流应用的输入/输出变量"""
        tenant_id = getattr(request, "tenant_id", None) or "default"
        service = _get_service()
        result = service.get_dify_app_variables(app_id, tenant_id)
        return result.model_dump(mode="json")


# ═══════════════════════════════════════════════════════════
# 小冒险配置 CRUD
# ═══════════════════════════════════════════════════════════

@xiaoyz_ns.route("/config")
class ConfigListApi(Resource):
    @xiaoyz_ns.doc("list_configs")
    @xiaoyz_ns.doc(params={"page": "页码", "limit": "每页数量", "status": "状态过滤"})
    @login_required
    def get(self):
        """获取小冒险配置列表"""
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 20))
        status = request.args.get("status")
        tenant_id = getattr(request, "tenant_id", None) or "default"

        service = _get_service()
        result = service.list_configs(tenant_id, status, page, limit)
        return result.model_dump(mode="json")

    @xiaoyz_ns.doc("create_config")
    @xiaoyz_ns.expect(config_payload_model)
    @login_required
    def post(self):
        """创建小冒险配置"""
        try:
            data = request.get_json(silent=True) or {}
            payload = XiaoyzConfigPayload.model_validate(data)
        except Exception as e:
            raise BadRequest(f"Invalid payload: {e}") from e

        tenant_id = getattr(request, "tenant_id", None) or "default"
        user_id = getattr(request, "user_id", None) or "default"

        service = _get_service()
        try:
            result = service.create_config(payload, tenant_id, user_id)
            db.session.commit()
            return result.model_dump(mode="json"), 201
        except Exception as e:
            db.session.rollback()
            _logger.exception("Failed to create config")
            raise BadRequest(f"Failed to create config: {e}") from e


@xiaoyz_ns.route("/config/<string:config_id>")
class ConfigDetailApi(Resource):
    @xiaoyz_ns.doc("get_config")
    @login_required
    def get(self, config_id: str):
        """获取配置详情"""
        service = _get_service()
        result = service.get_config(config_id)
        if not result:
            raise NotFound(f"Config not found: {config_id}")
        return result.model_dump(mode="json")

    @xiaoyz_ns.doc("update_config")
    @login_required
    def put(self, config_id: str):
        """更新配置"""
        try:
            data = request.get_json(silent=True) or {}
            payload = XiaoyzConfigPayload.model_validate(data)
        except Exception as e:
            raise BadRequest(f"Invalid payload: {e}") from e

        service = _get_service()
        try:
            result = service.update_config(config_id, payload)
            if not result:
                raise NotFound(f"Config not found: {config_id}")
            db.session.commit()
            return result.model_dump(mode="json")
        except NotFound:
            db.session.rollback()
            raise
        except Exception as e:
            db.session.rollback()
            _logger.exception("Failed to update config")
            raise BadRequest(f"Failed to update config: {e}") from e

    @xiaoyz_ns.doc("delete_config")
    @login_required
    def delete(self, config_id: str):
        """删除配置"""
        service = _get_service()
        try:
            ok = service.delete_config(config_id)
            if not ok:
                raise NotFound(f"Config not found: {config_id}")
            db.session.commit()
            return {"result": "success"}
        except NotFound:
            db.session.rollback()
            raise
        except Exception as e:
            db.session.rollback()
            _logger.exception("Failed to delete config")
            raise BadRequest(f"Failed to delete config: {e}") from e


# ═══════════════════════════════════════════════════════════
# 抽卡
# ═══════════════════════════════════════════════════════════

@xiaoyz_ns.route("/draw")
class DrawApi(Resource):
    @xiaoyz_ns.doc("draw_cards")
    @xiaoyz_ns.expect(draw_request_model)
    @login_required
    def post(self):
        """执行抽卡"""
        try:
            data = request.get_json(silent=True) or {}
            payload = DrawRequest.model_validate(data)
        except Exception as e:
            raise BadRequest(f"Invalid payload: {e}") from e

        user_id = getattr(request, "user_id", None) or "default"
        tenant_id = getattr(request, "tenant_id", None) or "default"

        service = _get_service()
        try:
            result = service.draw_cards(payload, user_id, tenant_id)
            db.session.commit()
            return result.model_dump(mode="json")
        except ValueError as e:
            db.session.rollback()
            raise BadRequest(str(e)) from e
        except Exception as e:
            db.session.rollback()
            _logger.exception("Failed to draw cards")
            raise BadRequest(f"Failed to draw cards: {e}") from e


# ═══════════════════════════════════════════════════════════
# 抽卡记录
# ═══════════════════════════════════════════════════════════

@xiaoyz_ns.route("/records")
class DrawRecordsApi(Resource):
    @xiaoyz_ns.doc("list_draw_records")
    @xiaoyz_ns.doc(params={"user_id": "用户ID过滤", "config_id": "配置ID过滤", "page": "页码", "limit": "每页数量"})
    @login_required
    def get(self):
        """获取抽卡记录"""
        user_id = request.args.get("user_id")
        config_id = request.args.get("config_id")
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 20))

        service = _get_service()
        result = service.list_draw_records(user_id, config_id, page, limit)
        return result.model_dump(mode="json")


# ═══════════════════════════════════════════════════════════
# 卡牌收藏
# ═══════════════════════════════════════════════════════════

@xiaoyz_ns.route("/collection")
class CollectionApi(Resource):
    @xiaoyz_ns.doc("list_collection")
    @xiaoyz_ns.doc(params={"user_id": "用户ID（必填）", "rarity": "稀有度过滤", "page": "页码", "limit": "每页数量"})
    @login_required
    def get(self):
        """获取用户卡牌收藏"""
        user_id = request.args.get("user_id")
        if not user_id:
            user_id = getattr(request, "user_id", None) or "default"
        rarity = request.args.get("rarity")
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 20))

        service = _get_service()
        result = service.list_collection(user_id, rarity, page, limit)
        return result.model_dump(mode="json")


def create_xiaoyz_blueprint() -> Blueprint:
    """创建并返回 xiaoyz blueprint（包含 namespace）"""
    return xiaoyz_bp


# 定制 by chengm xiaoyz抽卡模块 API 路由 end
