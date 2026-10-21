import time

import pytest
from conftest import SHOP, seller_json
from fastapi.testclient import TestClient

from salesai.llm.base import LLMError
from salesai.llm.scripted import ScriptedLLM
from salesai.sim.judge import SCORE_KEYS
from salesai.web.app import create_app

LEAD = {"name": "Ира", "phone": "+79161112233", "product_ids": ["b09"]}
JUDGE = '{"scores": {' + ", ".join(f'"{k}": 4' for k in SCORE_KEYS) + '}, "problems": [], "summary": "ок", "recommendations": ["Совет"]}'


def no_llm(role="assistant"):
    raise LLMError("Модель не подключена: задайте GIGACHAT_AUTH_KEY")


@pytest.fixture
def make_client(tmp_path):
    def make(factory):
        app = create_app(company_path=SHOP, db_path=str(tmp_path / "db.sqlite"), llm_factory=factory, reports_dir=tmp_path / "reports")
        return TestClient(app)

    return make


def test_index_page(make_client):
    r = make_client(no_llm).get("/")
    assert r.status_code == 200 and "Лепесток" in r.text


def test_status_reports_missing_llm(make_client):
    data = make_client(no_llm).get("/api/status").json()
    assert data == {"company": "Лепесток", "llm": None, "llm_error": "Модель не подключена: задайте GIGACHAT_AUTH_KEY", "variants": [{"file": "promo_second_bouquet.json", "name": "Скидка 15% на второй букет"}]}


def test_chat_roundtrip_creates_lead(make_client):
    llm = ScriptedLLM([seller_json("Оформила «Утро в Провансе» за 3 990 ₽", ["b09"], LEAD)], name="fake")
    client = make_client(lambda role="assistant": llm)
    assert client.get("/api/status").json()["llm"] == "fake"
    dialog_id = client.post("/api/dialogs").json()["dialog_id"]
    r = client.post(f"/api/dialogs/{dialog_id}/messages", json={"text": "Беру, +79161112233"})
    assert r.status_code == 200
    assert r.json()["reply"].startswith("Оформила") and r.json()["lead_id"]
    leads = client.get("/api/leads").json()
    assert leads[0]["phone"] == "+79161112233" and leads[0]["product_names"] == ["Авторский «Утро в Провансе»"]
    dialog = client.get(f"/api/dialogs/{dialog_id}").json()
    assert [m["role"] for m in dialog["messages"]] == ["user", "assistant"]


def test_empty_message_400(make_client):
    client = make_client(lambda role="assistant": ScriptedLLM([]))
    dialog_id = client.post("/api/dialogs").json()["dialog_id"]
    assert client.post(f"/api/dialogs/{dialog_id}/messages", json={"text": "   "}).status_code == 400
    assert client.post("/api/dialogs/nope/messages", json={"text": "привет"}).status_code == 404


def test_long_message_truncated(make_client):
    llm = ScriptedLLM([seller_json("Ок")])
    client = make_client(lambda role="assistant": llm)
    dialog_id = client.post("/api/dialogs").json()["dialog_id"]
    assert client.post(f"/api/dialogs/{dialog_id}/messages", json={"text": "я" * 5000}).status_code == 200
    assert len(client.get(f"/api/dialogs/{dialog_id}").json()["messages"][0]["content"]) == 2000


def test_no_llm_returns_503(make_client):
    client = make_client(no_llm)
    dialog_id = client.post("/api/dialogs").json()["dialog_id"]
    r = client.post(f"/api/dialogs/{dialog_id}/messages", json={"text": "привет"})
    assert r.status_code == 503 and "Модель не подключена" in r.json()["detail"]
    assert client.post("/api/simulations", json={"personas": 2}).status_code == 503


def test_simulation_endpoint_runs_to_done(make_client, tmp_path):
    llms = {
        "assistant": ScriptedLLM(lambda m: seller_json("Есть розы за 3 490 ₽", ["b01"])),
        "customer": ScriptedLLM(lambda m: "Спасибо [КОНЕЦ]"),
        "judge": ScriptedLLM(lambda m: JUDGE),
    }
    client = make_client(lambda role="assistant": llms[role])
    run_id = client.post("/api/simulations", json={"personas": 2, "max_turns": 2, "variant": "promo_second_bouquet.json"}).json()["run_id"]
    for _ in range(100):
        data = client.get(f"/api/simulations/{run_id}").json()
        if data["status"] != "running":
            break
        time.sleep(0.05)
    assert data["status"] == "done", data
    assert data["progress"] == [4, 4]
    assert "## A vs B" in data["markdown"]
    assert list((tmp_path / "reports").glob("*.md"))
    assert client.get("/api/simulations/unknown").status_code == 404
    assert client.post("/api/simulations", json={"personas": 2, "variant": "../company.json"}).status_code == 400
