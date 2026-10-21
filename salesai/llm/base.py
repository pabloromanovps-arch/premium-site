"""Общий интерфейс языковых моделей."""

from __future__ import annotations

import json
import re
from typing import Literal, Protocol, TypedDict


class Message(TypedDict):
    role: Literal["system", "user", "assistant"]
    content: str


class LLMError(RuntimeError):
    """Модель недоступна или ответила ошибкой. Текст никогда не содержит ключей."""


class LLM(Protocol):
    name: str

    def chat(self, messages: list[Message], *, temperature: float = 0.3) -> str: ...


_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def parse_json(text: str) -> dict:
    """Достаёт первый JSON-объект из текста, в том числе из ```json-блока."""
    candidates = [m.group(1) for m in _FENCE.finditer(text)] + [text]
    decoder = json.JSONDecoder()
    for chunk in candidates:
        for start in (i for i, ch in enumerate(chunk) if ch == "{"):
            try:
                obj, _ = decoder.raw_decode(chunk, start)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict):
                return obj
    raise ValueError("В ответе модели нет JSON-объекта")
