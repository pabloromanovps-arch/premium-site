"""YandexGPT (Yandex Cloud Foundation Models)."""

from __future__ import annotations

import httpx

from salesai.llm._http import make_client, request_json
from salesai.llm.base import LLMError, Message

COMPLETION_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"


class YandexLLM:
    def __init__(self, api_key: str, folder_id: str, model: str = "yandexgpt-lite", client: httpx.Client | None = None):
        self.name = f"yandex:{model}"
        self.model = model
        self._api_key = api_key
        self._folder_id = folder_id
        self._client = client or make_client()

    def __repr__(self) -> str:
        return f"YandexLLM(model={self.model!r})"

    def chat(self, messages: list[Message], *, temperature: float = 0.3) -> str:
        data = request_json(
            self._client,
            "YandexGPT",
            "POST",
            COMPLETION_URL,
            headers={"Authorization": f"Api-Key {self._api_key}", "x-folder-id": self._folder_id},
            json={
                "modelUri": f"gpt://{self._folder_id}/{self.model}/latest",
                "completionOptions": {"stream": False, "temperature": temperature, "maxTokens": "2000"},
                "messages": [{"role": m["role"], "text": m["content"]} for m in messages],
            },
        )
        try:
            return data["result"]["alternatives"][0]["message"]["text"]
        except (KeyError, IndexError, TypeError):
            raise LLMError("YandexGPT: неожиданный формат ответа") from None
