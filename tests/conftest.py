import json
from pathlib import Path

import pytest

from salesai.company import load_company

ROOT = Path(__file__).resolve().parents[1]
SHOP = ROOT / "companies" / "flower_shop"


@pytest.fixture
def shop():
    return load_company(SHOP)


def seller_json(reply="Здравствуйте! Чем помочь?", product_ids=(), lead=None, wants_human=False) -> str:
    return json.dumps(
        {"reply": reply, "product_ids": list(product_ids), "lead": lead, "wants_human": wants_human},
        ensure_ascii=False,
    )
