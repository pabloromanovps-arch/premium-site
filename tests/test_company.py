from pathlib import Path

from salesai.company import apply_variant, load_company

SHOP = Path(__file__).resolve().parents[1] / "companies" / "flower_shop"


def test_load_flower_shop():
    c = load_company(SHOP)
    bouquets = [p for p in c.products if p.category != "дополнительно"]
    extras = [p for p in c.products if p.category == "дополнительно"]
    assert len(bouquets) == 24 and len(extras) == 4
    assert all(p.price > 0 for p in c.products)
    assert len({p.id for p in c.products}) == len(c.products)
    assert min(p.price for p in bouquets) == 1490 and max(p.price for p in bouquets) == 12900


def test_all_amounts_contains_delivery_and_products():
    amounts = load_company(SHOP).all_amounts()
    assert {490, 990, 50, 1490, 5000, 150} <= amounts


def test_render_knowledge_mentions_every_product_and_price():
    c = load_company(SHOP)
    text = c.render_knowledge()
    for p in c.products:
        assert p.name in text and p.id in text
        assert f"{p.price} ₽" in text
    assert "ПЕРВЫЙ" in text and "8:00" in text and "22:00" in text
    assert "+50 ₽ за каждый км" in text
    assert "НЕТ В НАЛИЧИИ" in text


def test_apply_variant_replaces_promos_and_keeps_rest():
    c = load_company(SHOP)
    patch = {
        "promos": [{"id": "second", "title": "Второй букет −15%", "description": "…", "discount_percent": 15}],
        "delivery": {"standard": {"price": 390}},
    }
    v = apply_variant(c, patch)
    assert [p.id for p in v.promos] == ["second"]
    assert v.products == c.products
    assert v.delivery["standard"]["price"] == 390
    assert v.delivery["urgent"] == c.delivery["urgent"]
    assert c.delivery["standard"]["price"] == 490  # исходник не изменился
