"""FastAPI-песочница: чат с ассистентом, заявки и запуск симуляций."""

from __future__ import annotations

import threading
import uuid
from pathlib import Path
from typing import Callable

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from salesai.company import load_company, load_variant
from salesai.crm import CRM
from salesai.llm.base import LLM, LLMError
from salesai.llm.factory import get_llm
from salesai.pipeline import Assistant, AssistantTurn
from salesai.sim.cli import save_report, simulate
from salesai.sim.personas import load_personas

STATIC = Path(__file__).parent / "static"


class MessageIn(BaseModel):
    text: str


class SimulationIn(BaseModel):
    personas: int = 30
    max_turns: int = 8
    variant: str | None = None


def create_app(
    company_path: str | Path = "companies/flower_shop",
    db_path: str = "data/sandbox.db",
    llm_factory: Callable[..., LLM] = get_llm,
    reports_dir: str | Path = "reports/sim",
) -> FastAPI:
    company_dir = Path(company_path)
    company = load_company(company_dir)
    variants_dir = company_dir / "variants"
    crm = CRM(db_path)
    app = FastAPI(title=f"Песочница «{company.name}»")
    simulations: dict[str, dict] = {}
    sim_lock = threading.Lock()

    def llm(role: str = "assistant") -> LLM:
        try:
            return llm_factory(role)
        except LLMError as e:
            raise HTTPException(status_code=503, detail=str(e)) from None

    def variants() -> list[dict]:
        return [{"file": p.name, "name": load_variant(p)[0]} for p in sorted(variants_dir.glob("*.json"))]

    @app.get("/", response_class=HTMLResponse)
    def index() -> str:
        return (STATIC / "index.html").read_text(encoding="utf-8").replace("{{COMPANY}}", company.name)

    @app.get("/api/status")
    def status() -> dict:
        try:
            name, error = llm_factory("assistant").name, None
        except LLMError as e:
            name, error = None, str(e)
        return {"company": company.name, "llm": name, "llm_error": error, "variants": variants()}

    @app.post("/api/dialogs")
    def new_dialog() -> dict:
        return {"dialog_id": crm.create_dialog("web")}

    @app.get("/api/dialogs/{dialog_id}")
    def get_dialog(dialog_id: str) -> dict:
        try:
            return crm.get_dialog(dialog_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="Диалог не найден") from None

    @app.post("/api/dialogs/{dialog_id}/messages")
    def send_message(dialog_id: str, body: MessageIn) -> AssistantTurn:
        if not body.text.strip():
            raise HTTPException(status_code=400, detail="Пустое сообщение")
        get_dialog(dialog_id)
        assistant = Assistant(company, llm("assistant"), crm)
        try:
            return assistant.handle(dialog_id, body.text)
        except LLMError as e:
            raise HTTPException(status_code=503, detail=str(e)) from None

    @app.get("/api/leads")
    def leads() -> list[dict]:
        out = crm.list_leads()
        for lead in out:
            lead["product_names"] = [p.name for i in lead["product_ids"] if (p := company.product(i))]
        return out

    @app.post("/api/simulations")
    def start_simulation(body: SimulationIn) -> dict:
        variant = None
        if body.variant:
            path = variants_dir / Path(body.variant).name
            if Path(body.variant).name != body.variant or not path.is_file():
                raise HTTPException(status_code=400, detail="Неизвестный вариант")
            variant = load_variant(path)
        llms = {role: llm(role) for role in ("assistant", "customer", "judge")}
        personas = load_personas(company_dir / "personas.json")[: max(1, min(body.personas, 100))]
        run_id = uuid.uuid4().hex[:12]
        total = len(personas) * (2 if variant else 1)
        state = {"status": "running", "progress": [0, total], "markdown": None, "error": None, "path": None}
        with sim_lock:
            simulations[run_id] = state

        def progress(done: int, total: int) -> None:
            state["progress"] = [done, total]

        def work() -> None:
            try:
                markdown, reports = simulate(
                    company, personas, llms, max_turns=max(1, min(body.max_turns, 20)), variant=variant, on_progress=progress
                )
                state["path"] = str(save_report(reports_dir, company.id, markdown, reports))
                state["markdown"] = markdown
                state["status"] = "done"
            except Exception as e:  # отчёт об ошибке вместо тихого падения фонового потока
                state["error"] = f"{type(e).__name__}: {e}"
                state["status"] = "error"

        threading.Thread(target=work, daemon=True).start()
        return {"run_id": run_id}

    @app.get("/api/simulations/{run_id}")
    def simulation_status(run_id: str) -> dict:
        state = simulations.get(run_id)
        if state is None:
            raise HTTPException(status_code=404, detail="Прогон не найден")
        return state

    return app


def __getattr__(name: str):
    # `uvicorn salesai.web.app:app` — приложение создаётся при первом обращении, а не при импорте модуля
    if name == "app":
        globals()["app"] = create_app()
        return globals()["app"]
    raise AttributeError(name)
