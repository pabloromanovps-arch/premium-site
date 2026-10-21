from salesai.agents.seller import Lead
from salesai.crm import CRM


def test_crm_history_roundtrip():
    crm = CRM()
    d = crm.create_dialog("web", {"ua": "test"})
    crm.log_message(d, "user", "Привет")
    crm.log_message(d, "assistant", "Здравствуйте", {"attempts": 1})
    assert crm.get_history(d) == [{"role": "user", "content": "Привет"}, {"role": "assistant", "content": "Здравствуйте"}]
    info = crm.get_dialog(d)
    assert info["channel"] == "web" and info["status"] == "open" and info["escalated"] is False
    assert info["messages"][1]["extra"] == {"attempts": 1}


def test_crm_upsert_lead_merges_fields():
    crm = CRM()
    d = crm.create_dialog("web")
    first = crm.upsert_lead(d, Lead(name="Ира", product_ids=["b01"]))
    second = crm.upsert_lead(d, Lead(phone="+79161112233", name=None, address="ул. Ленина, 1"))
    assert first == second
    lead = crm.get_lead(d)
    assert lead["name"] == "Ира" and lead["phone"] == "+79161112233"
    assert lead["product_ids"] == ["b01"] and lead["address"] == "ул. Ленина, 1"
    assert lead["complete"] is True
    assert [x["id"] for x in crm.list_leads()] == [first]


def test_crm_escalation_and_status():
    crm = CRM()
    d = crm.create_dialog("sim")
    crm.mark_escalated(d, "Сводка", ["жалоба"])
    crm.set_status(d, "finished")
    info = crm.get_dialog(d)
    assert info["escalated"] is True and info["summary"] == "Сводка" and info["reasons"] == ["жалоба"]
    assert info["status"] == "finished"
    assert crm.get_lead(d) is None
