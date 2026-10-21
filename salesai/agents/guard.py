"""Контролёр (A2): детерминированная проверка черновика ответа, без модели."""

from __future__ import annotations

import re
from itertools import combinations
from typing import Literal

from pydantic import BaseModel

from salesai.agents.seller import SellerOutput
from salesai.company import Company

MAX_REPLY_CHARS = 1200
MAX_QUANTITY = 100

_NUM = r"(\d{1,3}(?:[   ]\d{3})+|\d+)"
_AMOUNT = re.compile(_NUM + r"\s*(?:₽|руб|р\.|р(?![а-яёa-z]))", re.IGNORECASE)
_DISCOUNT = re.compile(
    r"скидк\w*[^.!?\n%]{0,40}?(\d{1,3})\s*%|[−–-]\s*(\d{1,3})\s*%|(\d{1,3})\s*%[^.!?\n]{0,20}скидк",
    re.IGNORECASE,
)
_PHONE = re.compile(r"(?:\+7|\b8)[\s(\-]*\d{3}[\s)\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}\b")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


class GuardVerdict(BaseModel):
    action: Literal["send", "fix", "escalate"]
    issues: list[str]


def _to_int(s: str) -> int:
    return int(re.sub(r"\D", "", s))


def extract_amounts(text: str) -> list[int]:
    """Суммы рядом с ₽ / руб / р. в любых написаниях."""
    return [_to_int(m.group(1)) for m in _AMOUNT.finditer(text)]


def _phone_key(s: str) -> str:
    return re.sub(r"\D", "", s)[-10:]


def _delivery_options(company: Company) -> set[int]:
    d = company.delivery
    options = {0}
    for v in d.values():
        if isinstance(v, dict) and isinstance(v.get("price"), int):
            options.add(v["price"])
    standard = d.get("standard", {}).get("price", 0) if isinstance(d.get("standard"), dict) else 0
    per_km = d.get("outside_mkad", {}).get("price_per_km") if isinstance(d.get("outside_mkad"), dict) else None
    if per_km:
        options |= {standard + per_km * km for km in range(1, 101)}
    return options


def _allowed_totals(company: Company, product_ids: list[str]) -> set[int]:
    """Суммы, которые можно получить из рекомендованных товаров: наборы, количества, доставка, акции."""
    prices = [p.price for i in product_ids if (p := company.product(i))]
    subtotals: set[int] = set()
    for r in range(1, min(len(prices), 6) + 1):
        for combo in combinations(prices, r):
            subtotals.add(sum(combo))
    for price in prices:
        subtotals |= {price * q for q in range(2, MAX_QUANTITY + 1)}
    percents = [p.discount_percent for p in company.promos if p.discount_percent]
    discounted = {round(s * (100 - pct) / 100) for s in subtotals for pct in percents}
    totals = set()
    for base in subtotals | discounted:
        totals |= {base + d for d in _delivery_options(company)}
    return totals


def guard_check(company: Company, out: SellerOutput, context: str = "") -> GuardVerdict:
    """context — реплики покупателя: суммы и контакты, которые он сам назвал, повторять можно."""
    reply = out.reply.strip()
    if not reply:
        return GuardVerdict(action="escalate", issues=["Пустой ответ"])

    issues: list[str] = []
    allowed = company.all_amounts() | set(extract_amounts(context)) | {_to_int(n) for n in re.findall(_NUM, context)}
    totals: set[int] | None = None
    for amount in dict.fromkeys(extract_amounts(reply)):
        if amount in allowed:
            continue
        if totals is None:
            totals = _allowed_totals(company, out.product_ids)
        if amount not in totals:
            issues.append(f"Цена {amount} ₽ отсутствует в каталоге")

    percents = {p.discount_percent for p in company.promos if p.discount_percent}
    for m in _DISCOUNT.finditer(reply):
        pct = int(next(g for g in m.groups() if g))
        if pct not in percents:
            issues.append(f"Скидки {pct}% нет ни в одной акции")

    if len(reply) > MAX_REPLY_CHARS:
        issues.append(f"Ответ длиннее {MAX_REPLY_CHARS} символов — сократи")

    known_text = company.model_dump_json() + "\n" + context
    known_phones = {_phone_key(p) for p in _PHONE.findall(known_text)}
    if any(_phone_key(p) not in known_phones for p in _PHONE.findall(reply)):
        issues.append("В ответе телефон, которого нет в данных компании")
    known_emails = {e.lower() for e in _EMAIL.findall(known_text)}
    if any(e.lower() not in known_emails for e in _EMAIL.findall(reply)):
        issues.append("В ответе email, которого нет в данных компании")

    return GuardVerdict(action="fix" if issues else "send", issues=list(dict.fromkeys(issues)))
