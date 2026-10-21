"""Модель с заранее заданными ответами — для тестов без сети."""

from __future__ import annotations

import threading
from typing import Callable

from salesai.llm.base import LLMError, Message


class ScriptedLLM:
    def __init__(self, responses: list[str] | Callable[[list[Message]], str], name: str = "scripted"):
        self.name = name
        self._responses = responses if callable(responses) else list(responses)
        self.calls: list[list[Message]] = []
        self._lock = threading.Lock()

    def chat(self, messages: list[Message], *, temperature: float = 0.3) -> str:
        with self._lock:
            self.calls.append([dict(m) for m in messages])
            if callable(self._responses):
                return self._responses(messages)
            if not self._responses:
                raise LLMError("ScriptedLLM: ответы закончились")
            return self._responses.pop(0)
