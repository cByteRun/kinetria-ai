# Mobile-First · IdeaRoute · 13.11.2026

Локальная переработка интерфейса по [Business Vision](BUSINESS_VISION.md). Production не публиковался. Схема БД, RPC, серверные права и доменный цикл сохранены.

## Аудит и результат по шагам

| № | Сценарий | Найдено и исправлено | Проверка |
|---|---|---|---|
| 1 | Лендинг → вход → роль | Разные шапки; поздние стили лендинга выносили настройки во вторую строку. Один GlobalHeader, 56 px до 768 px, язык/тема/палитра и CTA внутри строки | Геометрия каждого контрола, 360/390/430, также 768/1440; демовходы пяти ролей |
| 2 | Кабинеты и навигация | Часть разделов отсутствовала в Tab Bar. До 1024 px sidebar полностью скрыт; четыре основных таба + «Ещё», native bottom dialog со всеми ссылками роли, профилем/сменой роли/выходом | Сравнение href каждого пункта sidebar и нижнего меню; Escape и возврат фокуса; safe-area и отступ контента |
| 3 | Реестр / канбан / карточка | Широкий канбан и конфликт порядка блоков Drawer. На телефоне вертикальные карточки, свайп-фильтры статусов, Drawer 100vw × 100dvh с закреплённой шапкой, метаданные → содержание/эффект/история → формы | Все рабочие роли, размеры Drawer, закрытие с сохранением режима доски; настоящий цикл уточнения/решения/ознакомления |
| 4 | Помощник подачи / Qvin | Узкие поля и управляющие блоки. Одна колонка, textarea 100%, touch controls ≥44 px, переносы длинного текста/файлов, вертикальные ответы и отдельные источники оценки эффекта | AI-черновик, файл с длинным именем, запись/отмена голоса, сохранение текста при смене языка; Qvin по одной отфильтрованной записи |
| 5 | Аналитика / темы / администрирование | Табличные и многоколоночные блоки. Карточки настроек, одноколоночные формы, KPI 1 колонка на телефоне / 2 на планшете; названия тем над барами | overview/registry/results/notifications/help/profile/new/analytics/insights/categories/routing с учётом роли |
| 6 | Клиент /feedback | Отдельная шапка без общего контракта. Теперь GlobalHeader, нижние ссылки «Лента / Подать / Кабинет», touch-формы и фильтры | Приватная подача → модерация отдельной публичной копии → ответ → поддержка; RU/EN/KK, обе темы |

Исходные скриншоты: [администратор до изменений](evidence/mobile-first/before-admin.png), [лендинг до изменений](evidence/mobile-first/before-landing.png). Принятые скриншоты просмотрены непосредственно в текущем прогоне: [лендинг после](evidence/mobile-first/accepted/01-landing.png), [Drawer после](evidence/mobile-first/accepted/02-drawer.png), [история](evidence/mobile-first/accepted/03-history.png), [все разделы](evidence/mobile-first/accepted/04-all-sections.png), [десктоп](evidence/mobile-first/accepted/05-desktop.png), [маршруты администратора](evidence/mobile-first/admin-routing.png), [AI-черновик](evidence/mobile-first/composer/draft-360.png). Артефакты evidence локальные и исключены из Git.

## Реализация

- `components/global-header.tsx` — общий server component, сохраняет клиентский Preferences и слоты рабочего поиска/профиля.
- `components/mobile-navigation.tsx` — нижнее native dialog-меню, закрытие по Escape, backdrop и переходу; desktop sidebar не используется как мобильная шторка.
- `app/mobile-first.css` — общая шапка и клиентский портал; `app/workspace/mobile-first.css` — адаптивные контракты кабинетов после прежних CSS. Устаревшие селекторы шапки в themes.css исключают GlobalHeader.
- `components/request-registry.tsx` — мобильные чипсы статусов и вертикальный канбан, без изменения серверных фильтров и прав.
- `components/impact-card.tsx` — отдельные карточки author / ai_scenario / unknown; число показано только у фактического источника. Прочерк означает отсутствие отдельной оценки, а не нулевой эффект.

## Проверки и доказательства

| Проверка | Результат |
|---|---|
| `check-mobile-first.mjs` | **274 проверки**, passed, errors=[]: публичные страницы, четыре внутренних кабинета, клиентский портал; 360/390/430/768/1024/1440 в применимых сценариях, отсутствие page overflow, геометрия шапки, меню, Drawer, темы и RU/EN/KK портала |
| Повтор после финального растяжения блоков Drawer | **74 проверки**, passed, errors=[]: сотрудник + клиент, публичные экраны; отдельный `final/report.json` |
| `check-mobile-workflow.mjs` → существующий `check-p0-browser.mjs` | **7 сквозных проверок**, passed, errors=[]: 390 px; три регистрации, файл, маршрутизация, назначение/срок, комментарий, ответственный → уточнение → автор → работа → решение → уведомление → скачивание файла → ознакомление |
| `check-product-browser.mjs`, TEST_VIEWPORT_WIDTH=390 | **9 проверок**, errors=[]: клиентский цикл, Qvin, эффект, изоляция публичной копии, сохранённая поддержка; 18 сочетаний темы/языка/контрольной ширины портала |
| `check-mobile-composer.mjs` | **5 проверок**, errors=[]: текст → AI → редактируемый черновик, вложение, голосовой player/черновик, язык без потери данных, отмена записи |
| `check-mobile-admin.mjs` | **5 проверок**, errors=[]: 360 px создание/редактирование категории, подача без маршрута, назначение из резерва, включение/выключение правила; Drawer также проверен на 390/430 px. Синтетическая категория архивирована |
| Финальный desktop smoke | Passed: 1024/1440 px, поле поиска ≥100 px, GET-поиск действительно передаёт `q`; обычные viewport-скриншоты карточки, истории, меню и десктопа просмотрены |
| TypeScript `--noEmit --noUnusedLocals`, i18n, `git diff --check` | Passed |
| `npm run build` | Passed вне sandbox; внутри sandbox компиляция прошла, но дочерний TypeScript --showConfig не был прочитан |

Отчёты: `docs/evidence/mobile-first/report.json`, `final/report.json`, `workflow/browser-report.json`, `composer/report.json`, `admin/report.json`, `docs/evidence/product-expansion/browser.json`.

## Повторить локально

Нужны подготовленная **изолированная локальная** Supabase с демоаккаунтами/миграциями по README, `.env.local` с демопаролем и установленный Playwright/Chromium. Никаких production-данных.

```sh
# SUPABASE_CLI можно задать абсолютным путём к установленному CLI.
node scripts/start-mobile-test.cjs
```

Скрипт получает локальные параметры через `supabase status -o json`, проверяет localhost, запускает Next на 3012 в `.next-mobile-test`, отключает Telegram и подключает `scripts/mobile-ai-provider.mjs`. Это детерминированная заглушка для UI, не проверка качества модели. Опциональный порт — `MOBILE_TEST_PORT`.

В другом терминале:

```sh
export P0_BASE_URL=http://localhost:3012
# Если Playwright вне node_modules проекта:
# export PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs
# export PLAYWRIGHT_EXECUTABLE_PATH=/absolute/path/to/chromium
node scripts/check-mobile-first.mjs
node scripts/check-mobile-composer.mjs
node scripts/check-mobile-workflow.mjs
node scripts/check-mobile-admin.mjs
PRODUCT_TEST_BASE_URL=$P0_BASE_URL TEST_VIEWPORT_WIDTH=390 node scripts/check-product-browser.mjs
```

Layout-тест не отправляет обращения. Workflow создаёт синтетические записи и временно назначает маршрут каталога руководителю; исходный маршрут восстанавливается в finally, неизвестный для восстановления маршрут останавливает тест. Клиентский E2E создаёт синтетический отзыв и его публичную копию в локальной БД. Сохраняемые ID перечислены в отчётах; тестовые записи не удаляются автоматически.

## Ограничения

Браузер — Chromium с эмуляцией размеров окна; реальные iOS/Android, экранная клавиатура и физические safe-area ещё требуют проверки. Голос записывается через MediaRecorder с fake device, расшифровка подменяется Playwright route. AI-черновик, Qvin и эффект используют тестовый провайдер; внешнее качество модели, Whisper, Telegram-доставка и redeploy этим не подтверждаются. Геометрические и сценарные проверки не означают полную сертификацию доступности.
