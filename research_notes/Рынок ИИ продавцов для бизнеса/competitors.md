# Конкурентная карта: ИИ-продавцы / ИИ-чат-боты для МСБ в России и СНГ (2025–2026)

> Дата сбора: 21.10.2026. Методологическая оговорка: прямая загрузка российских сайтов (.ru, vc.ru и др.) из исследовательской среды была заблокирована прокси, поэтому все данные получены через выдачу поискового движка (сниппеты и краткие выжимки страниц), а не через полное чтение страниц. Цены — по состоянию на дату источника. Многие источники являются маркетингом вендоров или партнёрскими обзорами (Albato сам участвует в рейтингах, botseller пишет о себе и т.д.). Цифры, расходящиеся между источниками, помечены.

## 1. Что такое Главбот (ГлавБот, GlavBot)

### Takeaway
«ГлавБот AI» (сайт glav-bot.ru, НЕ glavbot.ru) — ранняя стадия (pre-seed/seed) российская платформа «AI-менеджера первой линии»: бот обучается на материалах компании (парсинг сайта, FAQ, документы), отвечает клиентам 24/7 по базе знаний, квалифицирует лидов, передаёт заявки в CRM и сложные обращения — оператору. Публичных цен, списка каналов и независимых отзывов найти не удалось.

### Cited Findings
- Официальный сайт позиционирует продукт как «AI-менеджер первой линии, который превращает входящие сообщения в заявки, продажи»; обещан запуск бота «за 5 минут» — [glav-bot.ru](https://glav-bot.ru/Article?id=leads-1)
- На сайте есть статья/лендинг про «Автоматический сбор и квалификацию лидов» — [ГлавБот AI](https://glav-bot.ru/Article?id=leads-1)
- Есть отраслевой лендинг для EdTech (онлайн-школы) — [glav-bot.ru/edtechlanding](https://glav-bot.ru/edtechlanding)
- Карточка Product Radar: «ГлавБот — главный по ботам. Умные AI-боты: меньше людей в саппорте, больше денег с каждого обращения»; платформа для автоматизации первой линии клиентского сервиса — [Product Radar](https://productradar.ru/product/glavbot-glavnyj-po-botam/)
- По карточке Product Radar: бот обучается на материалах компании, отвечает по базе знаний, собирает заявки и передаёт их в CRM, сложные обращения передаёт оператору; есть парсинг сайта, обучение на FAQ и документах, интеграции через API — [Product Radar](https://productradar.ru/product/glavbot-glavnyj-po-botam/)
- Там же: проект на стадии pre-seed/seed, ищет инвестиции порядка 10–25 млн ₽ (данные самой карточки, не проверены); указано наличие бесплатных опций — [Product Radar](https://productradar.ru/product/glavbot-glavnyj-po-botam/)

### Inferences
- Позиционирование «саппорт + продажи» (первая линия) ближе к Jivo ИИ-оператору / Suvvy / Nextbot, чем к конструкторам воронок (Salebot, BotHelp). Отраслевые лендинги (EdTech) указывают на вертикальную стратегию.
- Настройка ИИ, судя по описанию, — RAG поверх базы знаний (сайт/FAQ/документы) + промпт; глубина сценарной логики (follow-up, запись, оплата) неизвестна.
- Низкая узнаваемость: Главбот не упоминается ни в одном найденном рыночном обзоре 2026 (Albato, carrotquest, picktech, vc.ru-рейтинги), т.е. это нишевый игрок.

### Gaps
- Тарифы в рублях, список каналов (Telegram/VK/Авито/WhatsApp/MAX/виджет), конкретные CRM (amoCRM/Битрикс24/RetailCRM/YCLIENTS), используемая LLM, аналитика — не найдены (сайт не загрузился, в выдаче цен нет).
- Отзывы пользователей (otzovik, vc.ru, Telegram-чаты) о Главботе не найдены. Рекомендуется спросить у друга-пользователя или зайти на glav-bot.ru вручную.

## 2. Ключевые игроки РФ/СНГ: каналы, CRM, цены, ИИ

### Takeaway
Рынок делится на (а) конструкторы ботов с GPT-блоком (Salebot, BotHelp, PuzzleBot, Leadteh) — дёшево, но ИИ требует ручной настройки; (б) специализированные «ИИ-продавцы/ИИ-агенты» (Nextbot, Botseller, Suvvy, AvBot, Avitizer и десятки мелких) — от ~800 ₽/мес или 5–30 ₽ за диалог; (в) омниканальные агрегаторы/операторские платформы (Wazzup, Radist.Online, Chat2Desk, Umnico, Jivo, Teletype, Pact) — ИИ как надстройка или отдельный дорогой продукт (Jivo ИИ-оператор ~13 тыс. ₽/мес); (г) CRM со встроенным ИИ (amoCRM/Kommo «Амма»/AI-агент, Битрикс24 BitrixGPT); (д) LLM-вендоры и enterprise (GigaChat, YandexGPT/Alice AI, Just AI); (е) Авито с собственным ассистентом «Ави Pro» (аналитика, не автоответы).

### Cited Findings

**Обзорные данные рынка**
- Albato: в обзор вошли 17 решений, доступных в РФ на апрель 2026; в топ-10 — те, у кого есть готовые коннекторы к amoCRM или Битрикс24, кейсы и обозначенная цена. Самый дешёвый вход в мессенджеры — Salebot и Nextbot; enterprise с on-premise и 152-ФЗ — Just AI и GigaChat Business — [Albato](https://blog.albato.ru/ii-agenty-dlya-otdela-prodazh/) (Albato сам участник рынка)
- На Авито массово предлагают разработку ИИ-агентов: простые боты ~25 тыс. ₽, полный цикл с обучением и интеграцией в CRM — от 200 тыс. ₽ (ноябрь 2025) — [CNews](https://www.cnews.ru/news/top/2025-11-28_na_avito_stali_massovo)
- Заказная разработка: рабочий ИИ-агент с квалификацией лида, заполнением CRM — 300 000–1 500 000 ₽; простые FAQ-боты — 50 000–200 000 ₽ — [Habr](https://habr.com/ru/articles/1067438/)

**Salebot / SaleBot AI**
- Каналы: MAX, Telegram, VK, Авито, WhatsApp, Instagram, Viber — [salebot.pro](https://salebot.pro/); [Albato](https://blog.albato.ru/ii-agenty-dlya-otdela-prodazh/)
- Цены: бесплатный тариф 50 сообщений/сутки, «Бизнес» 2 999 ₽/мес, «Инфобиз» 3 999 ₽/мес — [Albato Telegram](https://blog.albato.ru/top-10-ii-agentov-dlya-telegram-v-2026-godu/); [carrotquest](https://www.carrotquest.io/blog/platforms-to-build-telegram-bot/); [Vakas](https://vakas.ru/articles/salebot-obzor/). Противоречие: каталог a2is указывает «от 599 ₽», другой обзор — «от 990 ₽/мес» — [a2is](https://a2is.ru/catalog/chat-boty/salebot); [rb.ru](https://rb.ru/reviews/nejroseti-na-russkom-alisa-ai-gigachat-i-drugie-zachem-biznesu-svoj-ii-v-2026-m/)
- Минус: ИИ-функции доделываются через ChatGPT API и требуют настройки — [Albato](https://blog.albato.ru/ii-agenty-dlya-otdela-prodazh/)
- Отзывы: 4,4 по 66 отзывам (сайт с партнёрскими ссылками) — [niksolovov.ru](https://niksolovov.ru/services/salebot); жалобы: новичкам легко перегрузить проект, при росте нагрузки упираются в тариф — [sheer.ru](https://sheer.ru/hub/salebot/)

**Jivo (JivoSite)**
- ИИ-оператор (агент продаж/поддержки, «до 80% обращений»): 12 990 ₽/мес помесячно; 12 332 ₽/мес при 3 мес.; 11 041 ₽/мес при 12 мес.; по обзору (на 05.08.2026) включено 2 000 диалогов — [jivo.ru/ai-agent](https://www.jivo.ru/ai-agent/); [checkroi](https://checkroi.ru/blog/jivosite-polnyy-obzor-vozmozhnostey/)
- ИИ-ассистент для менеджеров на базе GigaChat: +1 606 ₽/мес (год) / 1 890 ₽/мес (помесячно) — [jivo.ru/ai-assistant](https://www.jivo.ru/ai-assistant/)
- Есть отдельный ИИ-чат-бот для YCLIENTS (салоны красоты, онлайн-запись) — [jivo.ru/yclients-ai](https://www.jivo.ru/yclients-ai/)
- Тарифы чата: Базовая от 742 ₽, Профессиональная от 1 342 ₽, Корпоративная от 3 142 ₽ за оператора (при оплате на 2 года); бесплатный тариф (2 или 5 операторов — источники расходятся); 14 дней Pro — [zerocoder](https://ya.zerocoder.ru/samyj-populyarnyj-livechat-v-rossii-obzor-jivo/); [checkroi](https://checkroi.ru/blog/jivosite-polnyy-obzor-vozmozhnostey/)

**Wazzup**
- START 800 ₽/мес за канал со скидкой (1 000 ₽ без), включает CRM-интеграцию и до 100 диалогов/мес; по другому источнику — от 1 200 ₽/мес — [intellectdialog](https://intellectdialog.com/tpost/wazzup-otzyvy-sravnenie-intellectdialog); [picktech](https://picktech.ru/product/wazzup/)
- WABA 6 000 ₽/мес + шаблоны (маркетинговые ~9–13 ₽, сервисные ~5–6 ₽) — [intellectdialog](https://intellectdialog.com/tpost/wazzup-otzyvy-sravnenie-intellectdialog)
- Интеграции: amoCRM, Битрикс24, Мегаплан и др. — [acp-24](https://acp-24.ru/wazzup)
- Собственный ИИ-агент Wazzup и интеграция с Авито в найденных источниках не подтверждены.

**Radist.Online**
- Начальный от 1 000 ₽/мес за канал, Стандартный от 4 000 ₽/мес (безлимит, рассылки); тест 3 дня — [radist.online/price](https://radist.online/price/); [Vakas](https://vakas.ru/articles/radist-online-obzor/)
- ИИ подключается через внешний API (ChatGPT ~5–15 ₽/1000 токенов, YandexGPT дешевле); вендор оценивает 3 000–10 000 ₽/мес для магазина со 100–500 диалогами/день — [radist.online](https://radist.online/article/neural-network-business/)
- WABA от 5 000 ₽/мес за номер, шаблон ~8,98 ₽ — [radist.online/price](https://radist.online/price/)

**Chat2Desk**
- Официально: Базовый 5 000 ₽, Стандартный 9 000 ₽, Профессиональный 15 000 ₽/мес + лицензии операторов + доп. услуги — [chat2desk.com](https://chat2desk.com/baza-znanij/billing/tarifyi-chat2desk)
- Обзор (на 02.10.2026): от 6 000 ₽/мес, диалог сверх пакета 2,5 ₽; ИИ не из коробки — [picktech](https://picktech.ru/product/chat2desk/); [picktech Авито](https://picktech.ru/blog/tips/avtootvety-na-avito-kak-nastroit/)

**Umnico**
- 2 000 ₽/мес; отдельного ИИ-агента для Авито на странице интеграции нет — [picktech](https://picktech.ru/blog/tips/avtootvety-na-avito-kak-nastroit/)

**Teletype, Pact (агрегаторы)**
- Teletype от 2 490 ₽/мес, AI-ассистент, интеграция Avito; Pact от 1 000 ₽/мес, «нейросотрудник», сводит Telegram/Авито в CRM — [toolfox](https://toolfox.ru/services/korporativnye-messendzhery/agregatory-messendzherov)

**BotHelp**
- От 1 599 ₽/мес, 150 000 ИИ-токенов включено; докупка от 499 ₽ за 5 млн до 7 999 ₽ за 40 млн токенов; тарификация по числу подписчиков; триал 14 дней — [vc.ru](https://vc.ru/ai/3053133-chat-boty-gpt-dlya-malogo-biznesa); [carrotquest](https://www.carrotquest.io/blog/platforms-to-build-telegram-bot/). Другой обзор: от 1 290 ₽.
- Интеграция с amoCRM: создание контактов/сделок из мессенджеров — [bothelp.io](https://bothelp.io/ru/amocrm)

**PuzzleBot**
- Бесплатно: 1 проект, 150 подписчиков; платно от 990 ₽ (Standard 990, Pro 1 690, Max 2 990 ₽/мес); другие источники — 792 / 630 / 490 ₽ — [carrotquest](https://www.carrotquest.io/blog/platforms-to-build-telegram-bot/); [vc.ru](https://vc.ru/ai/3053133-chat-boty-gpt-dlya-malogo-biznesa); [Albato](https://blog.albato.ru/top-10-ii-agentov-dlya-telegram-v-2026-godu/)
- Каналы: Telegram и MAX; Авито не поддерживает — [Albato](https://blog.albato.ru/top-10-ii-agentov-dlya-telegram-v-2026-godu/)

**Leadteh**
- От 1 390 ₽, триал 7 дней, ИИ поддерживается; сильнее в лид-механиках (квизы, лид-формы), как универсальная бот-платформа уступает — [carrotquest](https://www.carrotquest.io/blog/platforms-to-build-telegram-bot/); [in-scale](https://in-scale.ru/service/leadteh/)

**Nextbot**
- Официально: Премиум 4 800 ₽/мес, «Всё включено» 19 000 ₽/мес; обзоры называют «Бизнес» 2 900 ₽ и «Премиум» 4 000 ₽ (14 дней триала) — расхождение — [nextbot.ru](http://nextbot.ru/tariffs/); [doc.nextbot.ru](https://doc.nextbot.ru/price/tariffs); [Albato](https://blog.albato.ru/top-10-ii-agentov-dlya-telegram-v-2026-godu/)
- Внутренняя валюта BotCoin (15 BotCoin/день за агента сверх лимита); WhatsApp и MAX не входят в базовые тарифы — [Albato](https://blog.albato.ru/ii-agenty-dlya-otdela-prodazh/); [doc.nextbot.ru](https://doc.nextbot.ru/price/tariffs)
- Отзывы 4,4: хвалят квалификацию лидов и связку с amoCRM; советуют заложить неделю на наполнение базы знаний — [sheer.ru](https://sheer.ru/hub/nextbot/)

**Botseller (botseller.ru / botseller.ai)**
- Оплата за диалог: от 5 ₽ (Low) до 30 ₽ (Ultra), 20 ₽ — High для сложных B2B; 7 дней теста без карты — [botseller.ai](https://botseller.ai/blog/telegram-bot-dlya-prodazh); [Albato](https://blog.albato.ru/top-10-ii-agentov-dlya-telegram-v-2026-godu/)
- Каналы: заявлено ~15 (Telegram, MAX, Авито, VK, Instagram, WhatsApp, виджет и др.); Авито подключается без абонентской платы — [botseller.ai/docs/channels/avito](https://botseller.ai/docs/channels/avito)
- CRM: amoCRM, Битрикс24, Kommo «в два клика», есть встроенная бесплатная CRM; квалификация по BANT (данные вендора) — [botseller.ai](https://botseller.ai/blog/kommo-crm-ii-bot-integraciya)
- Тестовый чат, работающий с реальным промптом и базой знаний, без отправки клиентам и записи в CRM — [botseller.ai](https://botseller.ai/blog/nastrojka-ii-bota-testirovanie-prompta)

**Suvvy**
- Pay-as-you-go: ~$0,07 за простой диалог; по другому обзору ~5 000 ₽/мес за 500 обращений; бонус 500 ₽ на тесты; заявлено >80% закрытых обращений (данные вендора) — [automata.sale](https://automata.sale/blog/ai-automation/suvvy-ai-platform-review/); [Albato Битрикс24](https://blog.albato.ru/ii-agenty-dlya-bitriks24/); [Albato Telegram](https://blog.albato.ru/top-10-ii-agentov-dlya-telegram-v-2026-godu/)

**Нишевые «ИИ-продавцы» для Авито**
- AvBot: Авито-чаты в Telegram/MAX, тарифы 799 / 1 499 / 2 499 ₽/мес (разница — число аккаунтов Авито и ИИ-ассистентов) — [avbot.ru](https://avbot.ru/landing/)
- Avitizer: ответ покупателю до 10 секунд 24/7, пилот 3 дня бесплатно — [avitizer.ru](https://avitizer.ru/)
- Также: Intly, Neurooffice «Авитолог» (через официальный API Авито), Riabot, AvChat, BotMan — [intly](https://intly.ru/integrations/avito); [neurooffice](https://neurooffice.ai/modules/catalog/69b70c3c0659d7f896ebbd7c); [riabot](https://riabot.ru/integrations/ii-chat-bot-dlya-avito); [avchat](https://avchat.ru/)
- Прочие «ИИ-продавцы» в выдаче: LampaBot, IPT AI, Wikibot, SmartBotPro, aibotmanager — [lampabot](https://lampabot.ru/); [ipt-ai](https://ipt-ai.ru/sales); [wikibot](https://wikibot.pro/blog/ai-salebot); [smartbotpro](https://www.smartbotpro.ru/products/chat-boty-dlya-prodazh)

**amoCRM / Kommo**
- amoCRM: AI-агент только на Профессиональном, Enterprise, Enterprise Lite; токены 999 ₽ за 100 тыс. (часть включена); базовый от 599 ₽/польз./мес; «amoCRM для малого бизнеса» 999 ₽ за аккаунт со встроенной интеграцией MAX; на Амоконф 2026 представлен AI-агент «Амма» — [gnzs.ru](https://gnzs.ru/blog/amoconf2026); [flysk.ru](https://flysk.ru/blog/amocrm-2026-amma-relize-amokonf)
- Kommo (международная версия): Base $25, Advanced $35, Pro $45 за пользователя/мес; 750/1 250/2 250 AI-кредитов на пользователя; AI-агент ~15 кредитов на ответ; агент входит с Advanced; подписка от 6 мес. — [kommo.com](https://www.kommo.com/blog/kommo-ai-pricing/)

**Битрикс24 (CoPilot → BitrixGPT)**
- CoPilot переименован в BitrixGPT 5 (апрель 2026), собственная модель, инфраструктура в РФ; ИИ — в подписке «BitrixGPT + Маркетплейс»; бесплатно в пределах квоты (Pricing v2, июль 2026), сверх — баланс «вайбов» — [Albato](https://blog.albato.ru/ii-agenty-dlya-bitriks24/); [helpdesk.bitrix24.ru](https://helpdesk.bitrix24.ru/open/27018478/); [acp-24](https://acp-24.ru/baza-znaniy/ii-agenty-hermes-cowork-code-bitrix24/)
- Тарифы Б24: Базовый 2 490 ₽ (5 польз.), Стандартный 6 990 ₽, Профессиональный 13 990 ₽/мес — [vc.ru](https://vc.ru/growth/3030730-bitrix24-ili-amocrm-dlya-malogo-biznesa)

**Авито — собственный ассистент «Ави Pro»**
- С 1 июля 2026 открыт ~500 тыс. профессиональных продавцов после 6 мес. закрытого теста; анализ воронки по 50+ метрикам, генерация контента, рекомендации по продвижению, справка по базе знаний; автоответы покупателям в источниках НЕ заявлены — [CNews](https://www.cnews.ru/news/line/2026-07-01_polmilliona_professionalnyh); [brief24](https://brief24.ru/news/2026/7/1/288709); [sib.fm](https://sib.fm/news/2026/07/02/na-avito-otkryt-dostup-k-ii-assistentu-dlya-polumilliona-professionalnyh-prodavtsov)

**LLM-вендоры и enterprise**
- YandexGPT Lite 0,2 ₽/1000 токенов; Alice AI LLM 0,5 ₽ вход / 1,2 ₽ выход за 1000 (на 06.10.2026); GigaChat 2 Lite от 0,2 ₽/1000; с 01.09.2026 новым клиентам GigaChat API предлагается через Cloud.ru — [Vakas](https://vakas.ru/articles/gigachat-api-i-yandexgpt-api/); [geoscout](https://geoscout.pro/ru/blog/yandexgpt-dlya-biznesa)
- Just AI Agent Platform — enterprise, цена по запросу, модели GigaChat/YandexGPT; другой обзор Albato — «от 990 ₽/мес» (противоречие) — [Albato платформы](https://blog.albato.ru/rossijskie-platformy-dlya-ii-agentov-v-2026-top-10-s-czenami-i-sravneniem/)

### Inferences
- Ценовой «коридор» для МСБ: 800–5 000 ₽/мес за SaaS-ИИ-продавца либо 5–30 ₽ за диалог; верхний сегмент «под ключ» — Jivo ИИ-оператор (~13 тыс. ₽/мес) и интеграторы (25 тыс.–1,5 млн ₽ разово).
- Обязательный набор каналов 2026: Telegram + MAX + Авито + VK + виджет; WhatsApp/Instagram — с оговорками (ограничения в РФ, WABA дорогая). MAX стал новым стандартом (amoCRM, Salebot, Botseller, PuzzleBot, AvBot).
- Авито — самый «горячий» и фрагментированный канал: десятки мелких сервисов, а сам Авито пока не отвечает покупателям ИИ — окно возможностей, но с платформенным риском (Авито может выпустить автоответы).
- CRM-интеграция с amoCRM и Битрикс24 — входной билет (критерий Albato). YCLIENTS — ниша для записи (Jivo уже есть).

### Gaps
- Aimylogic (Just AI) — актуальные цены не найдены.
- Umnico, Wazzup — наличие собственных ИИ-агентов и их цены не подтверждены.
- «SaleBot AI» как отдельный продукт не идентифицирован (вероятно, речь о ИИ-функциях Salebot).
- Tilda/Taplink боты — данных не найдено (не искалось отдельно из-за лимита запросов).
- NeuroSales как бренд не найден; «нейропродавцами» себя называют botseller, ifabrique, berezovski.by и др.
- Используемые LLM у большинства SaaS не раскрыты (кроме Jivo—GigaChat, Битрикс—собственная, Salebot/Radist—ChatGPT API/YandexGPT).

## 3. Жалобы пользователей и болевые точки

### Takeaway
Независимых отзывов о конкретных ИИ-продавцах мало; основные жалобы — необходимость долгой ручной настройки базы знаний/промптов, рост цены с объёмом (токены, подписчики, диалоги), завышенные ожидания и провальные внедрения, риск блокировок на Авито, а также проблема ответственности за ошибки ИИ. Прямых задокументированных кейсов «бот выдумал цену» или «бан за ИИ-бота на Авито» не найдено.

### Cited Findings
- Кейс провала: компания вложила ~200 000 ₽ в ИИ-обзвон вместо менеджера, связали с CRM, загрузили базу — «ни одного клиента», «бесконечный подкаст из абсурдных разговоров» — [Т-Банк Секреты](https://secrets.tbank.ru/tehnologii/kak-provalilis-s-ii-v-prodajah/)
- vc.ru: «тарифы почти одинаковые, а вот ответ за ошибку — нет» — разные сервисы по-разному отвечают за ошибки GPT-бота — [vc.ru](https://vc.ru/ai/3053133-chat-boty-gpt-dlya-malogo-biznesa)
- Продавец ИИ-агентов на vc.ru описывает, как агент «уронил сайт» — ответственность на внедренце — [vc.ru](https://vc.ru/ai/3177655-kak-prodavets-ii-agentov-proveryaet-ikh-rabotu)
- Habr: провалы внедрения ИИ чаще управленческие, чем технологические — [Habr](https://habr.com/ru/articles/1027240/)
- Неверные ожидания: проблема не в лидах, а в первом диалоге — нет структуры, квалификации, следующего шага (источник — продавец решений) — [ifabrique](https://ifabrique.ru/blog/neyroassistent-oshibki-vnedreniya-i-pravila-zapuska)
- Нужно проверять, не придумывает ли бот цены, сроки и условия — [CompanionAI](https://companionai.ru/blog/kak-proverit-kachestvo-otvetov-ii-bota-pered-zapuskom/)
- Salebot: ИИ требует допиливания через API; при росте упираются в тариф — [Albato](https://blog.albato.ru/ii-agenty-dlya-otdela-prodazh/); [sheer.ru](https://sheer.ru/hub/salebot/)
- BotHelp: тарификация по подписчикам, «с ростом базы счёт заметно растёт» — [carrotquest](https://www.carrotquest.io/blog/platforms-to-build-telegram-bot/)
- Nextbot: неделя на наполнение базы знаний; для сложной настройки нужен интегратор — [sheer.ru](https://sheer.ru/hub/nextbot/); [pleep.app](https://pleep.app/ru/blog/ii-prodazhniki-sravnenie-2025)
- Авито: массовые блокировки продавцов (миллионы профилей за 2025, часть — ошибки антифрода), шаблонные ответы поддержки, теневой бан — [vc.ru](https://vc.ru/marketing/3057999-chto-delat-pri-blokirovke-akkaunta-na-avito); [Pikabu](https://pikabu.ru/story/avito_po_fantomnyim_zhalobam_konkurentov_massovo_blokiruet_akkauntyi_prostyikh_prodavtsov_12478175)
- Ограничения Telegram/WhatsApp в РФ — проверять доступность канала — [Albato Telegram](https://blog.albato.ru/top-10-ii-agentov-dlya-telegram-v-2026-godu/)
- Многие отзывы собраны на партнёрских сайтах, доверие ограничено — [niksolovov.ru](https://niksolovov.ru/services/salebot)

### Inferences
- Главные боли МСБ: (1) сложно и долго настроить так, чтобы бот не врал; (2) непредсказуемый счёт; (3) нет уверенности, что бот «продаёт», а не просто отвечает; (4) платформенные риски (Авито, WhatsApp). Продукт, решающий (1) и (3) через предзапусковую проверку, адресует незакрытую боль.
- Использование неофициальных интеграций с Авито (не через API) потенциально повышает риск блокировки — подтверждённых кейсов не найдено.

### Gaps
- Отзывы с otzovik/irecommend и из Telegram-чатов о конкретных ИИ-продавцах не найдены.
- Нет данных о жалобах на голосовые сообщения, запись, оплаты в ботах.

## 4. Дифференцирующие функции, которые работают

### Takeaway
В РФ ценятся: квалификация лидов с передачей в CRM, мультиканальность с MAX и Авито, отраслевые решения (YCLIENTS-запись, EdTech), оплата за диалог, тестовый чат и бесплатные пилоты. На Западе — pay-per-resolution, симуляционное тестирование и отчётность по «закрытым» обращениям.

### Cited Findings
- Квалификация лидов (BANT), переговоры о цене, автосоздание сделок в Kommo — [botseller.ai](https://botseller.ai/blog/kommo-crm-ii-bot-integraciya)
- Отраслевой ИИ-бот для записи через YCLIENTS — [Jivo](https://www.jivo.ru/yclients-ai/)
- Albato советует профильный отраслевой виджет «под ключ», если не хочется настраивать сценарий — [Albato](https://blog.albato.ru/ii-agenty-dlya-otdela-prodazh/)
- Leadteh силён квизами и лид-формами — [in-scale](https://in-scale.ru/service/leadteh/)
- Ответ на Авито за 10 секунд 24/7, бесплатный пилот — [avitizer.ru](https://avitizer.ru/)
- Поэтапный запуск: тесты командой → бета на 10% трафика → полный запуск; минимум 50 тест-сценариев, диалоги от 10 шагов — [aibotmanager](https://aibotmanager.ru/chek-list-ii-bot/)

### Inferences
- Авто-follow-up («дожим» молчащего клиента), голосовые и платежи в найденных материалах не выделены как явные дифференциаторы — возможное поле для отстройки (не подтверждено источниками).

### Gaps
- Данных о конверсионных эффектах конкретных функций (follow-up, голос) из независимых источников нет.

## 5. Западные аналоги: модели и цены

### Takeaway
Доминирует оплата за результат (per-resolution ~$0,90–1,50) или пакеты диалогов; сильные стороны — глубокая интеграция с хелпдеском/CRM, прозрачная метрика «решено ИИ», встроенное симуляционное тестирование.

### Cited Findings
- Intercom Fin: $0,99 за resolution, минимум 50 resolutions/мес (~$49,50), плюс места операторов ($29–139/место); 2 000 решений ≈ $1 980/мес — [alhena.ai](https://alhena.ai/blog/ai-chatbot-pricing-comparison/); [hay.chat](https://hay.chat/blog/intercom-pricing-2026/)
- Tidio Lyro: пакеты $39/мес за 50 диалогов до $289/мес за 500; 50 бесплатных Lyro-диалогов — [alhena.ai](https://alhena.ai/blog/ai-chatbot-pricing-ecommerce/); [happyfox](https://www.happyfox.com/compare/tidio-vs-intercom/)
- ManyChat: ~$15/мес (500 контактов) + ~$29/мес за AI-аддон (не подтверждено официальным прайсом) — [alhena.ai](https://alhena.ai/blog/ai-chatbot-pricing-comparison/)
- Gorgias AI Agent: $1,00 (помесячно) / $0,90 (годовой) за resolution, сверх пакета $1,50; каждое AI-решение считается и как тикет хелпдеска; Zendesk $1,50–2,00 за автоматическое решение — [ringly.io](https://www.ringly.io/blog/gorgias-ai-agent-pricing-per-resolution); [heeya.fr](https://heeya.fr/en/blog/per-resolution-ai-chatbot-pricing-explained)
- Kommo: AI-кредиты на пользователя, ~15 кредитов за ответ агента — [kommo.com](https://www.kommo.com/blog/kommo-ai-pricing/)

### Inferences
- Идеи для заимствования: оплата за успешный исход (заявка/запись/решение) вместо подписки; публичная метрика «% решено ИИ»; минимальный порог вместо фиксированной абонентки. В РФ ближе всего к этому Botseller (за диалог) и Suvvy (pay-as-you-go).

### Gaps
- Respond.io, Drift/Qualified, 11x, Air AI — цены не найдены в рамках лимита запросов.

## 6. Есть ли «симулятор/песочница» для тестирования стратегий бота на симулированных клиентах

### Takeaway
На Западе — да, это уже устоявшаяся категория (Intercom Fin, Decagon, ASAPP, LivePerson Syntrix, Retell, Mihu Simulator Studio). В РФ найдены только тестовые чаты (ручная проверка, например Botseller) и DIY-подход на Habr («ИИ-душнила» на LangGraph); готового продукта-симулятора с персонами клиентов у российских ИИ-продавцов для МСБ не обнаружено.

### Cited Findings
- ASAPP Simulation Agent: сценарии на естественном языке, оценённая панель результатов — [ASAPP](https://www.asapp.com/blog/prove-before-production-introducing-simulation-agent)
- LivePerson Syntrix: персоны клиентов («Busy Parent», «Skeptical Shopper») для оценки и обучения агентов — [LivePerson](https://www.liveperson.com/syntrix/)
- Retell AI: симуляция и пакетное тестирование агентов — [Retell AI](https://www.retellai.com/blog/retell-ai-introduces-simulation-and-batch-testing-for-ai-agents)
- Mihu Simulator Studio: персона звонит/пишет агенту как реальный клиент, голос и текст — [Mihu](https://mihu.ai/blog/simulator-studio)
- Decagon: агенты тестируются на тысячах симулированных диалогов перед каждым релизом — [Decagon](https://decagon.ai/glossary/what-is-ai-agent-testing)
- Intercom/Fin публикует гайд по тестированию агента до запуска — [fin.ai](https://fin.ai/learn/how-to-test-ai-agent-before-deployment)
- Есть препринт о симуляции для CX-агентов в масштабе 140M (только заголовок/аннотация) — [arXiv](https://arxiv.org/pdf/2609.30137)
- Habr: «Собираем „идеального душнилу“» — ИИ-агент, атакующий чат-бота (например, выманивая скидку), на LangGraph — [Habr](https://habr.com/ru/articles/946140/)
- Botseller: тестовый чат с реальным промптом и базой знаний без отправки клиентам — [botseller.ai](https://botseller.ai/blog/nastrojka-ii-bota-testirovanie-prompta)
- Рекомендации тестировать на реальных обращениях, коротких «Цена?», «дорого», опечатках — [Nextbot](https://nextbot.ru/blog/vnedrenie-ii-v-biznes/kak-nastroit-chat-bota-dlya-biznesa-chto-nuzhno-znat-pered-startom/); [CompanionAI](https://companionai.ru/blog/kak-proverit-kachestvo-otvetov-ii-bota-pered-zapuskom/)

### Inferences
- Симулятор «стратегий продаж» на синтетических клиентах для МСБ на русском языке — незанятая ниша в РФ/СНГ (по результатам поиска); западные решения ориентированы на enterprise/поддержку, а не на продажи МСБ в Авито/Telegram.

### Gaps
- Не проверено, есть ли симуляторы внутри Jivo, Just AI или BitrixGPT (в выдаче не встретились).
