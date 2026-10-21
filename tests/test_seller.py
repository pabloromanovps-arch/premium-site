from conftest import seller_json

from salesai.agents.seller import FALLBACK_REPLY, seller_reply
from salesai.llm.scripted import ScriptedLLM

HISTORY = [{"role": "user", "content": "Хочу букет маме"}]


def test_seller_parses_json_and_drops_unknown_ids(shop):
    raw = seller_json(
        "Советую «Утро в Провансе».",
        ["b09", "zzz"],
        lead={"name": "Ира", "phone": None, "product_ids": ["b09", "nope"]},
    )
    llm = ScriptedLLM([f"Вот ответ:\n```json\n{raw}\n```"])
    out = seller_reply(llm, shop, HISTORY)
    assert out.reply == "Советую «Утро в Провансе»."
    assert out.product_ids == ["b09"]
    assert out.lead.name == "Ира" and out.lead.product_ids == ["b09"]
    assert out.lead.is_complete() is False
    assert out.wants_human is False


def test_seller_retries_once_on_bad_json(shop):
    llm = ScriptedLLM(["не json", seller_json("Привет")])
    out = seller_reply(llm, shop, HISTORY)
    assert out.reply == "Привет"
    assert len(llm.calls) == 2
    assert "JSON" in llm.calls[1][-1]["content"]


def test_seller_retries_on_json_without_reply(shop):
    llm = ScriptedLLM(['{"product_ids": []}', seller_json("Ок")])
    assert seller_reply(llm, shop, HISTORY).reply == "Ок"


def test_seller_fallback_after_two_bad_json(shop):
    llm = ScriptedLLM(["не json", "опять не json"])
    out = seller_reply(llm, shop, HISTORY)
    assert out.wants_human is True
    assert out.reply == FALLBACK_REPLY


def test_seller_prompt_contains_catalog_and_feedback(shop):
    llm = ScriptedLLM([seller_json()])
    seller_reply(llm, shop, HISTORY, feedback=["Цена 777 ₽ отсутствует в каталоге"])
    msgs = llm.calls[0]
    assert msgs[0]["role"] == "system"
    assert "Утро в Провансе" in msgs[0]["content"] and "3990 ₽" in msgs[0]["content"]
    assert msgs[1] == HISTORY[0]
    assert msgs[-1]["role"] == "system" and "Исправь ответ" in msgs[-1]["content"] and "777" in msgs[-1]["content"]


def test_lead_is_complete():
    from salesai.agents.seller import Lead

    assert Lead(phone="+79161112233", product_ids=["b01"]).is_complete()
    assert not Lead(phone="+79161112233").is_complete()
