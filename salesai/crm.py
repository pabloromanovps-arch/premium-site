"""CRM-клерк (A4): встроенная мини-CRM на SQLite."""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from salesai.agents.seller import Lead
from salesai.llm.base import Message

SCHEMA = """
CREATE TABLE IF NOT EXISTS dialogs (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'open',
    escalated INTEGER NOT NULL DEFAULT 0,
    summary TEXT,
    reasons TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dialog_id TEXT NOT NULL REFERENCES dialogs(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    extra TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dialog_id TEXT NOT NULL UNIQUE REFERENCES dialogs(id),
    name TEXT,
    phone TEXT,
    product_ids TEXT NOT NULL DEFAULT '[]',
    delivery_date TEXT,
    address TEXT,
    comment TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""

LEAD_FIELDS = ["name", "phone", "delivery_date", "address", "comment"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class CRM:
    def __init__(self, db_path: str = ":memory:"):
        if db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(db_path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        with self._lock:
            self._db.executescript(SCHEMA)

    def _exec(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        with self._lock:
            cur = self._db.execute(sql, params)
            self._db.commit()
            return cur

    def _all(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        with self._lock:
            return self._db.execute(sql, params).fetchall()

    def create_dialog(self, channel: str, meta: dict | None = None) -> str:
        dialog_id = str(uuid.uuid4())
        self._exec(
            "INSERT INTO dialogs (id, channel, meta, created_at) VALUES (?, ?, ?, ?)",
            (dialog_id, channel, json.dumps(meta or {}, ensure_ascii=False), _now()),
        )
        return dialog_id

    def log_message(self, dialog_id: str, role: str, content: str, extra: dict | None = None) -> None:
        self._exec(
            "INSERT INTO messages (dialog_id, role, content, extra, created_at) VALUES (?, ?, ?, ?, ?)",
            (dialog_id, role, content, json.dumps(extra or {}, ensure_ascii=False), _now()),
        )

    def get_history(self, dialog_id: str) -> list[Message]:
        rows = self._all(
            "SELECT role, content FROM messages WHERE dialog_id = ? AND role IN ('user', 'assistant') ORDER BY id", (dialog_id,)
        )
        return [{"role": r["role"], "content": r["content"]} for r in rows]

    def upsert_lead(self, dialog_id: str, lead: Lead) -> int:
        with self._lock:
            row = self._db.execute("SELECT * FROM leads WHERE dialog_id = ?", (dialog_id,)).fetchone()
            now = _now()
            if row is None:
                cur = self._db.execute(
                    "INSERT INTO leads (dialog_id, name, phone, product_ids, delivery_date, address, comment, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (dialog_id, lead.name, lead.phone, json.dumps(lead.product_ids), lead.delivery_date, lead.address, lead.comment, now, now),
                )
                self._db.commit()
                return cur.lastrowid
            values = {f: getattr(lead, f) or row[f] for f in LEAD_FIELDS}
            products = lead.product_ids or json.loads(row["product_ids"])
            self._db.execute(
                "UPDATE leads SET name=?, phone=?, delivery_date=?, address=?, comment=?, product_ids=?, updated_at=? WHERE id=?",
                (*[values[f] for f in LEAD_FIELDS], json.dumps(products), now, row["id"]),
            )
            self._db.commit()
            return row["id"]

    @staticmethod
    def _lead_dict(row: sqlite3.Row) -> dict:
        d = dict(row)
        d["product_ids"] = json.loads(d["product_ids"])
        d["complete"] = Lead(phone=d["phone"], product_ids=d["product_ids"]).is_complete()
        return d

    def get_lead(self, dialog_id: str) -> dict | None:
        rows = self._all("SELECT * FROM leads WHERE dialog_id = ?", (dialog_id,))
        return self._lead_dict(rows[0]) if rows else None

    def list_leads(self, limit: int = 100) -> list[dict]:
        rows = self._all(
            "SELECT l.*, d.escalated, d.summary, d.channel FROM leads l JOIN dialogs d ON d.id = l.dialog_id ORDER BY l.updated_at DESC, l.id DESC LIMIT ?",
            (limit,),
        )
        leads = []
        for r in rows:
            d = self._lead_dict(r)
            d["escalated"] = bool(d["escalated"])
            leads.append(d)
        return leads

    def mark_escalated(self, dialog_id: str, summary: str, reasons: list[str]) -> None:
        self._exec(
            "UPDATE dialogs SET escalated = 1, summary = ?, reasons = ? WHERE id = ?",
            (summary, json.dumps(reasons, ensure_ascii=False), dialog_id),
        )

    def set_status(self, dialog_id: str, status: str) -> None:
        self._exec("UPDATE dialogs SET status = ? WHERE id = ?", (status, dialog_id))

    def get_dialog(self, dialog_id: str) -> dict:
        rows = self._all("SELECT * FROM dialogs WHERE id = ?", (dialog_id,))
        if not rows:
            raise KeyError(dialog_id)
        d = dict(rows[0])
        d["meta"] = json.loads(d["meta"])
        d["reasons"] = json.loads(d["reasons"])
        d["escalated"] = bool(d["escalated"])
        d["messages"] = [
            {"role": r["role"], "content": r["content"], "extra": json.loads(r["extra"]), "created_at": r["created_at"]}
            for r in self._all("SELECT * FROM messages WHERE dialog_id = ? ORDER BY id", (dialog_id,))
        ]
        d["lead"] = self.get_lead(dialog_id)
        return d
