"""GigaChat (Сбер)."""

from __future__ import annotations

import threading
import time
import uuid

import httpx

from salesai.llm._http import make_client, request_json
from salesai.llm.base import LLMError, Message

OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
CHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"


def _normalize(messages: list[Message]) -> list[dict]:
    """GigaChat принимает system только первым сообщением: остальные служебные указания идут как user."""
    out = []
    for i, m in enumerate(messages):
        if m["role"] == "system" and i > 0:
            out.append({"role": "user", "content": "[Служебное указание, не от покупателя] " + m["content"]})
        else:
            out.append({"role": m["role"], "content": m["content"]})
    return out


class GigaChatLLM:
    def __init__(
        self,
        auth_key: str,
        scope: str = "GIGACHAT_API_PERS",
        model: str = "GigaChat",
        ca_bundle: str | None = None,
        client: httpx.Client | None = None,
    ):
        self.name = f"gigachat:{model}"
        self.model = model
        self._auth_key = auth_key
        self._scope = scope
        self._client = client or make_client(ca_bundle)
        self._token: str | None = None
        self._token_until = 0.0
        self._lock = threading.Lock()

    def __repr__(self) -> str:
        return f"GigaChatLLM(model={self.model!r}, scope={self._scope!r})"

    def _get_token(self) -> str:
        with self._lock:
            if self._token and time.time() < self._token_until:
                return self._token
            data = request_json(
                self._client,
                "GigaChat",
                "POST",
                OAUTH_URL,
                headers={
                    "Authorization": f"Basic {self._auth_key}",
                    "RqUID": str(uuid.uuid4()),
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                },
                data={"scope": self._scope},
            )
            token = data.get("access_token")
            if not token:
                raise LLMError("GigaChat: в ответе OAuth нет токена")
            expires_at = data.get("expires_at") or 0
            # expires_at приходит в миллисекундах
            self._token_until = expires_at / 1000 - 60 if expires_at else time.time() + 25 * 60
            self._token = token
            return token

    def chat(self, messages: list[Message], *, temperature: float = 0.3) -> str:
        token = self._get_token()
        data = request_json(
            self._client,
            "GigaChat",
            "POST",
            CHAT_URL,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            json={
                "model": self.model,
                "messages": _normalize(messages),
                "temperature": temperature,
            },
        )
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise LLMError("GigaChat: неожиданный формат ответа") from None
