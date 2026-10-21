"""Прогон симуляции: покупатель ↔ ассистент, затем Судья."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Callable

from salesai.company import Company
from salesai.crm import CRM
from salesai.llm.base import LLM, LLMError, Message
from salesai.pipeline import Assistant
from salesai.sim.judge import Verdict, judge_dialog
from salesai.sim.personas import END_TOKEN, Persona, customer_message
from salesai.sim.report import SimReport


def run_dialog(
    company: Company,
    persona: Persona,
    assistant_llm: LLM,
    customer_llm: LLM,
    judge_llm: LLM,
    crm: CRM,
    max_turns: int = 8,
) -> tuple[list[Message], Verdict]:
    dialog_id = crm.create_dialog("sim", {"persona": persona.id})
    assistant = Assistant(company, assistant_llm, crm)
    status, error, guard_retries = "timeout", None, 0
    try:
        for _ in range(max_turns):
            raw = customer_message(customer_llm, persona, company.name, crm.get_history(dialog_id))
            ended = END_TOKEN in raw
            text = raw.replace(END_TOKEN, "").strip()
            if text:
                guard_retries += assistant.handle(dialog_id, text).attempts - 1
            if ended:
                status = "finished"
                break
    except LLMError as e:
        status, error = "error", str(e)
    crm.set_status(dialog_id, status)

    dialog = crm.get_dialog(dialog_id)
    lead = dialog["lead"]
    facts = {
        "status": status,
        "lead_captured": bool(lead and lead["phone"]),
        "lead_complete": bool(lead and lead["complete"]),
        "escalated": dialog["escalated"],
        "guard_retries": guard_retries,
    }
    transcript = crm.get_history(dialog_id)
    verdict = judge_dialog(judge_llm, company, persona, transcript, facts)
    if error:
        verdict.problems.insert(0, f"Ошибка модели: {error}")
    return transcript, verdict


def run_simulation(
    company: Company,
    personas: list[Persona],
    assistant_llm: LLM,
    customer_llm: LLM,
    judge_llm: LLM,
    *,
    max_turns: int = 8,
    workers: int = 4,
    variant_name: str | None = None,
    on_progress: Callable[[int, int], None] | None = None,
) -> SimReport:
    crm = CRM(":memory:")
    started = datetime.now().isoformat(timespec="seconds")
    results: dict[str, tuple[list[Message], Verdict]] = {}
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = {
            pool.submit(run_dialog, company, p, assistant_llm, customer_llm, judge_llm, crm, max_turns): p for p in personas
        }
        for done, future in enumerate(as_completed(futures), start=1):
            results[futures[future].id] = future.result()
            if on_progress:
                on_progress(done, len(personas))
    return SimReport(
        run_id=uuid.uuid4().hex[:12],
        company_id=company.id,
        company_name=company.name,
        variant=variant_name,
        started_at=started,
        models={"assistant": assistant_llm.name, "customer": customer_llm.name, "judge": judge_llm.name},
        personas=personas,
        verdicts=[results[p.id][1] for p in personas],
        transcripts={p.id: results[p.id][0] for p in personas},
    )
