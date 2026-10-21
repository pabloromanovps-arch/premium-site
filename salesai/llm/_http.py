"""Общие HTTP-помощники провайдеров."""

from __future__ import annotations

import os
import ssl

import httpx

from salesai.llm.base import LLMError

TIMEOUT = httpx.Timeout(60.0, connect=15.0)


def make_client(ca_bundle: str | None = None) -> httpx.Client:
    """Клиент с системными корнями (или SSL_CERT_FILE) плюс необязательный дополнительный бандл."""
    ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
    if ca_bundle:
        ctx.load_verify_locations(cafile=ca_bundle)
    return httpx.Client(verify=ctx, timeout=TIMEOUT)


def request_json(client: httpx.Client, provider: str, method: str, url: str, **kwargs) -> dict:
    """Запрос с переводом любых сетевых и HTTP-ошибок в LLMError без секретов в тексте."""
    try:
        resp = client.request(method, url, **kwargs)
    except httpx.HTTPError as e:
        raise LLMError(f"{provider}: сеть недоступна ({type(e).__name__})") from None
    if resp.status_code >= 400:
        raise LLMError(f"{provider}: HTTP {resp.status_code} на {httpx.URL(url).path}")
    try:
        return resp.json()
    except ValueError:
        raise LLMError(f"{provider}: ответ не JSON") from None
