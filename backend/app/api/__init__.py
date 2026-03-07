from flask import Blueprint

from .auth import login, logout, me, register
from .health import health
from .schedule import delete_text_schedule, list_schedule, upsert_text_schedule
from .sessions import (
    complete_session,
    create_attempt,
    create_session_diff,
    create_session_event,
    create_tutor_feedback,
    exit_session,
    get_session_details,
    get_session_state,
    list_sessions,
    start_session,
)
from .texts import (
    create_text,
    delete_text,
    get_text,
    get_text_clip,
    list_texts,
    update_text,
    update_text_transcript,
    upload_text_clips,
    validate_text_readiness,
)

api_bp = Blueprint("api", __name__)

api_bp.add_url_rule("/health", view_func=health, methods=["GET"])
api_bp.add_url_rule("/auth/register", view_func=register, methods=["POST"])
api_bp.add_url_rule("/auth/login", view_func=login, methods=["POST"])
api_bp.add_url_rule("/auth/logout", view_func=logout, methods=["POST"])
api_bp.add_url_rule("/auth/me", view_func=me, methods=["GET"])
api_bp.add_url_rule("/texts", view_func=list_texts, methods=["GET"])
api_bp.add_url_rule("/texts", view_func=create_text, methods=["POST"])
api_bp.add_url_rule("/texts/<int:text_id>", view_func=get_text, methods=["GET"])
api_bp.add_url_rule("/texts/<int:text_id>", view_func=update_text, methods=["PATCH"])
api_bp.add_url_rule("/texts/<int:text_id>", view_func=delete_text, methods=["DELETE"])
api_bp.add_url_rule(
    "/texts/<int:text_id>/transcript",
    view_func=update_text_transcript,
    methods=["PUT"],
)
api_bp.add_url_rule("/texts/<int:text_id>/clips", view_func=upload_text_clips, methods=["POST"])
api_bp.add_url_rule(
    "/texts/<int:text_id>/clips/<int:clip_index>",
    view_func=get_text_clip,
    methods=["GET"],
)
api_bp.add_url_rule("/texts/<int:text_id>/validate", view_func=validate_text_readiness, methods=["POST"])
api_bp.add_url_rule("/texts/<int:text_id>/sessions", view_func=start_session, methods=["POST"])
api_bp.add_url_rule("/sessions", view_func=list_sessions, methods=["GET"])
api_bp.add_url_rule("/sessions/<int:session_id>", view_func=get_session_details, methods=["GET"])
api_bp.add_url_rule("/sessions/<int:session_id>/state", view_func=get_session_state, methods=["GET"])
api_bp.add_url_rule("/sessions/<int:session_id>/attempts", view_func=create_attempt, methods=["POST"])
api_bp.add_url_rule("/sessions/<int:session_id>/events", view_func=create_session_event, methods=["POST"])
api_bp.add_url_rule("/sessions/<int:session_id>/diff", view_func=create_session_diff, methods=["POST"])
api_bp.add_url_rule(
    "/sessions/<int:session_id>/tutor-feedback",
    view_func=create_tutor_feedback,
    methods=["POST"],
)
api_bp.add_url_rule("/sessions/<int:session_id>/complete", view_func=complete_session, methods=["POST"])
api_bp.add_url_rule("/sessions/<int:session_id>/exit", view_func=exit_session, methods=["POST"])
api_bp.add_url_rule("/schedule", view_func=list_schedule, methods=["GET"])
api_bp.add_url_rule("/texts/<int:text_id>/schedule", view_func=upsert_text_schedule, methods=["PUT"])
api_bp.add_url_rule("/texts/<int:text_id>/schedule", view_func=delete_text_schedule, methods=["DELETE"])
