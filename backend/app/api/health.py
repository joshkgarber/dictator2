from flask import jsonify

from ..db import get_db


def health():
    get_db().execute("SELECT 1").fetchone()
    return jsonify({"status": "ok", "service": "dictator2-backend"})
