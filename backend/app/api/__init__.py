from flask import Blueprint

from .auth import login, logout, me, register
from .health import health

api_bp = Blueprint("api", __name__)

api_bp.add_url_rule("/health", view_func=health, methods=["GET"])
api_bp.add_url_rule("/auth/register", view_func=register, methods=["POST"])
api_bp.add_url_rule("/auth/login", view_func=login, methods=["POST"])
api_bp.add_url_rule("/auth/logout", view_func=logout, methods=["POST"])
api_bp.add_url_rule("/auth/me", view_func=me, methods=["GET"])
