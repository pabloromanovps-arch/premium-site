from salesai.agents.guard import GuardVerdict
from salesai.agents.handoff import handoff_reasons, handoff_summary
from salesai.agents.seller import Lead, SellerOutput
from salesai.llm.base import LLMError
from salesai.llm.scripted import ScriptedLLM

OK = GuardVerdict(action="send", issues=[])


def test_handoff_keyword_case_insensitive(shop):
    reasons = handoff_reasons(shop, "Это ЖАЛОБА на курьера", SellerOutput(reply="Понимаю"), OK)
    assert any("жалоба" in r for r in reasons)


def test_handoff_large_order(shop):
    lead = Lead(phone="+7916", product_ids=["b19", "b03"])
    reasons = handoff_reasons(shop, "оформляйте", SellerOutput(reply="Ок", lead=lead), OK)
    assert any("Крупный заказ" in r for r in reasons)
    reasons = handoff_reasons(shop, "Нужно 20 букетов, бюджет 18 000 ₽", SellerOutput(reply="Ок"), OK)
    assert any("Крупный заказ" in r for r in reasons)


def test_handoff_wants_human_and_escalate(shop):
    reasons = handoff_reasons(shop, "позовите человека", SellerOutput(reply="Зову", wants_human=True), GuardVerdict(action="escalate", issues=["Пустой ответ"]))
    assert len(reasons) == 2


def test_handoff_none_for_normal_message(shop):
    assert handoff_reasons(shop, "Какие розы есть?", SellerOutput(reply="Есть красные за 3490 ₽", product_ids=["b01"]), OK) == []


def test_summary_uses_llm(shop):
    llm = ScriptedLLM(["Клиент хочет 20 букетов.\nНужно согласовать цену."])
    history = [{"role": "user", "content": "Нужно 20 букетов"}]
    assert handoff_summary(llm, shop, history, ["Крупный заказ"]).startswith("Клиент хочет")
    assert "Крупный заказ" in llm.calls[0][-1]["content"]


def test_summary_fallback_on_llm_error(shop):
    def boom(messages):
        raise LLMError("нет сети")

    history = [
        {"role": "user", "content": "раз"},
        {"role": "assistant", "content": "два"},
        {"role": "user", "content": "три"},
        {"role": "user", "content": "четыре"},
    ]
    summary = handoff_summary(ScriptedLLM(boom), shop, history, ["Ключевое слово: жалоба"])
    assert "жалоба" in summary and "четыре" in summary and "два" in summary and "раз" not in summary
