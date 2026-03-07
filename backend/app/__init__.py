from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask

from .api import api_bp
from .auth import init_auth
from .db import init_app as init_db_app
from .db import init_db


def create_app(test_config: dict | None = None) -> Flask:
    project_root = Path(__file__).resolve().parents[2]
    load_dotenv(project_root / ".env")
    load_dotenv(project_root / "backend" / ".env")

    app = Flask(
        __name__,
        instance_path=str(project_root / "backend" / "instance"),
        instance_relative_config=False,
    )

    app.config.from_mapping(
        SECRET_KEY=os.getenv("SECRET_KEY", "dev-only-secret"),
        DATABASE=os.getenv(
            "DATABASE", str(project_root / "backend" / "instance" / "dictator2.sqlite3")
        ),
        CLIP_STORAGE_ROOT=os.getenv(
            "CLIP_STORAGE_ROOT", str(project_root / "backend" / "instance" / "clips")
        ),
        SESSION_COOKIE_NAME=os.getenv("SESSION_COOKIE_NAME", "dictator2_session"),
        AUTH_SESSION_TTL_HOURS=int(os.getenv("AUTH_SESSION_TTL_HOURS", "720")),
        OPENAI_API_KEY=os.getenv("OPENAI_API_KEY", ""),
        OPENAI_TUTOR_MODEL=os.getenv("OPENAI_TUTOR_MODEL", "gpt-4o-mini"),
        CORS_ORIGIN=os.getenv("CORS_ORIGIN", "http://localhost:5173"),
        API_PREFIX="/api",
    )

    if test_config is not None:
        app.config.update(test_config)

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)

    init_db_app(app)
    init_auth(app)

    app.register_blueprint(api_bp, url_prefix=app.config["API_PREFIX"])

    @app.after_request
    def add_cors_headers(response):
        origin = app.config.get("CORS_ORIGIN")
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-CSRF-Token"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        return response

    @app.route("/", methods=["GET"])
    def root():
        return {"name": "dictator2-backend", "status": "ok"}

    with app.app_context():
        init_db()

    return app
