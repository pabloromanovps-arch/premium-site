"""Продавец (A1): отвечает покупателю по базе знаний и собирает заявку."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

from salesai.company import Company
from salesai.llm.base import LLM, Message, parse_json

FALLBACK_REPLY = "Секунду, уточню у менеджера и вернусь с ответом."

FORMAT_HINT = (
    'Ответь строго одним JSON-объектом без текста вокруг: {"reply": "текст для покупателя", '
    '"product_ids": ["id товаров, которые ты рекомендуешь в этом ответе"], '
    '"lead": {"name": null, "phone": null, "product_ids": [], "delivery_date": null, "address": null, "comment": null} или null, '
    '"wants_human": false}'
)


def _none_to_list(value):
    return [] if value is None else value


class Lead(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    name: str | None = None
    phone: str | None = None
    product_ids: list[str] = []
    delivery_date: str | None = None
    address: str | None = None
    comment: str | None = None

    _ids = field_validator("product_ids", mode="before")(_none_to_list)

    def is_complete(self) -> bool:
        return bool(self.phone) and bool(self.product_ids)

    def has_data(self) -> bool:
        return any([self.name, self.phone, self.product_ids, self.delivery_date, self.address, self.comment])


class SellerOutput(BaseModel):
    reply: str
    product_ids: list[str] = []
    lead: Lead | None = None
    wants_human: bool = False

    _ids = field_validator("product_ids", mode="before")(_none_to_list)


def build_system_prompt(company: Company) -> str:
    return "\n".join(
        [
            f"Ты — ИИ-консультант магазина «{company.name}» в мессенджере. Помогаешь выбрать и оформить заказ.",
            f"Тон: {company.tone}",
            "",
            "Правила:",
            "1. Называй только цены, скидки, сроки и условия из базы знаний ниже. Ничего не придумывай.",
            "2. Не обещай того, чего нет в правилах магазина. Если не знаешь ответа — скажи, что уточнишь у менеджера.",
            "3. Предлагай 1–3 подходящих товара, помогай выбрать, мягко предлагай дополнения (открытка, конфеты).",
            "4. Чтобы оформить заказ, собери: имя, телефон, дату и время доставки, адрес. Спрашивай по одному-два пункта за раз.",
            "5. Если покупатель просит живого человека, жалуется, конфликтует или вопрос вне твоих полномочий (возврат, претензия) — поставь wants_human=true и вежливо скажи, что подключишь менеджера.",
            "6. Товары с пометкой «НЕТ В НАЛИЧИИ» не продавай — предложи замену.",
            "7. Пиши коротко: 1–4 предложения, без markdown.",
            "8. В lead записывай всё, что покупатель уже сообщил за весь диалог (имя, телефон, выбранные товары, дату, адрес).",
            "",
            "БАЗА ЗНАНИЙ:",
            company.render_knowledge(),
            "",
            FORMAT_HINT,
        ]
    )


def _parse(company: Company, text: str) -> SellerOutput:
    out = SellerOutput.model_validate(parse_json(text))
    known = {p.id for p in company.products}
    out.product_ids = [i for i in out.product_ids if i in known]
    if out.lead is not None:
        out.lead.product_ids = [i for i in out.lead.product_ids if i in known]
    return out


def seller_reply(llm: LLM, company: Company, history: list[Message], feedback: list[str] | None = None) -> SellerOutput:
    messages: list[Message] = [{"role": "system", "content": build_system_prompt(company)}, *history]
    if feedback:
        messages.append({"role": "system", "content": "Исправь ответ: " + "; ".join(feedback)})
    raw = llm.chat(messages)
    try:
        return _parse(company, raw)
    except (ValueError, ValidationError):
        pass
    retry = messages + [
        {"role": "assistant", "content": raw},
        {"role": "system", "content": "Твой ответ не в нужном формате. " + FORMAT_HINT},
    ]
    try:
        return _parse(company, llm.chat(retry))
    except (ValueError, ValidationError):
        return SellerOutput(reply=FALLBACK_REPLY, wants_human=True)
