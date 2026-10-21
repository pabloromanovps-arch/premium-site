from conftest import seller_json

from salesai.crm import CRM
from salesai.llm.base import LLMError
from salesai.llm.scripted import ScriptedLLM
from salesai.sim.judge import SCORE_KEYS
from salesai.sim.personas import Persona
from salesai.sim.runner import run_dialog, run_simulation

JUDGE_OK = '{"scores": {' + ", ".join(f'"{k}": 4' for k in SCORE_KEYS) + '}, "problems": [], "summary": "ок"}'
LEAD = {"name": "Ира", "phone": "+79161112233", "product_ids": ["b09"]}


def persona(pid="p", should_buy=True, opening="Хочу букет маме"):
    return Persona(id=pid, name="Ира", profile="", goal="букет", behavior="", should_buy=should_buy, opening=opening)


def test_run_dialog_finishes_on_end_token(shop):
    crm = CRM()
    customer = ScriptedLLM(["Беру, +79161112233 [КОНЕЦ]"])
    assistant = ScriptedLLM([seller_json("Советую «Утро в Провансе» за 3 990 ₽", ["b09"]), seller_json("Оформила!", ["b09"], LEAD)])
    transcript, v = run_dialog(shop, persona(), assistant, customer, ScriptedLLM([JUDGE_OK]), crm, max_turns=5)
    assert v.status == "finished" and v.lead_captured and v.lead_complete
    assert len(transcript) == 4
    assert all("[КОНЕЦ]" not in m["content"] for m in transcript)
    assert v.scores["тон"] == 4


def test_run_dialog_end_token_alone_skips_assistant(shop):
    crm = CRM()
    transcript, v = run_dialog(shop, persona(), ScriptedLLM([seller_json("Привет")]), ScriptedLLM(["[КОНЕЦ]"]), ScriptedLLM([JUDGE_OK]), crm)
    assert v.status == "finished" and len(transcript) == 2 and v.lead_captured is False


def test_run_dialog_timeout(shop):
    crm = CRM()
    customer = ScriptedLLM(lambda m: "А ещё?")
    assistant = ScriptedLLM(lambda m: seller_json("Есть розы"))
    transcript, v = run_dialog(shop, persona(), assistant, customer, ScriptedLLM([JUDGE_OK]), crm, max_turns=3)
    assert v.status == "timeout" and len(transcript) == 6
    assert v.scores  # Судья всё равно оценил


def test_run_dialog_llm_error_marks_error(shop):
    crm = CRM()
    calls = {"n": 0}

    def flaky(messages):
        calls["n"] += 1
        if calls["n"] == 2:
            raise LLMError("GigaChat: сеть недоступна (ConnectError)")
        return seller_json("Есть розы")

    customer = ScriptedLLM(lambda m: "Ещё вопрос")
    _, v = run_dialog(shop, persona(), ScriptedLLM(flaky), customer, ScriptedLLM([JUDGE_OK]), crm, max_turns=5)
    assert v.status == "error"
    assert any("сеть недоступна" in p for p in v.problems)


def test_run_simulation_parallel_counts(shop):
    personas = [persona("buy1", opening="беру, +79161112233"), persona("buy2", opening="просто смотрю"), persona("nobuy", should_buy=False, opening="спасибо")]

    def assistant(messages):
        last = messages[-1]["content"]
        lead = LEAD if "+7916" in last else None
        return seller_json("Оформила" if lead else "Хорошо", ["b09"] if lead else [], lead)

    progress = []
    report = run_simulation(
        shop,
        personas,
        ScriptedLLM(assistant),
        ScriptedLLM(lambda m: "[КОНЕЦ]"),
        ScriptedLLM(lambda m: JUDGE_OK),
        max_turns=3,
        workers=3,
        on_progress=lambda done, total: progress.append((done, total)),
    )
    assert len(report.verdicts) == 3 and set(report.transcripts) == {"buy1", "buy2", "nobuy"}
    assert report.conversion == 0.5
    assert report.false_leads == 0 and report.errors == 0
    assert report.avg_scores["тон"] == 4.0
    assert progress[-1] == (3, 3)
