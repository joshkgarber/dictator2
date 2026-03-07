from __future__ import annotations

import sqlite3
from pathlib import Path

from flask import current_app, g


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        database_path = Path(current_app.config["DATABASE"])
        database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        g.db = connection
    return g.db


def close_db(_error=None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def _apply_migrations() -> None:
    db = get_db()
    migrations_path = Path(__file__).resolve().parents[1] / "migrations"
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at INTEGER NOT NULL
        )
        """
    )
    applied_rows = db.execute("SELECT version FROM schema_migrations").fetchall()
    applied_versions = {row["version"] for row in applied_rows}

    for migration_file in sorted(migrations_path.glob("*.sql")):
        version = migration_file.name
        if version in applied_versions:
            continue
        db.executescript(migration_file.read_text(encoding="utf-8"))
        db.execute(
            "INSERT INTO schema_migrations(version, applied_at) VALUES (?, strftime('%s','now'))",
            (version,),
        )
    db.commit()


def init_db() -> None:
    _apply_migrations()


def init_app(app) -> None:
    app.teardown_appcontext(close_db)

    @app.cli.command("init-db")
    def init_db_command():
        init_db()
        print("Database initialized.")
