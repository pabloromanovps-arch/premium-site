# Песочница и симулятор на вымышленном цветочном магазине — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Работающий контур этапов 0–1 (+ эскалация, мини-CRM и аналитика из этапа 3/5): веб-песочница, где можно поговорить с ИИ-ассистентом цветочного магазина, и симулятор, который прогоняет ИИ-покупателей и выдаёт отчёт Судьи, в том числе A/B двух вариантов.

**Architecture:** Python-пакет `salesai`. Один конвейер ассистента (Продавец → Контролёр → Диспетчер эскалации → CRM-клерк) используется и в песочнице, и в симуляторе. Модели подключаются через общий интерфейс `LLM` (GigaChat, YandexGPT; в тестах — `ScriptedLLM`). Данные магазина и персоны — JSON-файлы, хранилище — SQLite.

**Tech Stack:** Python 3.13, FastAPI + uvicorn, httpx, pydantic 2, sqlite3, pytest. Фронт — один статический HTML+JS без сборки.

**Spec:** `docs/superpowers/specs/2026-10-21-ai-agents-roadmap-design.md`

## Global Constraints

- Ни одной цены, скидки или срока, которых нет в данных компании: проверяет Контролёр детерминированно, не моделью.
- Провайдер выбирается переменной `LLM_PROVIDER` = `gigachat` | `yandex`. Ключи только из окружения: `GIGACHAT_AUTH_KEY` (+ необязательные `GIGACHAT_SCOPE`, по умолчанию `GIGACHAT_API_PERS`, и `GIGACHAT_CA_BUNDLE`), `YANDEX_API_KEY` + `YANDEX_FOLDER_ID`. Ключи никогда не пишутся в логи, отчёты и репозиторий.
- Без ключа приложение запускается и честно говорит «модель не подключена»; моковых «результатов симуляции» не показываем.
- Все тексты интерфейса и отчётов — на русском.
- Данные магазина вымышленные; никаких реальных ПДн в репозитории.
- Тесты не ходят в сеть: только `ScriptedLLM`.

## Review Focus

- Модель вернула не-JSON или JSON без нужных полей → ассистент не падает: одна повторная попытка, затем вежливый ответ-заглушка и эскалация (тест в Task 3).
- Цена записана как «2 500 р.», «2500руб», «2 500₽» → Контролёр распознаёт все варианты (тест в Task 3).
- Покупатель пишет пустое сообщение или 5 000 символов → ответ 400 в API / обрезка до 2 000 символов в конвейере (тест в Task 4 и Task 7).
- Персона не закончила диалог за `max_turns` → диалог закрывается со статусом `timeout`, Судья всё равно оценивает (тест в Task 5).
- Сеть к провайдеру недоступна посреди симуляции → диалог помечается `error`, остальные продолжаются, отчёт показывает число ошибок (тест в Task 6).

## File Structure

```
pyproject.toml                         зависимости, pytest-настройки
salesai/__init__.py
salesai/llm/base.py                    Message, LLM-протокол, LLMError, parse_json()
salesai/llm/scripted.py                ScriptedLLM для тестов
salesai/llm/gigachat.py                GigaChatLLM
salesai/llm/yandex.py                  YandexLLM
salesai/llm/factory.py                 get_llm()
salesai/company.py                     модели Company/Product/… и load_company()
salesai/agents/seller.py               Продавец (A1)
salesai/agents/guard.py                Контролёр (A2)
salesai/agents/handoff.py              Диспетчер эскалации (A3)
salesai/crm.py                         CRM-клерк (A4) + SQLite
salesai/pipeline.py                    Assistant — конвейер A1→A2→A3→A4
salesai/sim/personas.py                ИИ-покупатели (В1)
salesai/sim/judge.py                   Судья (В3)
salesai/sim/runner.py                  прогон, A/B (В2-мини)
salesai/sim/report.py                  сводка + Аналитик (A6) + Markdown
salesai/sim/cli.py                     python -m salesai.sim.cli
salesai/web/app.py                     FastAPI
salesai/web/static/index.html          песочница: чат, заявки, симуляция
companies/flower_shop/company.json     вымышленный магазин «Лепесток»
companies/flower_shop/personas.json    30 персон
companies/flower_shop/variants/promo_second_bouquet.json   пример A/B-варианта
tests/…                                по файлу на модуль
README.md                              как запустить
```

---

### Task 1: Каркас, интерфейс моделей, провайдеры

**Files:**
- Create: `pyproject.toml`, `salesai/__init__.py`, `salesai/llm/{__init__,base,scripted,gigachat,yandex,factory}.py`
- Test: `tests/test_llm.py`

**Interfaces:**
- Produces:
  - `Message = TypedDict("Message", {"role": Literal["system","user","assistant"], "content": str})`
  - `class LLM(Protocol): name: str; def chat(self, messages: list[Message], *, temperature: float = 0.3) -> str`
  - `class LLMError(RuntimeError)`
  - `parse_json(text: str) -> dict` — достаёт первый JSON-объект из текста (в т.ч. из ```json-блока); `ValueError`, если нет.
  - `ScriptedLLM(responses: list[str] | Callable[[list[Message]], str], name="scripted")`; `.calls: list[list[Message]]`; при исчерпании списка — `LLMError`.
  - `GigaChatLLM(auth_key, scope="GIGACHAT_API_PERS", model="GigaChat", ca_bundle=None, client: httpx.Client | None = None)` — OAuth `POST https://ngw.devices.sberbank.ru:9443/api/v2/oauth` (заголовки `Authorization: Basic {auth_key}`, `RqUID: uuid4`, тело `scope=…`), токен кешируется до `expires_at − 60 с`; чат `POST https://gigachat.devices.sberbank.ru/api/v1/chat/completions`, ответ `choices[0].message.content`.
  - `YandexLLM(api_key, folder_id, model="yandexgpt-lite", client=None)` — `POST https://llm.api.cloud.yandex.net/foundationModels/v1/completion`, `Authorization: Api-Key …`, `modelUri = gpt://{folder_id}/{model}/latest`, сообщения в поле `text`, ответ `result.alternatives[0].message.text`.
  - `get_llm(role: Literal["assistant","customer","judge"] = "assistant") -> LLM` — по `LLM_PROVIDER`; `LLMError("Модель не подключена: …")`, если нет ключа. Переопределение на роль: `LLM_PROVIDER_CUSTOMER`, `LLM_PROVIDER_JUDGE`.
  - Любая сетевая/HTTP-ошибка провайдеров → `LLMError` (текст без ключа).

- [ ] **Step 1: Тесты** `test_parse_json_plain`, `test_parse_json_fenced`, `test_parse_json_raises`, `test_scripted_returns_in_order_and_records_calls`, `test_scripted_exhausted_raises`, `test_gigachat_gets_token_then_chats` (httpx.MockTransport: первый запрос на `/api/v2/oauth` → `{"access_token":"t","expires_at": <ms через час>}`, второй — заголовок `Bearer t`, вернуть `{"choices":[{"message":{"content":"Привет"}}]}` → `"Привет"`; второй вызов `chat` не запрашивает токен повторно), `test_yandex_maps_roles_and_parses` (проверить `modelUri` и `text`), `test_provider_http_error_is_llmerror_without_key` (500 → `LLMError`, ключа нет в `str(e)`), `test_get_llm_without_key_raises`.
- [ ] **Step 2:** `pytest tests/test_llm.py -v` → FAIL (нет модулей).
- [ ] **Step 3:** Реализовать файлы выше; зависимости в `pyproject.toml`: `fastapi`, `uvicorn`, `httpx`, `pydantic>=2`, dev: `pytest`.
- [ ] **Step 4:** `pytest tests/test_llm.py -v` → PASS.
- [ ] **Step 5:** Commit `feat: LLM interface with GigaChat and YandexGPT providers`.

### Task 2: Вымышленная компания и её данные

**Files:**
- Create: `salesai/company.py`, `companies/flower_shop/company.json`
- Test: `tests/test_company.py`

**Interfaces:**
- Produces (pydantic):
  - `Product(id: str, name: str, price: int, category: str, description: str, tags: list[str], in_stock: bool = True)`
  - `Promo(id: str, title: str, description: str, discount_percent: int | None = None)`
  - `Company(id, name, description, tone: str, hours: str, delivery: dict, payment: list[str], policies: list[str], products: list[Product], promos: list[Promo], allowed_amounts: list[int] = [], handoff: dict)` где `handoff = {"large_order_rub": int, "keywords": list[str]}`
  - `Company.all_amounts() -> set[int]` — цены товаров ∪ цены доставки из `delivery` ∪ `allowed_amounts`.
  - `Company.render_knowledge() -> str` — весь каталог и правила одним текстом для системного промпта.
  - `load_company(path: str | Path) -> Company`; `apply_variant(company: Company, patch: dict) -> Company` — глубокое слияние словарей, списки заменяются целиком.
- Данные «Лепестка»: Москва, 24 букета от 1 490 до 12 900 ₽ (моно, авторские, в коробке, корзины, свадебные, траурные) + 4 доп. товара (открытка 150 ₽, шары, ваза, конфеты); доставка: по МКАД 490 ₽, бесплатно от 5 000 ₽, срочная за 2 часа 990 ₽, за МКАД +50 ₽/км (а значит `allowed_amounts` включает 50); приём заказов 24/7, сборка и доставка 8:00–22:00; оплата: карта, СБП, наличные курьеру; акция «−10% на первый заказ по промокоду ПЕРВЫЙ»; правила: фотография букета перед отправкой, замена цветка равноценным при отсутствии, возврат — только через менеджера; `handoff`: `large_order_rub=15000`, ключевые слова `["жалоба","возврат","верните деньги","директор","мошенники","суд","опоздали","завяли"]`.

- [ ] **Step 1: Тесты** `test_load_flower_shop` (24+4 товара, все цены > 0, id уникальны), `test_all_amounts_contains_delivery_and_products` (490, 990, 50, 1490 ∈), `test_render_knowledge_mentions_every_product_and_price`, `test_apply_variant_replaces_promos_and_keeps_rest`.
- [ ] **Step 2:** запуск → FAIL. **Step 3:** реализация + JSON. **Step 4:** PASS. **Step 5:** Commit `feat: fictional flower shop company data`.

### Task 3: Продавец (A1) и Контролёр (A2)

**Files:**
- Create: `salesai/agents/__init__.py`, `salesai/agents/seller.py`, `salesai/agents/guard.py`
- Test: `tests/test_seller.py`, `tests/test_guard.py`

**Interfaces:**
- Consumes: `LLM`, `parse_json`, `Company`.
- Produces:
  - `Lead(BaseModel): name: str | None; phone: str | None; product_ids: list[str] = []; delivery_date: str | None; address: str | None; comment: str | None` + `is_complete() -> bool` (есть телефон и хотя бы один товар).
  - `SellerOutput(BaseModel): reply: str; product_ids: list[str] = []; lead: Lead | None = None; wants_human: bool = False`
  - `seller_reply(llm: LLM, company: Company, history: list[Message], feedback: list[str] | None = None) -> SellerOutput` — системный промпт: роль, тон, `render_knowledge()`, правила («только цены из каталога», «не обещай того, чего нет в правилах», «собери имя, телефон, дату, адрес», «если просят человека или ситуация конфликтная — wants_human=true»), формат ответа — строго JSON. `feedback` добавляется отдельным system-сообщением «Исправь ответ: …». Невалидный JSON → одна повторная попытка с напоминанием формата → затем `SellerOutput(reply=FALLBACK_REPLY, wants_human=True)`, где `FALLBACK_REPLY = "Секунду, уточню у менеджера и вернусь с ответом."`. Неизвестные `product_ids` отбрасываются.
  - `GuardVerdict(BaseModel): action: Literal["send","fix","escalate"]; issues: list[str]`
  - `extract_amounts(text: str) -> list[int]` — суммы рядом с `₽ | руб | р.` в любых формах («2 500 р.», «2500руб», «2 500₽», «2 500 рублей»).
  - `guard_check(company: Company, out: SellerOutput) -> GuardVerdict` — правила: сумма не из `all_amounts()` и не равна сумме цен рекомендованных товаров (± доставка) → `fix` «Цена N ₽ отсутствует в каталоге»; процент скидки, не равный ни одному `discount_percent` акции → `fix`; ответ длиннее 1 200 символов → `fix`; телефон/email в ответе, которых нет в данных компании → `fix`; пустой ответ → `escalate`.

- [ ] **Step 1: Тесты Контролёра** `test_extract_amounts_variants` (`"2 500 р., 2500руб, 2 500₽, 1490 рублей"` → `[2500, 2500, 2500, 1490]`), `test_guard_passes_catalog_price`, `test_guard_flags_invented_price`, `test_guard_allows_sum_of_recommended_plus_delivery`, `test_guard_flags_unknown_discount` («скидка 25%» при акции 10% → fix), `test_guard_escalates_empty_reply`.
- [ ] **Step 2: Тесты Продавца** `test_seller_parses_json_and_drops_unknown_ids`, `test_seller_retries_once_on_bad_json` (ScriptedLLM: `"не json"`, затем валидный → 2 вызова), `test_seller_fallback_after_two_bad_json` (→ `wants_human=True`, `reply == FALLBACK_REPLY`), `test_seller_prompt_contains_catalog_and_feedback`.
- [ ] **Step 3:** запуск → FAIL. **Step 4:** реализация. **Step 5:** PASS. **Step 6:** Commit `feat: seller and guard agents`.

### Task 4: Эскалация (A3), CRM (A4), конвейер

**Files:**
- Create: `salesai/agents/handoff.py`, `salesai/crm.py`, `salesai/pipeline.py`
- Test: `tests/test_handoff.py`, `tests/test_crm.py`, `tests/test_pipeline.py`

**Interfaces:**
- Consumes: Task 1–3.
- Produces:
  - `handoff_reasons(company: Company, user_text: str, out: SellerOutput, verdict: GuardVerdict) -> list[str]` — пустой список = не эскалируем. Причины: `wants_human`, `verdict.action == "escalate"`, ключевое слово из `company.handoff["keywords"]` (регистр не важен), сумма товаров лида ≥ `large_order_rub`.
  - `handoff_summary(llm: LLM, company: Company, history: list[Message], reasons: list[str]) -> str` — 3–5 строк для менеджера; при `LLMError` — шаблонная сводка из последних 3 сообщений и причин.
  - `CRM(db_path: str = ":memory:")`: `create_dialog(channel: str, meta: dict | None = None) -> str` (uuid), `log_message(dialog_id, role, content, extra: dict | None = None)`, `get_history(dialog_id) -> list[Message]`, `upsert_lead(dialog_id, lead: Lead) -> int` (одна заявка на диалог, поля обновляются непустыми значениями), `get_lead(dialog_id) -> dict | None`, `list_leads(limit=100) -> list[dict]`, `mark_escalated(dialog_id, summary: str, reasons: list[str])`, `get_dialog(dialog_id) -> dict` (включает `escalated`, `summary`, `status`), `set_status(dialog_id, status: str)`.
  - `AssistantTurn(BaseModel): reply: str; product_ids: list[str]; escalated: bool; reasons: list[str]; summary: str | None; lead_id: int | None; guard_issues: list[str]; attempts: int`
  - `Assistant(company: Company, llm: LLM, crm: CRM)` с методом `handle(dialog_id: str, user_text: str) -> AssistantTurn`: обрезать `user_text` до 2 000 символов → лог → `seller_reply` → `guard_check`; при `fix` — до 2 повторов с `feedback=issues`; если всё ещё `fix` → ответ `FALLBACK_REPLY` и эскалация с причиной «Контролёр не пропустил ответ»; лид с данными → `upsert_lead`; причины эскалации → `handoff_summary` + `mark_escalated` (один раз на диалог); ответ логируется с `extra={"guard_issues":…, "attempts":…}`. Если диалог уже эскалирован, ассистент продолжает вежливо отвечать, но не создаёт повторную сводку.

- [ ] **Step 1: Тесты** `test_handoff_keyword_case_insensitive` («ЖАЛОБА»), `test_handoff_large_order`, `test_handoff_none_for_normal_message`, `test_summary_fallback_on_llm_error`, `test_crm_upsert_lead_merges_fields`, `test_crm_history_roundtrip`, `test_pipeline_happy_path_creates_lead` (ScriptedLLM-ответ с полным лидом → `lead_id` не None, `escalated is False`), `test_pipeline_retries_on_invented_price_then_sends` (1-й ответ с ценой 777 ₽, 2-й корректный → `attempts == 2`, `guard_issues` пусты в итоговом ответе), `test_pipeline_escalates_after_failed_retries`, `test_pipeline_truncates_long_input` (5 000 символов → в логе 2 000).
- [ ] **Step 2:** FAIL. **Step 3:** реализация. **Step 4:** PASS. **Step 5:** Commit `feat: handoff, mini-CRM and assistant pipeline`.

### Task 5: ИИ-покупатели (В1) и Судья (В3)

**Files:**
- Create: `salesai/sim/__init__.py`, `salesai/sim/personas.py`, `salesai/sim/judge.py`, `companies/flower_shop/personas.json`
- Test: `tests/test_personas.py`, `tests/test_judge.py`

**Interfaces:**
- Produces:
  - `Persona(BaseModel): id: str; name: str; profile: str; goal: str; behavior: str; should_buy: bool; should_escalate: bool = False; opening: str | None = None`
  - `load_personas(path) -> list[Persona]`
  - `END_TOKEN = "[КОНЕЦ]"`
  - `customer_message(llm: LLM, persona: Persona, company_name: str, history: list[Message]) -> str` — промпт: «ты покупатель, не ассистент; пиши коротко, как в мессенджере; не выдумывай, что ты бот; когда цель достигнута или ты передумал — допиши [КОНЕЦ]». В истории роли переворачиваются (ответы ассистента подаются как `user`). Первая реплика = `persona.opening`, если задана, без вызова модели.
  - `Verdict(BaseModel): persona_id: str; status: Literal["finished","timeout","error"]; lead_captured: bool; lead_complete: bool; escalated: bool; escalation_correct: bool; guard_retries: int; scores: dict[str, int]; problems: list[str]; summary: str`
  - `judge_dialog(llm: LLM, company: Company, persona: Persona, transcript: list[Message], facts: dict) -> Verdict` — `facts` (из CRM/конвейера: `lead_captured`, `lead_complete`, `escalated`, `guard_retries`, `status`) переносятся как есть, их Судья не переоценивает; `escalation_correct = (escalated == persona.should_escalate)`; модель ставит `scores` по шкале 1–5 для ключей `["понимание_запроса","точность","тон","продающая_сила","скорость_к_цели"]` + `problems` + `summary`; значения обрезаются в 1..5; при невалидном JSON/`LLMError` — `scores={}`, `problems=["Судья не смог оценить диалог"]`.
- 30 персон: 20 с `should_buy=true` (букет маме на день рождения, свадьба, «срочно за 2 часа», корпоратив 20 букетов на 18 000 ₽ — `should_escalate=true`, бюджет 2 000 ₽, «что подешевле», выбирает между двумя, хочет промокод, ночной заказ в 3:00, доставка за МКАД, траурный венок — деликатность, иностранец с ошибками, голосовой стиль без знаков препинания, …) и 10 с `should_buy=false` (просто спросить цены, конкурент «на разведке», тролль, жалоба «букет завял» — `should_escalate=true`, просит скидку 50%, спрашивает то, чего нет в магазине — тюльпаны в октябре нет в наличии, хочет поговорить с человеком — `should_escalate=true`, …).

- [ ] **Step 1: Тесты** `test_load_30_personas_unique_ids` (30, из них 20 `should_buy`), `test_customer_uses_opening_without_llm`, `test_customer_roles_are_flipped`, `test_judge_keeps_facts_and_clamps_scores` (модель вернула 9 → 5), `test_judge_escalation_correct`, `test_judge_fallback_on_bad_json`.
- [ ] **Step 2:** FAIL. **Step 3:** реализация + JSON. **Step 4:** PASS. **Step 5:** Commit `feat: simulated customers and judge`.

### Task 6: Прогон симуляции, A/B, отчёт и Аналитик (A6), CLI

**Files:**
- Create: `salesai/sim/runner.py`, `salesai/sim/report.py`, `salesai/sim/cli.py`, `companies/flower_shop/variants/promo_second_bouquet.json`
- Test: `tests/test_runner.py`, `tests/test_report.py`

**Interfaces:**
- Consumes: `Assistant`, `CRM`, `customer_message`, `judge_dialog`.
- Produces:
  - `run_dialog(company, persona, assistant_llm, customer_llm, judge_llm, crm, max_turns: int = 8) -> tuple[list[Message], Verdict]` — канал `"sim"`; цикл: реплика покупателя (без `END_TOKEN` в логе) → `Assistant.handle`; стоп по `END_TOKEN` (`finished`) или `max_turns` (`timeout`); любой `LLMError` → `status="error"` без падения; затем `judge_dialog`.
  - `SimReport(BaseModel): run_id: str; company_id: str; variant: str | None; started_at: str; verdicts: list[Verdict]; transcripts: dict[str, list[Message]]` + свойства `conversion` (доля `lead_captured` среди `should_buy`), `false_leads` (лиды у `should_buy=false` — не ошибка, считаем отдельно), `escalation_accuracy`, `avg_scores: dict[str, float]`, `errors: int`, `guard_retries_total`.
  - `run_simulation(company, personas, assistant_llm, customer_llm, judge_llm, *, max_turns=8, workers=4, variant_name: str | None = None, on_progress: Callable[[int,int],None] | None = None) -> SimReport` — `ThreadPoolExecutor(workers)`, своя `CRM(":memory:")` на прогон (thread-safe: `check_same_thread=False` + lock).
  - `analyze(llm: LLM, report: SimReport) -> list[str]` — Аналитик: 3–7 конкретных рекомендаций («добавить в базу ответ про…», «ассистент не спрашивает дату доставки») по `problems` и `summary` всех вердиктов; при `LLMError` → `[]`.
  - `render_markdown(report: SimReport, insights: list[str], baseline: SimReport | None = None) -> str` — разделы: «Итог» (конверсия, эскалации, ошибки цен, средние баллы), при `baseline` — таблица «A vs B» с разницей, «Что исправить» (insights), «Диалоги с проблемами» (персона, статус, проблемы, ссылка-якорь на расшифровку), «Расшифровки».
  - CLI: `python -m salesai.sim.cli --company companies/flower_shop --personas 30 --max-turns 8 [--variant companies/flower_shop/variants/promo_second_bouquet.json] [--out reports/sim]` — при `--variant` гонит A (база) и B (вариант) на одних персонах и пишет один отчёт с A/B; печатает путь к файлу; без ключа — понятная ошибка и код выхода 2.

- [ ] **Step 1: Тесты** `test_run_dialog_finishes_on_end_token`, `test_run_dialog_timeout`, `test_run_dialog_llm_error_marks_error` (ScriptedLLM бросает на 2-м ходу → `status=="error"`), `test_run_simulation_parallel_counts` (3 персоны, конверсия по `should_buy`), `test_report_markdown_has_sections_and_ab_table`, `test_cli_without_key_exits_2`.
- [ ] **Step 2:** FAIL. **Step 3:** реализация. **Step 4:** PASS. **Step 5:** Commit `feat: simulation runner, A/B report, analyst and CLI`.

### Task 7: Веб-песочница

**Files:**
- Create: `salesai/web/__init__.py`, `salesai/web/app.py`, `salesai/web/static/index.html`, `README.md` (переписать)
- Test: `tests/test_web.py`

**Interfaces:**
- Consumes: всё выше.
- Produces: `create_app(company_path="companies/flower_shop", db_path="data/sandbox.db", llm_factory=get_llm) -> FastAPI`
  - `GET /` — страница; `GET /api/status` → `{"company": name, "llm": name | null, "llm_error": str | null}`
  - `POST /api/dialogs` → `{"dialog_id"}`; `POST /api/dialogs/{id}/messages` `{text}` → `AssistantTurn` (пустой текст → 400; нет модели → 503 с понятным текстом)
  - `GET /api/leads` → заявки; `GET /api/dialogs/{id}` → диалог + история
  - `POST /api/simulations` `{personas: int = 30, max_turns: int = 8, variant: str | null}` → `{"run_id"}` (фоновый поток); `GET /api/simulations/{run_id}` → `{"status": "running"|"done"|"error", "progress": [done, total], "markdown": str | null}`; отчёт также сохраняется в `reports/sim/`.
  - Страница: слева чат с «Лепестком» (кнопка «Новый диалог»), справа вкладки «Заявки» (таблица, отметка эскалации и сводка) и «Симуляция» (число персон, выбор варианта A/B, кнопка «Запустить», прогресс, отчёт). Баннер сверху, если модель не подключена.
- README: как установить (`pip install -e .[dev]`), какие переменные окружения, как запустить песочницу (`uvicorn salesai.web.app:app --reload`) и CLI.

- [ ] **Step 1: Тесты** (FastAPI TestClient, `llm_factory` → ScriptedLLM) `test_status_reports_missing_llm`, `test_chat_roundtrip_creates_lead`, `test_empty_message_400`, `test_no_llm_returns_503`, `test_simulation_endpoint_runs_to_done` (2 персоны).
- [ ] **Step 2:** FAIL. **Step 3:** реализация. **Step 4:** PASS + `pytest -q` весь набор зелёный. **Step 5:** ручная проверка: `uvicorn` поднимается, `GET /` отдаёт страницу, баннер «модель не подключена» виден (скриншот через Playwright). **Step 6:** Commit `feat: web sandbox for chat, leads and simulations`.

---

## Не входит в этот план (следующие планы)

Сборщик базы знаний (Б1), Стилист тона (Б2), Дожим (A5), реальные каналы (Telegram, MAX, VK, Авито), amoCRM/Битрикс24, полноценный Режиссёр сценариев (В2: здесь только A/B по готовому варианту), авторизация и кабинет клиента.
