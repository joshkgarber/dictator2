from flask import Blueprint

from .auth import login, logout, me, register
from .chapters import (
    create_chapter,
    delete_chapter,
    get_chapter_clip,
    get_chapter,
    list_chapters,
    upload_chapter_clips,
    update_chapter,
    update_chapter_transcript,
    validate_chapter_readiness,
)
from .health import health
from .schedule import delete_chapter_schedule, list_schedule, upsert_chapter_schedule
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
from .stories import create_story, delete_story, get_story, list_stories, update_story

api_bp = Blueprint("api", __name__)
api_bp.add_url_rule("/health", view_func=health, methods=["GET"])
api_bp.add_url_rule("/auth/register", view_func=register, methods=["POST"])
api_bp.add_url_rule("/auth/login", view_func=login, methods=["POST"])
api_bp.add_url_rule("/auth/logout", view_func=logout, methods=["POST"])
api_bp.add_url_rule("/auth/me", view_func=me, methods=["GET"])
api_bp.add_url_rule("/stories", view_func=list_stories, methods=["GET"])
api_bp.add_url_rule("/stories", view_func=create_story, methods=["POST"])
api_bp.add_url_rule("/stories/<int:story_id>", view_func=get_story, methods=["GET"])
api_bp.add_url_rule("/stories/<int:story_id>", view_func=update_story, methods=["PATCH"])
api_bp.add_url_rule("/stories/<int:story_id>", view_func=delete_story, methods=["DELETE"])
api_bp.add_url_rule(
    "/stories/<int:story_id>/chapters", view_func=list_chapters, methods=["GET"]
)
api_bp.add_url_rule(
    "/stories/<int:story_id>/chapters", view_func=create_chapter, methods=["POST"]
)
api_bp.add_url_rule("/chapters/<int:chapter_id>", view_func=get_chapter, methods=["GET"])
api_bp.add_url_rule(
    "/chapters/<int:chapter_id>", view_func=update_chapter, methods=["PATCH"]
)
api_bp.add_url_rule(
    "/chapters/<int:chapter_id>", view_func=delete_chapter, methods=["DELETE"]
)
api_bp.add_url_rule(
    "/chapters/<int:chapter_id>/transcript",
    view_func=update_chapter_transcript,
    methods=["PUT"],
)
api_bp.add_url_rule(
    "/chapters/<int:chapter_id>/clips",
    view_func=upload_chapter_clips,
    methods=["POST"],
)
api_bp.add_url_rule(
    "/chapters/<int:chapter_id>/clips/<int:clip_index>",
    view_func=get_chapter_clip,
    methods=["GET"],
)
api_bp.add_url_rule(
    "/chapters/<int:chapter_id>/validate",
    view_func=validate_chapter_readiness,
    methods=["POST"],
)
api_bp.add_url_rule(
    "/chapters/<int:chapter_id>/sessions",
    view_func=start_session,
    methods=["POST"],
)
api_bp.add_url_rule(
    "/sessions",
    view_func=list_sessions,
    methods=["GET"],
)
api_bp.add_url_rule(
    "/sessions/<int:session_id>",
    view_func=get_session_details,
    methods=["GET"],
)
api_bp.add_url_rule(
    "/sessions/<int:session_id>/state",
    view_func=get_session_state,
    methods=["GET"],
)
api_bp.add_url_rule(
    "/sessions/<int:session_id>/attempts",
    view_func=create_attempt,
    methods=["POST"],
)
api_bp.add_url_rule(
    "/sessions/<int:session_id>/events",
    view_func=create_session_event,
    methods=["POST"],
)
api_bp.add_url_rule(
    "/sessions/<int:session_id>/diff",
    view_func=create_session_diff,
    methods=["POST"],
)
api_bp.add_url_rule(
    "/sessions/<int:session_id>/tutor-feedback",
    view_func=create_tutor_feedback,
    methods=["POST"],
)
api_bp.add_url_rule(
    "/sessions/<int:session_id>/complete",
    view_func=complete_session,
    methods=["POST"],
)
api_bp.add_url_rule(
    "/sessions/<int:session_id>/exit",
    view_func=exit_session,
    methods=["POST"],
)
api_bp.add_url_rule(
    "/schedule",
    view_func=list_schedule,
    methods=["GET"],
)
api_bp.add_url_rule(
    "/chapters/<int:chapter_id>/schedule",
    view_func=upsert_chapter_schedule,
    methods=["PUT"],
)
api_bp.add_url_rule(
    "/chapters/<int:chapter_id>/schedule",
    view_func=delete_chapter_schedule,
    methods=["DELETE"],
)
