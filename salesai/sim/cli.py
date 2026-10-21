"""Запуск симуляции из командной строки.

python -m salesai.sim.cli --company companies/flower_shop --personas 30 --max-turns 8 \
    [--variant companies/flower_shop/variants/promo_second_bouquet.json] [--out reports/sim]
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

from salesai.company import apply_variant, load_company, load_variant
from salesai.llm.base import LLMError
from salesai.llm.factory import get_llm
from salesai.sim.personas import load_personas
from salesai.sim.report import SimReport, analyze, render_markdown
from salesai.sim.runner import run_simulation


def save_report(out_dir: str | Path, company_id: str, markdown: str, reports: list[SimReport]) -> Path:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    stem = f"{datetime.now():%Y-%m-%d-%H%M}-{company_id}-{reports[-1].run_id[:8]}"
    path = out / f"{stem}.md"
    path.write_text(markdown, encoding="utf-8")
    raw = "[\n" + ",\n".join(r.model_dump_json(indent=1) for r in reports) + "\n]\n"
    (out / f"{stem}.json").write_text(raw, encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Симуляция ИИ-покупателей для ассистента продаж")
    ap.add_argument("--company", default="companies/flower_shop")
    ap.add_argument("--personas", type=int, default=30, help="сколько персон из personas.json взять (по порядку)")
    ap.add_argument("--max-turns", type=int, default=8)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--variant", help="JSON-файл варианта для A/B")
    ap.add_argument("--out", default="reports/sim")
    args = ap.parse_args(argv)

    try:
        llms = {role: get_llm(role) for role in ("assistant", "customer", "judge")}
        llms["assistant"].chat([{"role": "user", "content": "Ответь одним словом: готов?"}], temperature=0)
    except LLMError as e:
        print(f"Ошибка: {e}", file=sys.stderr)
        return 2

    company = load_company(args.company)
    personas = load_personas(Path(args.company) / "personas.json")[: args.personas]

    def progress(label: str):
        return lambda done, total: print(f"[{label}] {done}/{total}", file=sys.stderr, flush=True)

    def run(c, label, variant_name=None) -> SimReport:
        return run_simulation(
            c, personas, llms["assistant"], llms["customer"], llms["judge"],
            max_turns=args.max_turns, workers=args.workers, variant_name=variant_name, on_progress=progress(label),
        )

    base = run(company, "A" if args.variant else "прогон")
    reports = [base]
    if args.variant:
        name, patch = load_variant(args.variant)
        variant = run(apply_variant(company, patch), "B", name)
        reports.append(variant)
        insights = [f"A: {x}" for x in analyze(llms["judge"], base)] + [f"B: {x}" for x in analyze(llms["judge"], variant)]
        markdown = render_markdown(variant, insights, baseline=base)
    else:
        markdown = render_markdown(base, analyze(llms["judge"], base))

    path = save_report(args.out, company.id, markdown, reports)
    print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
