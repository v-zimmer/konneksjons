"""
Minimal helper for writing to a Turso (libSQL) database over its plain HTTP
API (the Hrana v2 "pipeline" endpoint) using just `requests` - no WebSocket
client needed. The official libsql-client Python package defaults to a
WebSocket transport that fails its handshake against this project's Turso
endpoint; the HTTP pipeline endpoint is simpler and worked in testing.

get_connection() returns either a plain sqlite3.Connection (local dev, no
Turso env vars set) or a TursoHttpConnection (TURSO_DATABASE_URL/
TURSO_AUTH_TOKEN set) - both expose .execute()/.executemany()/.commit()/
.close(), so callers don't need to care which one they got.
"""
import os
import sqlite3

import requests


class TursoHttpConnection:
    def __init__(self, url: str, token: str):
        self._base_url = url.replace("libsql://", "https://", 1)
        self._token = token

    @staticmethod
    def _typed_arg(value):
        if value is None:
            return {"type": "null"}
        if isinstance(value, bool):
            return {"type": "integer", "value": str(int(value))}
        if isinstance(value, int):
            return {"type": "integer", "value": str(value)}
        if isinstance(value, float):
            return {"type": "float", "value": value}
        return {"type": "text", "value": str(value)}

    def _pipeline(self, requests_body):
        resp = requests.post(
            f"{self._base_url}/v2/pipeline",
            headers={"Authorization": f"Bearer {self._token}"},
            json={"requests": requests_body},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        for result in data["results"]:
            if result["type"] == "error":
                raise RuntimeError(f"Turso error: {result['error']}")
        return data["results"]

    def execute(self, sql, args=None):
        stmt = {"sql": sql}
        if args:
            stmt["args"] = [self._typed_arg(a) for a in args]
        self._pipeline([{"type": "execute", "stmt": stmt}, {"type": "close"}])

    def executemany(self, sql, rows):
        rows = list(rows)
        if not rows:
            return
        requests_body = [
            {"type": "execute", "stmt": {"sql": sql, "args": [self._typed_arg(a) for a in row]}}
            for row in rows
        ]
        requests_body.append({"type": "close"})
        self._pipeline(requests_body)

    def commit(self):
        pass  # each pipeline call is already committed server-side

    def close(self):
        pass


def get_connection(local_db_path):
    url = os.environ.get("TURSO_DATABASE_URL")
    token = os.environ.get("TURSO_AUTH_TOKEN")
    if url:
        if not token:
            raise SystemExit("TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is not.")
        return TursoHttpConnection(url, token)

    if not local_db_path.exists():
        raise SystemExit(
            f"{local_db_path} does not exist. Run `pnpm db:push` in web/ first to create the schema."
        )
    return sqlite3.connect(local_db_path)
