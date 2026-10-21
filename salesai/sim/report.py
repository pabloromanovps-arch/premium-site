"""Сводка симуляции, Аналитик (A6) и Markdown-отчёт."""

from __future__ import annotations

from pydantic import BaseModel, ValidationError

from salesai.llm.base import LLM, LLMError, Message, parse_json
from salesai.sim.judge import SCORE_KEYS, Verdict
from salesai.sim.personas import Persona

STATUS_RU = {"finished": "завершён", "timeout": "не уложился в лимит ходов", "error": "ошибка"}


class SimReport(BaseModel):
    run_id: str
    company_id: str
    company_name: str = ""
    variant: str | None = None
    started_at: str
    models: dict[str, str] = {}
    personas: list[Persona] = []
    verdicts: list[Verdict]
    transcripts: dict[str, list[Message]]

    def persona(self, persona_id: str) -> Persona | None:
        return next((p for p in self.personas if p.id == persona_id), None)

    def _ok(self) -> list[Verdict]:
        return [v for v in self.verdicts if v.status != "error"]

    @property
    def conversion(self) -> float | None:
        """Доля диалогов с заявкой (есть телефон) среди покупателей, которые должны купить; ошибки не учитываются."""
        buyers = [v for v in self._ok() if (p := self.persona(v.persona_id)) and p.should_buy]
        return sum(v.lead_captured for v in buyers) / len(buyers) if buyers else None

    @property
    def false_leads(self) -> int:
        return sum(v.lead_captured for v in self.verdicts if (p := self.persona(v.persona_id)) and not p.should_buy)

    @property
    def escalation_accuracy(self) -> float | None:
        ok = self._ok()
        return sum(v.escalation_correct for v in ok) / len(ok) if ok else None

    @property
    def avg_scores(self) -> dict[str, float]:
        out = {}
        for key in SCORE_KEYS:
            values = [v.scores[key] for v in self.verdicts if key in v.scores]
            if values:
                out[key] = round(sum(values) / len(values), 2)
        return out

    @property
    def errors(self) -> int:
        return sum(v.status == "error" for v in self.verdicts)

    @property
    def guard_retries_total(self) -> int:
        return sum(v.guard_retries for v in self.verdicts)

    @property
    def leads_complete(self) -> int:
        return sum(v.lead_complete for v in self.verdicts)

    @property
    def escalations(self) -> int:
        return sum(v.escalated for v in self.verdicts)


class _Analysis(BaseModel):
    recommendations: list[str]


def analyze(llm: LLM, report: SimReport) -> list[str]:
    """Аналитик: 3–7 конкретных рекомендаций по проблемам из вердиктов."""
    lines = []
    for v in report.verdicts:
        p = report.persona(v.persona_id)
        who = f"{p.name} ({p.goal})" if p else v.persona_id
        lines.append(f"- {who}: статус {v.status}, заявка {'да' if v.lead_captured else 'нет'}; проблемы: {'; '.join(v.problems) or 'нет'}; итог: {v.summary}")
    messages: list[Message] = [
        {
            "role": "system",
            "content": "Ты — аналитик диалогов ИИ-ассистента продаж. По оценкам Судьи дай 3–7 конкретных рекомендаций, что исправить "
            "в базе знаний, сценарии или правилах ассистента (например: «добавить в базу ответ про самовывоз», «ассистент не спрашивает дату доставки»). "
            'Пиши по-русски, коротко. Ответ строго JSON: {"recommendations": ["...", "..."]}',
        },
        {"role": "user", "content": f"Магазин: {report.company_name}. Результаты {len(report.verdicts)} диалогов:\n" + "\n".join(lines)},
    ]
    try:
        return _Analysis.model_validate(parse_json(llm.chat(messages, temperature=0.2))).recommendations[:7]
    except (LLMError, ValueError, ValidationError):
        return []


def _pct(x: float | None) -> str:
    return "—" if x is None else f"{round(x * 100)}%"


def _diff_pct(a: float | None, b: float | None) -> str:
    if a is None or b is None:
        return "—"
    d = round((b - a) * 100)
    return f"{d:+d} п.п."


def _num(x: float | None) -> str:
    return "—" if x is None else (f"{x:g}" if isinstance(x, float) else str(x))


def _diff_num(a, b) -> str:
    if a is None or b is None:
        return "—"
    d = round(b - a, 2)
    return f"{d:+g}"


def _summary_rows(r: SimReport) -> list[tuple[str, object, str]]:
    """(название, значение, вид) — вид: pct | num."""
    rows = [
        ("Конверсия в заявку (среди тех, кто хотел купить)", r.conversion, "pct"),
        ("Полных заявок (телефон + товар)", r.leads_complete, "num"),
        ("Заявки от тех, кто не собирался покупать", r.false_leads, "num"),
        ("Эскалаций менеджеру", r.escalations, "num"),
        ("Точность эскалаций", r.escalation_accuracy, "pct"),
        ("Черновиков, исправленных Контролёром (выдуманные цены и т.п.)", r.guard_retries_total, "num"),
        ("Диалогов с ошибкой модели/сети", r.errors, "num"),
    ]
    rows += [(f"Средний балл: {k.replace('_', ' ')}", r.avg_scores.get(k), "num") for k in SCORE_KEYS]
    return rows


def _fmt(value, kind: str) -> str:
    return _pct(value) if kind == "pct" else _num(value)


def _problems_section(r: SimReport, prefix: str) -> list[str]:
    out = []
    for v in r.verdicts:
        if not v.problems and v.status == "finished" and v.escalation_correct:
            continue
        p = r.persona(v.persona_id)
        problems = list(v.problems)
        if not v.escalation_correct:
            problems.append("Эскалация лишняя" if v.escalated else "Нужно было позвать менеджера, но эскалации не было")
        name = f"{p.name} — {p.goal}" if p else v.persona_id
        out.append(f"- **{name}** · {STATUS_RU[v.status]} · [расшифровка](#{prefix}-{v.persona_id})")
        out += [f"  - {x}" for x in problems] or ["  - (замечаний нет)"]
    return out or ["Проблемных диалогов нет."]


def _transcripts_section(r: SimReport, prefix: str) -> list[str]:
    out = []
    for v in r.verdicts:
        p = r.persona(v.persona_id)
        out += ["", f'<a id="{prefix}-{v.persona_id}"></a>', f"### {p.name if p else v.persona_id} ({v.persona_id})", ""]
        if p:
            out.append(f"_Цель: {p.goal}. Ожидалось: {'покупка' if p.should_buy else 'без покупки'}{', нужен менеджер' if p.should_escalate else ''}._")
        out.append(
            f"_Статус: {STATUS_RU[v.status]} · заявка: {'да' if v.lead_captured else 'нет'} · эскалация: {'да' if v.escalated else 'нет'}"
            f" · оценки: {', '.join(f'{k} {s}' for k, s in v.scores.items()) or '—'}_"
        )
        if v.summary:
            out.append(f"> Судья: {v.summary}")
        out.append("")
        for m in r.transcripts.get(v.persona_id, []):
            who = "👤 Покупатель" if m["role"] == "user" else "💐 Ассистент"
            out.append(f"**{who}:** {m['content']}  ")
        if not r.transcripts.get(v.persona_id):
            out.append("(диалог пуст)")
    return out


def render_markdown(report: SimReport, insights: list[str], baseline: SimReport | None = None) -> str:
    title = report.company_name or report.company_id
    lines = [f"# Отчёт симуляции: «{title}»", ""]
    lines.append(f"- Запуск: {report.started_at} · id `{report.run_id}`")
    if report.models:
        lines.append("- Модели: " + ", ".join(f"{k} — {v}" for k, v in report.models.items()))
    lines.append(f"- Персон: {len(report.verdicts)}")
    if baseline is not None:
        lines.append(f"- Сравнение: A — текущая версия, B — вариант «{report.variant}»")
    elif report.variant:
        lines.append(f"- Вариант: «{report.variant}»")
    lines += [
        "",
        "> Симулятор находит ошибки и сравнивает версии, но не предсказывает реальный спрос: покупатели — ИИ-персоны.",
        "",
        "## Итог",
        "",
    ]
    main = baseline if baseline is not None else report
    lines += ["| Показатель | Значение |", "|---|---|"]
    lines += [f"| {name} | {_fmt(value, kind)} |" for name, value, kind in _summary_rows(main)]
    if baseline is not None:
        lines += ["", "## A vs B", "", "| Показатель | A (база) | B (вариант) | Разница |", "|---|---|---|---|"]
        for (name, a, kind), (_, b, _) in zip(_summary_rows(baseline), _summary_rows(report)):
            diff = _diff_pct(a, b) if kind == "pct" else _diff_num(a, b)
            lines.append(f"| {name} | {_fmt(a, kind)} | {_fmt(b, kind)} | {diff} |")
    lines += ["", "## Что исправить", ""]
    lines += [f"{i}. {x}" for i, x in enumerate(insights, 1)] or ["Аналитик не дал рекомендаций."]
    lines += ["", "## Диалоги с проблемами", ""]
    if baseline is not None:
        lines += ["### A (база)", "", *_problems_section(baseline, "a"), "", "### B (вариант)", "", *_problems_section(report, "b")]
        lines += ["", "## Расшифровки", "", "## A (база)", *_transcripts_section(baseline, "a"), "", "## B (вариант)", *_transcripts_section(report, "b")]
    else:
        lines += _problems_section(report, "b")
        lines += ["", "## Расшифровки", *_transcripts_section(report, "b")]
    return "\n".join(lines) + "\n"
