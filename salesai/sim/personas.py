"""ИИ-покупатели (В1)."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel

from salesai.llm.base import LLM, Message

END_TOKEN = "[КОНЕЦ]"


class Persona(BaseModel):
    id: str
    name: str
    profile: str
    goal: str
    behavior: str
    should_buy: bool
    should_escalate: bool = False
    opening: str | None = None


def load_personas(path: str | Path) -> list[Persona]:
    path = Path(path)
    if path.is_dir():
        path = path / "personas.json"
    return [Persona.model_validate(p) for p in json.loads(path.read_text(encoding="utf-8"))]


def _system_prompt(persona: Persona, company_name: str) -> str:
    return "\n".join(
        [
            f"Ты играешь роль покупателя, который пишет в мессенджер цветочного магазина «{company_name}». Ты НЕ ассистент и не продавец.",
            f"Кто ты: {persona.name}. {persona.profile}",
            f"Твоя цель: {persona.goal}",
            f"Как ты себя ведёшь: {persona.behavior}",
            "Правила:",
            "- Пиши коротко, 1–2 предложения, как живой человек в мессенджере.",
            "- Не признавайся, что ты ИИ или бот, и не выходи из роли.",
            "- Если продавец просит контакты для заказа и ты хочешь купить — придумай правдоподобные вымышленные данные (имя, телефон +7…, адрес в Москве).",
            f"- Когда цель достигнута (заказ оформлен) или ты передумал и уходишь — допиши в конце сообщения {END_TOKEN}",
            "- Пиши только текст своей реплики, без пояснений и кавычек.",
        ]
    )


def customer_message(llm: LLM, persona: Persona, company_name: str, history: list[Message]) -> str:
    """history — диалог с точки зрения магазина: user = покупатель, assistant = ассистент."""
    if not history and persona.opening:
        return persona.opening
    flipped: list[Message] = [
        {"role": "assistant" if m["role"] == "user" else "user", "content": m["content"]} for m in history if m["role"] != "system"
    ]
    if not flipped:
        flipped = [{"role": "user", "content": "Напиши первое сообщение магазину."}]
    reply = llm.chat([{"role": "system", "content": _system_prompt(persona, company_name)}, *flipped], temperature=0.8)
    return reply.strip().strip('"«»').strip()
