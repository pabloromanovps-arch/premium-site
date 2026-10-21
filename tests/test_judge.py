import json

from salesai.llm.base import LLMError
from salesai.llm.scripted import ScriptedLLM
from salesai.sim.judge import SCORE_KEYS, judge_dialog
from salesai.sim.personas import Persona

PERSONA = Persona(id="p", name="Ира", profile="", goal="букет", behavior="", should_buy=True, should_escalate=False)
TRANSCRIPT = [{"role": "user", "content": "Хочу букет"}, {"role": "assistant", "content": "Есть «Нежность»"}]
FACTS = {"lead_captured": True, "lead_complete": False, "escalated": True, "guard_retries": 2, "status": "timeout"}


def test_judge_keeps_facts_and_clamps_scores(shop):
    raw = json.dumps(
        {
            "scores": {"понимание_запроса": 9, "точность": 0, "тон": 4, "продающая_сила": "3", "скорость_к_цели": 5, "лишнее": 5},
            "problems": ["Не спросил дату"],
            "summary": "Нормально",
            "lead_captured": False,
        },
        ensure_ascii=False,
    )
    v = judge_dialog(ScriptedLLM([raw]), shop, PERSONA, TRANSCRIPT, FACTS)
    assert v.lead_captured is True and v.lead_complete is False and v.status == "timeout" and v.guard_retries == 2
    assert v.scores == {"понимание_запроса": 5, "точность": 1, "тон": 4, "продающая_сила": 3, "скорость_к_цели": 5}
    assert v.problems == ["Не спросил дату"] and v.summary == "Нормально"


def test_judge_escalation_correct(shop):
    raw = json.dumps({"scores": {k: 3 for k in SCORE_KEYS}, "problems": [], "summary": "ok"})
    v = judge_dialog(ScriptedLLM([raw]), shop, PERSONA, TRANSCRIPT, FACTS)
    assert v.escalated is True and v.escalation_correct is False
    v = judge_dialog(ScriptedLLM([raw]), shop, PERSONA.model_copy(update={"should_escalate": True}), TRANSCRIPT, FACTS)
    assert v.escalation_correct is True


def test_judge_fallback_on_bad_json(shop):
    v = judge_dialog(ScriptedLLM(["оценка: хорошо"]), shop, PERSONA, TRANSCRIPT, FACTS)
    assert v.scores == {} and v.problems == ["Судья не смог оценить диалог"]

    def boom(messages):
        raise LLMError("нет сети")

    v = judge_dialog(ScriptedLLM(boom), shop, PERSONA, TRANSCRIPT, FACTS)
    assert v.scores == {} and v.lead_captured is True
