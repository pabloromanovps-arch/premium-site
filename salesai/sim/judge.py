"""Судья (В3): оценивает диалог по чек-листу."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ValidationError

from salesai.company import Company
from salesai.llm.base import LLM, LLMError, Message, parse_json
from salesai.sim.personas import Persona

SCORE_KEYS = ["понимание_запроса", "точность", "тон", "продающая_сила", "скорость_к_цели"]
JUDGE_FAILED = "Судья не смог оценить диалог"


class Verdict(BaseModel):
    persona_id: str
    status: Literal["finished", "timeout", "error"]
    lead_captured: bool
    lead_complete: bool
    escalated: bool
    escalation_correct: bool
    guard_retries: int
    scores: dict[str, int]
    problems: list[str]
    summary: str


class _JudgeAnswer(BaseModel):
    scores: dict[str, int | float | str]
    problems: list[str] = []
    summary: str = ""


def _clamp(value) -> int | None:
    try:
        return max(1, min(5, round(float(value))))
    except (TypeError, ValueError):
        return None


def _prompt(company: Company, persona: Persona, transcript: list[Message], facts: dict) -> list[Message]:
    dialog = "\n".join(f"{'Покупатель' if m['role'] == 'user' else 'Ассистент'}: {m['content']}" for m in transcript)
    keys = ", ".join(f'"{k}"' for k in SCORE_KEYS)
    return [
        {
            "role": "system",
            "content": "Ты — строгий Судья качества ИИ-ассистента продаж. Оцени диалог ассистента магазина с покупателем.\n"
            f"Шкала 1–5 для ключей {keys}: 5 — отлично, 1 — плохо.\n"
            "«точность» — ассистент называл только факты из базы знаний (цены, сроки, условия); любая выдумка — не выше 2.\n"
            "В problems перечисли конкретные ошибки ассистента (коротко, по-русски), в summary — 1–2 предложения итога.\n"
            'Ответь строго JSON: {"scores": {...}, "problems": [...], "summary": "..."}\n\n'
            f"БАЗА ЗНАНИЙ МАГАЗИНА:\n{company.render_knowledge()}",
        },
        {
            "role": "user",
            "content": f"Покупатель: {persona.name}. {persona.profile}\nЕго цель: {persona.goal}\nПоведение: {persona.behavior}\n"
            f"Ожидалось: {'купит' if persona.should_buy else 'не купит'}, {'нужен менеджер' if persona.should_escalate else 'менеджер не обязателен'}.\n"
            f"Факты из CRM: {facts}\n\nДИАЛОГ:\n{dialog or '(пусто)'}",
        },
    ]


def judge_dialog(llm: LLM, company: Company, persona: Persona, transcript: list[Message], facts: dict) -> Verdict:
    escalated = bool(facts.get("escalated"))
    base = dict(
        persona_id=persona.id,
        status=facts.get("status", "finished"),
        lead_captured=bool(facts.get("lead_captured")),
        lead_complete=bool(facts.get("lead_complete")),
        escalated=escalated,
        escalation_correct=escalated == persona.should_escalate,
        guard_retries=int(facts.get("guard_retries", 0)),
    )
    messages = _prompt(company, persona, transcript, facts)
    answer = None
    for _ in range(2):
        try:
            raw = llm.chat(messages, temperature=0.1)
            answer = _JudgeAnswer.model_validate(parse_json(raw))
            break
        except LLMError:
            break
        except (ValueError, ValidationError):
            continue
    if answer is None:
        return Verdict(**base, scores={}, problems=[JUDGE_FAILED], summary="")
    scores = {k: s for k in SCORE_KEYS if k in answer.scores and (s := _clamp(answer.scores[k])) is not None}
    return Verdict(**base, scores=scores, problems=answer.problems, summary=answer.summary)
