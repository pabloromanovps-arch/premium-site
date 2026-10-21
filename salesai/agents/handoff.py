"""Диспетчер эскалации (A3): когда звать человека и что ему рассказать."""

from __future__ import annotations

from salesai.agents.guard import GuardVerdict, extract_amounts
from salesai.agents.seller import SellerOutput
from salesai.company import Company
from salesai.llm.base import LLM, LLMError, Message


def handoff_reasons(company: Company, user_text: str, out: SellerOutput, verdict: GuardVerdict) -> list[str]:
    reasons: list[str] = []
    if out.wants_human:
        reasons.append("Ассистент просит подключить менеджера")
    if verdict.action == "escalate":
        reasons.append("Контролёр: " + "; ".join(verdict.issues))
    lowered = user_text.lower()
    for keyword in company.handoff.get("keywords", []):
        if keyword.lower() in lowered:
            reasons.append(f"Ключевое слово: {keyword}")
    threshold = company.handoff.get("large_order_rub")
    if threshold:
        lead_total = sum(p.price for i in (out.lead.product_ids if out.lead else []) if (p := company.product(i)))
        named = max(extract_amounts(user_text) + extract_amounts(out.reply), default=0)
        total = max(lead_total, named)
        if total >= threshold:
            reasons.append(f"Крупный заказ: {total} ₽ (порог {threshold} ₽)")
    return reasons


def _template_summary(history: list[Message], reasons: list[str]) -> str:
    who = {"user": "Клиент", "assistant": "Ассистент", "system": "Система"}
    lines = ["Причины: " + "; ".join(reasons)]
    lines += [f"{who[m['role']]}: {m['content'][:200]}" for m in history[-3:]]
    return "\n".join(lines)


def handoff_summary(llm: LLM, company: Company, history: list[Message], reasons: list[str]) -> str:
    transcript = "\n".join(f"{'Клиент' if m['role'] == 'user' else 'Ассистент'}: {m['content']}" for m in history if m["role"] != "system")
    messages: list[Message] = [
        {
            "role": "system",
            "content": f"Ты помогаешь менеджеру магазина «{company.name}». Составь сводку диалога для менеджера в 3–5 коротких строках: "
            "кто клиент и что хочет, что уже предложено и согласовано, контакты, почему нужен человек, что сделать первым. Без вступлений.",
        },
        {"role": "user", "content": f"Диалог:\n{transcript}\n\nПричины передачи менеджеру: {'; '.join(reasons)}"},
    ]
    try:
        summary = llm.chat(messages, temperature=0.2).strip()
    except LLMError:
        summary = ""
    return summary or _template_summary(history, reasons)
