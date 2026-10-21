"""Выбор провайдера по переменным окружения."""

from __future__ import annotations

import os
from typing import Literal

from salesai.llm.base import LLM, LLMError

Role = Literal["assistant", "customer", "judge"]


def get_llm(role: Role = "assistant") -> LLM:
    provider = (os.environ.get(f"LLM_PROVIDER_{role.upper()}") or os.environ.get("LLM_PROVIDER") or "gigachat").strip().lower()
    if provider == "gigachat":
        key = os.environ.get("GIGACHAT_AUTH_KEY")
        if not key:
            raise LLMError("Модель не подключена: задайте GIGACHAT_AUTH_KEY")
        from salesai.llm.gigachat import GigaChatLLM

        return GigaChatLLM(
            key,
            scope=os.environ.get("GIGACHAT_SCOPE") or "GIGACHAT_API_PERS",
            model=os.environ.get("GIGACHAT_MODEL") or "GigaChat",
            ca_bundle=os.environ.get("GIGACHAT_CA_BUNDLE") or None,
        )
    if provider == "yandex":
        key, folder = os.environ.get("YANDEX_API_KEY"), os.environ.get("YANDEX_FOLDER_ID")
        if not key or not folder:
            raise LLMError("Модель не подключена: задайте YANDEX_API_KEY и YANDEX_FOLDER_ID")
        from salesai.llm.yandex import YandexLLM

        return YandexLLM(key, folder, model=os.environ.get("YANDEX_MODEL") or "yandexgpt-lite")
    raise LLMError(f"Модель не подключена: неизвестный LLM_PROVIDER «{provider}» (gigachat | yandex)")
