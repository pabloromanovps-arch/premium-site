"""Конвейер ассистента: Продавец → Контролёр → Диспетчер эскалации → CRM-клерк."""

from __future__ import annotations

from pydantic import BaseModel

from salesai.agents.guard import guard_check
from salesai.agents.handoff import handoff_reasons, handoff_summary
from salesai.agents.seller import FALLBACK_REPLY, seller_reply
from salesai.company import Company
from salesai.crm import CRM
from salesai.llm.base import LLM

MAX_INPUT_CHARS = 2000
MAX_GUARD_RETRIES = 2
GUARD_REJECTED = "Контролёр не пропустил ответ"


class AssistantTurn(BaseModel):
    reply: str
    product_ids: list[str]
    escalated: bool
    reasons: list[str]
    summary: str | None
    lead_id: int | None
    guard_issues: list[str]
    attempts: int


class Assistant:
    def __init__(self, company: Company, llm: LLM, crm: CRM):
        self.company = company
        self.llm = llm
        self.crm = crm

    def handle(self, dialog_id: str, user_text: str) -> AssistantTurn:
        text = user_text.strip()[:MAX_INPUT_CHARS]
        self.crm.log_message(dialog_id, "user", text)
        history = self.crm.get_history(dialog_id)
        context = "\n".join(m["content"] for m in history if m["role"] == "user")

        feedback: list[str] | None = None
        guard_history: list[list[str]] = []
        for attempt in range(1, MAX_GUARD_RETRIES + 2):
            out = seller_reply(self.llm, self.company, history, feedback)
            verdict = guard_check(self.company, out, context=context)
            if verdict.action != "fix":
                break
            guard_history.append(verdict.issues)
            feedback = verdict.issues

        reasons = handoff_reasons(self.company, text, out, verdict)
        reply, product_ids = out.reply, out.product_ids
        if verdict.action != "send":
            reply, product_ids = FALLBACK_REPLY, []
            if verdict.action == "fix":
                reasons.append(GUARD_REJECTED)

        lead_id = None
        if out.lead is not None and out.lead.has_data():
            lead_id = self.crm.upsert_lead(dialog_id, out.lead)

        summary = None
        already = self.crm.get_dialog(dialog_id)["escalated"]
        if reasons and not already:
            summary = handoff_summary(self.llm, self.company, history, reasons)
            self.crm.mark_escalated(dialog_id, summary, reasons)

        self.crm.log_message(
            dialog_id,
            "assistant",
            reply,
            {"guard_issues": verdict.issues, "guard_history": guard_history, "attempts": attempt, "reasons": reasons, "product_ids": product_ids},
        )
        return AssistantTurn(
            reply=reply,
            product_ids=product_ids,
            escalated=already or bool(reasons),
            reasons=reasons,
            summary=summary,
            lead_id=lead_id,
            guard_issues=verdict.issues,
            attempts=attempt,
        )
