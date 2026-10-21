from conftest import seller_json

from salesai.agents.seller import FALLBACK_REPLY
from salesai.crm import CRM
from salesai.llm.scripted import ScriptedLLM
from salesai.pipeline import Assistant

FULL_LEAD = {"name": "Ира", "phone": "+79161112233", "product_ids": ["b09"], "delivery_date": "25.10", "address": "Тверская, 1"}


def test_pipeline_happy_path_creates_lead(shop):
    crm = CRM()
    d = crm.create_dialog("web")
    llm = ScriptedLLM([seller_json("Оформила «Утро в Провансе» за 3 990 ₽.", ["b09"], FULL_LEAD)])
    turn = Assistant(shop, llm, crm).handle(d, "Беру, мой телефон +79161112233")
    assert turn.lead_id is not None and turn.escalated is False and turn.attempts == 1
    assert crm.get_lead(d)["complete"] is True
    assert crm.get_history(d)[-1]["content"] == turn.reply


def test_pipeline_retries_on_invented_price_then_sends(shop):
    crm = CRM()
    d = crm.create_dialog("web")
    llm = ScriptedLLM([seller_json("Букет стоит 777 ₽"), seller_json("Букет стоит 3 990 ₽", ["b09"])])
    turn = Assistant(shop, llm, crm).handle(d, "Сколько стоит?")
    assert turn.attempts == 2 and turn.guard_issues == []
    assert turn.reply == "Букет стоит 3 990 ₽"
    assert "777" in llm.calls[1][-1]["content"]
    assert crm.get_dialog(d)["messages"][-1]["extra"]["guard_history"] == [["Цена 777 ₽ отсутствует в каталоге"]]


def test_pipeline_escalates_after_failed_retries(shop):
    crm = CRM()
    d = crm.create_dialog("web")
    llm = ScriptedLLM([seller_json("777 ₽"), seller_json("778 ₽"), seller_json("779 ₽"), "Сводка для менеджера"])
    turn = Assistant(shop, llm, crm).handle(d, "Сколько?")
    assert turn.reply == FALLBACK_REPLY and turn.escalated is True and turn.attempts == 3
    assert "Контролёр не пропустил ответ" in turn.reasons
    assert turn.summary == "Сводка для менеджера"
    assert crm.get_dialog(d)["escalated"] is True


def test_pipeline_escalates_once_per_dialog(shop):
    crm = CRM()
    d = crm.create_dialog("web")
    llm = ScriptedLLM([seller_json("Подключаю менеджера", wants_human=True), "Сводка 1", seller_json("Менеджер скоро ответит", wants_human=True)])
    a = Assistant(shop, llm, crm)
    first = a.handle(d, "Жалоба!")
    second = a.handle(d, "Ну где?")
    assert first.summary == "Сводка 1" and second.summary is None
    assert second.escalated is True and second.reply == "Менеджер скоро ответит"
    assert len(llm.calls) == 3


def test_pipeline_truncates_long_input(shop):
    crm = CRM()
    d = crm.create_dialog("web")
    Assistant(shop, ScriptedLLM([seller_json("Ок")]), crm).handle(d, "я" * 5000)
    assert len(crm.get_history(d)[0]["content"]) == 2000
