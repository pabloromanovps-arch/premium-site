import json
import subprocess
import sys

from conftest import ROOT

from salesai.llm.base import LLMError
from salesai.llm.scripted import ScriptedLLM
from salesai.sim.judge import Verdict
from salesai.sim.personas import Persona
from salesai.sim.report import SimReport, analyze, render_markdown


def verdict(pid, lead=False, status="finished", problems=(), scores=None, esc=False, esc_ok=True):
    return Verdict(
        persona_id=pid, status=status, lead_captured=lead, lead_complete=lead, escalated=esc, escalation_correct=esc_ok,
        guard_retries=1, scores=scores or {"тон": 4, "точность": 5}, problems=list(problems), summary="итог",
    )


def report(variant=None, lead_b=True):
    personas = [
        Persona(id="a", name="Ира", profile="", goal="", behavior="", should_buy=True),
        Persona(id="b", name="Олег", profile="", goal="", behavior="", should_buy=True),
        Persona(id="c", name="Тролль", profile="", goal="", behavior="", should_buy=False),
    ]
    return SimReport(
        run_id="r1", company_id="lepestok", company_name="Лепесток", variant=variant, started_at="2026-10-21T10:00:00",
        personas=personas,
        verdicts=[verdict("a", lead=True), verdict("b", lead=lead_b, problems=["Не спросил дату"]), verdict("c", status="error", problems=["Ошибка модели"])],
        transcripts={"a": [{"role": "user", "content": "Привет"}, {"role": "assistant", "content": "Здравствуйте"}], "b": [], "c": []},
    )


def test_report_metrics():
    r = report(lead_b=False)
    assert r.conversion == 0.5 and r.errors == 1 and r.guard_retries_total == 3
    assert r.escalation_accuracy == 1.0
    assert r.avg_scores == {"тон": 4.0, "точность": 5.0}


def test_report_markdown_has_sections_and_ab_table():
    base, variant = report(lead_b=False), report(variant="Скидка 15%")
    md = render_markdown(variant, ["Спрашивать дату доставки"], baseline=base)
    for section in ["## Итог", "## A vs B", "## Что исправить", "## Диалоги с проблемами", "## Расшифровки"]:
        assert section in md
    assert "50%" in md and "100%" in md and "+50" in md
    assert "Спрашивать дату доставки" in md
    assert "Не спросил дату" in md and "(#b-b)" in md and '<a id="b-b"></a>' in md
    assert "Здравствуйте" in md
    single = render_markdown(base, [])
    assert "## A vs B" not in single and "Аналитик не дал рекомендаций" in single


def test_analyze_parses_and_falls_back():
    llm = ScriptedLLM(['{"recommendations": ["Добавить в базу ответ про самовывоз", "Спрашивать дату"]}'])
    assert analyze(llm, report()) == ["Добавить в базу ответ про самовывоз", "Спрашивать дату"]
    assert "Не спросил дату" in llm.calls[0][-1]["content"]

    def boom(m):
        raise LLMError("нет сети")

    assert analyze(ScriptedLLM(boom), report()) == []


def test_cli_without_key_exits_2(tmp_path):
    env = {"PATH": "/usr/bin:/bin", "LLM_PROVIDER": "gigachat", "PYTHONPATH": str(ROOT)}
    proc = subprocess.run(
        [sys.executable, "-m", "salesai.sim.cli", "--company", str(ROOT / "companies/flower_shop"), "--personas", "2", "--out", str(tmp_path)],
        capture_output=True, text=True, env=env, cwd=ROOT,
    )
    assert proc.returncode == 2
    assert "Модель не подключена" in proc.stderr
    assert list(tmp_path.iterdir()) == []


def test_cli_ab_end_to_end_with_scripted(tmp_path, monkeypatch):
    from conftest import seller_json

    import salesai.sim.cli as cli
    from salesai.sim.judge import SCORE_KEYS

    judge = '{"scores": {' + ", ".join(f'"{k}": 4' for k in SCORE_KEYS) + '}, "problems": ["мелочь"], "summary": "ок", "recommendations": ["Совет"]}'
    fakes = {
        "assistant": ScriptedLLM(lambda m: seller_json("Есть розы за 3 490 ₽", ["b01"]), name="fake-assistant"),
        "customer": ScriptedLLM(lambda m: "Спасибо [КОНЕЦ]", name="fake-customer"),
        "judge": ScriptedLLM(lambda m: judge, name="fake-judge"),
    }
    monkeypatch.setattr(cli, "get_llm", lambda role: fakes[role])
    code = cli.main([
        "--company", str(ROOT / "companies/flower_shop"), "--personas", "2", "--max-turns", "2",
        "--variant", str(ROOT / "companies/flower_shop/variants/promo_second_bouquet.json"), "--out", str(tmp_path),
    ])
    assert code == 0
    md = next(tmp_path.glob("*.md")).read_text(encoding="utf-8")
    assert "## A vs B" in md and "Скидка 15% на второй букет" in md and "A: Совет" in md and "B: Совет" in md
    data = json.loads(next(tmp_path.glob("*.json")).read_text(encoding="utf-8"))
    assert len(data) == 2 and data[1]["variant"] == "Скидка 15% на второй букет"
