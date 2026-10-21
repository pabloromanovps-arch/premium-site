import json
import time

import httpx
import pytest

from salesai.llm.base import LLMError, parse_json
from salesai.llm.factory import get_llm
from salesai.llm.gigachat import GigaChatLLM
from salesai.llm.scripted import ScriptedLLM
from salesai.llm.yandex import YandexLLM


def test_parse_json_plain():
    assert parse_json('Ответ: {"a": 1, "b": {"c": "}"}} хвост') == {"a": 1, "b": {"c": "}"}}


def test_parse_json_fenced():
    text = 'Вот:\n```json\n{"reply": "Привет"}\n```'
    assert parse_json(text) == {"reply": "Привет"}


def test_parse_json_raises():
    with pytest.raises(ValueError):
        parse_json("просто текст без json")
    with pytest.raises(ValueError):
        parse_json("[1, 2, 3]")


def test_scripted_returns_in_order_and_records_calls():
    llm = ScriptedLLM(["один", "два"])
    assert llm.chat([{"role": "user", "content": "a"}]) == "один"
    assert llm.chat([{"role": "user", "content": "b"}]) == "два"
    assert [c[0]["content"] for c in llm.calls] == ["a", "b"]
    fn = ScriptedLLM(lambda msgs: msgs[-1]["content"].upper())
    assert fn.chat([{"role": "user", "content": "x"}]) == "X"


def test_scripted_exhausted_raises():
    llm = ScriptedLLM(["один"])
    llm.chat([])
    with pytest.raises(LLMError):
        llm.chat([])


def test_gigachat_gets_token_then_chats():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path == "/api/v2/oauth":
            assert request.headers["Authorization"] == "Basic SECRETKEY"
            assert request.headers["RqUID"]
            assert b"scope=GIGACHAT_API_PERS" in request.content
            return httpx.Response(200, json={"access_token": "t", "expires_at": int((time.time() + 3600) * 1000)})
        assert request.url.path == "/api/v1/chat/completions"
        assert request.headers["Authorization"] == "Bearer t"
        body = json.loads(request.content)
        assert body["messages"][0] == {"role": "user", "content": "Привет?"}
        return httpx.Response(200, json={"choices": [{"message": {"content": "Привет"}}]})

    llm = GigaChatLLM("SECRETKEY", client=httpx.Client(transport=httpx.MockTransport(handler)))
    assert llm.chat([{"role": "user", "content": "Привет?"}]) == "Привет"
    assert llm.chat([{"role": "user", "content": "Привет?"}]) == "Привет"
    assert [r.url.path for r in seen].count("/api/v2/oauth") == 1


def test_yandex_maps_roles_and_parses():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Api-Key K"
        body = json.loads(request.content)
        assert body["modelUri"] == "gpt://F/yandexgpt-lite/latest"
        assert body["messages"] == [
            {"role": "system", "text": "s"},
            {"role": "user", "text": "u"},
            {"role": "assistant", "text": "a"},
        ]
        return httpx.Response(200, json={"result": {"alternatives": [{"message": {"role": "assistant", "text": "Ок"}}]}})

    llm = YandexLLM("K", "F", client=httpx.Client(transport=httpx.MockTransport(handler)))
    msgs = [{"role": "system", "content": "s"}, {"role": "user", "content": "u"}, {"role": "assistant", "content": "a"}]
    assert llm.chat(msgs) == "Ок"


def test_provider_http_error_is_llmerror_without_key():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom SECRETKEY")

    llm = GigaChatLLM("SECRETKEY", client=httpx.Client(transport=httpx.MockTransport(handler)))
    with pytest.raises(LLMError) as e:
        llm.chat([{"role": "user", "content": "x"}])
    assert "SECRETKEY" not in str(e.value)

    def network(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("no route")

    llm = YandexLLM("SECRETKEY", "F", client=httpx.Client(transport=httpx.MockTransport(network)))
    with pytest.raises(LLMError) as e:
        llm.chat([{"role": "user", "content": "x"}])
    assert "SECRETKEY" not in str(e.value)


def test_get_llm_without_key_raises(monkeypatch):
    for var in ["GIGACHAT_AUTH_KEY", "YANDEX_API_KEY", "YANDEX_FOLDER_ID", "LLM_PROVIDER_CUSTOMER", "LLM_PROVIDER_JUDGE"]:
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("LLM_PROVIDER", "gigachat")
    with pytest.raises(LLMError, match="Модель не подключена"):
        get_llm()
    monkeypatch.setenv("LLM_PROVIDER", "yandex")
    with pytest.raises(LLMError, match="Модель не подключена"):
        get_llm("judge")


def test_get_llm_role_override(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "gigachat")
    monkeypatch.setenv("GIGACHAT_AUTH_KEY", "k")
    monkeypatch.setenv("LLM_PROVIDER_JUDGE", "yandex")
    monkeypatch.setenv("YANDEX_API_KEY", "y")
    monkeypatch.setenv("YANDEX_FOLDER_ID", "f")
    assert isinstance(get_llm("assistant"), GigaChatLLM)
    assert isinstance(get_llm("judge"), YandexLLM)


def test_gigachat_moves_late_system_messages():
    from salesai.llm.gigachat import _normalize

    out = _normalize([
        {"role": "system", "content": "s"},
        {"role": "user", "content": "u"},
        {"role": "system", "content": "исправь"},
    ])
    assert out[0] == {"role": "system", "content": "s"}
    assert out[2]["role"] == "user" and out[2]["content"].endswith("исправь")
