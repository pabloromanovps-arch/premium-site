from salesai.agents.guard import extract_amounts, guard_check
from salesai.agents.seller import SellerOutput


def test_extract_amounts_variants():
    text = "2 500 р., 2500руб, 2 500₽, 1490 рублей"
    assert extract_amounts(text) == [2500, 2500, 2500, 1490]
    assert extract_amounts("15 роз и 3 часа") == []
    assert extract_amounts("всего 12 900 ₽") == [12900]


def test_guard_passes_catalog_price(shop):
    out = SellerOutput(reply="Розы красные, 15 шт. — 3 490 ₽, доставка по МКАД 490 руб.")
    v = guard_check(shop, out)
    assert v.action == "send" and v.issues == []


def test_guard_flags_invented_price(shop):
    v = guard_check(shop, SellerOutput(reply="Этот букет стоит 2 777 ₽."))
    assert v.action == "fix"
    assert any("2777" in i for i in v.issues)


def test_guard_allows_sum_of_recommended_plus_delivery(shop):
    out = SellerOutput(reply="Итого 3 980 ₽ с доставкой.", product_ids=["b01"])
    assert guard_check(shop, out).action == "send"
    out = SellerOutput(reply="Вместе выйдет 4 430 ₽, плюс доставка 490 ₽.", product_ids=["b01", "x04", "x01"])
    assert guard_check(shop, out).action == "send"
    out = SellerOutput(reply="20 букетов — 69 800 ₽.", product_ids=["b01"])
    assert guard_check(shop, out).action == "send"
    out = SellerOutput(reply="Со скидкой 10% по промокоду — 3 141 ₽.", product_ids=["b01"])
    assert guard_check(shop, out).action == "send"


def test_guard_allows_amounts_named_by_customer(shop):
    out = SellerOutput(reply="Под ваш бюджет 2 000 ₽ подойдёт «Альстромерии» за 1 990 ₽.")
    assert guard_check(shop, out).action == "fix"
    assert guard_check(shop, out, context="бюджет до 2000 руб").action == "send"


def test_guard_flags_unknown_discount(shop):
    v = guard_check(shop, SellerOutput(reply="Для вас скидка 25% на всё!"))
    assert v.action == "fix" and any("25%" in i for i in v.issues)
    assert guard_check(shop, SellerOutput(reply="По промокоду ПЕРВЫЙ скидка 10%.")).action == "send"
    assert guard_check(shop, SellerOutput(reply="Цветы 100% свежие.")).action == "send"


def test_guard_flags_long_reply_and_foreign_contacts(shop):
    assert guard_check(shop, SellerOutput(reply="а" * 1201)).action == "fix"
    v = guard_check(shop, SellerOutput(reply="Звоните +7 (999) 123-45-67 или пишите shop@mail.ru"))
    assert v.action == "fix" and len(v.issues) == 2
    ok = guard_check(shop, SellerOutput(reply="Записала ваш номер +7 916 111-22-33."), context="мой номер 89161112233")
    assert ok.action == "send"


def test_guard_escalates_empty_reply(shop):
    assert guard_check(shop, SellerOutput(reply="   ")).action == "escalate"


def test_guard_allows_discount_on_one_item(shop):
    from salesai.company import apply_variant

    v = apply_variant(shop, {"promos": [{"id": "s", "title": "−15% на второй букет", "description": "", "discount_percent": 15}]})
    # 3 490 + 2 790 − 15% от 2 790 (419) = 5 861
    out = SellerOutput(reply="Два букета со скидкой на второй — 5 861 ₽.", product_ids=["b01", "b10"])
    assert guard_check(v, out).action == "send"
