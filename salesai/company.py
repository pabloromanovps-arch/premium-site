"""Данные компании: каталог, доставка, правила, акции."""

from __future__ import annotations

import copy
import json
from pathlib import Path

from pydantic import BaseModel


class Product(BaseModel):
    id: str
    name: str
    price: int
    category: str
    description: str
    tags: list[str]
    in_stock: bool = True


class Promo(BaseModel):
    id: str
    title: str
    description: str
    discount_percent: int | None = None


class Company(BaseModel):
    id: str
    name: str
    description: str
    tone: str
    hours: str
    delivery: dict
    payment: list[str]
    policies: list[str]
    products: list[Product]
    promos: list[Promo]
    allowed_amounts: list[int] = []
    handoff: dict

    def product(self, product_id: str) -> Product | None:
        return next((p for p in self.products if p.id == product_id), None)

    def all_amounts(self) -> set[int]:
        """Все суммы, которые ассистенту разрешено называть."""
        amounts = {p.price for p in self.products} | set(self.allowed_amounts)

        def walk(node):
            if isinstance(node, bool):
                return
            if isinstance(node, int):
                amounts.add(node)
            elif isinstance(node, dict):
                for v in node.values():
                    walk(v)
            elif isinstance(node, list):
                for v in node:
                    walk(v)

        walk(self.delivery)
        return amounts

    def render_knowledge(self) -> str:
        lines = [f"Компания: {self.name}. {self.description}", f"Режим работы: {self.hours}", "", "КАТАЛОГ (id — название — цена — описание):"]
        for category in dict.fromkeys(p.category for p in self.products):
            lines.append(f"[{category}]")
            for p in self.products:
                if p.category == category:
                    stock = "" if p.in_stock else " — НЕТ В НАЛИЧИИ"
                    lines.append(f"- {p.id} — {p.name} — {p.price} ₽ — {p.description}{stock}")
        lines += ["", "ДОСТАВКА:"]
        for key, value in self.delivery.items():
            if isinstance(value, dict):
                details = ", ".join(_render_delivery_field(k, v) for k, v in value.items() if k != "title")
                lines.append(f"- {value.get('title', key)}: {details}")
            elif key == "free_from":
                lines.append(f"- Бесплатная доставка в пределах МКАД при заказе от {value} ₽")
            else:
                lines.append(f"- {value}")
        lines += ["", "ОПЛАТА: " + ", ".join(self.payment), "", "ПРАВИЛА:"]
        lines += [f"- {p}" for p in self.policies]
        lines += ["", "АКЦИИ:"]
        lines += [f"- {p.title}: {p.description}" for p in self.promos] or ["- Сейчас акций нет."]
        return "\n".join(lines)


def _render_delivery_field(key: str, value) -> str:
    if key == "price_per_km":
        return f"+{value} ₽ за каждый км"
    if key.startswith("price"):
        return f"{value} ₽"
    return str(value)


def load_company(path: str | Path) -> Company:
    path = Path(path)
    if path.is_dir():
        path = path / "company.json"
    return Company.model_validate(json.loads(path.read_text(encoding="utf-8")))


def load_variant(path: str | Path) -> tuple[str, dict]:
    """Файл варианта: {"name": "...", "description": "...", "patch": {...}}."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return data.get("name") or Path(path).stem, data["patch"]


def _merge(base, patch):
    if isinstance(base, dict) and isinstance(patch, dict):
        out = dict(base)
        for k, v in patch.items():
            out[k] = _merge(base.get(k), v) if k in base else copy.deepcopy(v)
        return out
    return copy.deepcopy(patch)


def apply_variant(company: Company, patch: dict) -> Company:
    """Глубокое слияние словарей; списки заменяются целиком."""
    return Company.model_validate(_merge(company.model_dump(), patch))
