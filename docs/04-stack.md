# 04 — Технологии и запуск

Для MVP выбраны Supabase Auth, PostgreSQL и Data API. SQL-миграции версионируют схему и политики доступа, а `supabase-js` отправляет запросы с JWT текущего пользователя. Оба кабинета работают с одной карточкой и историей.

| Слой | Выбор | Назначение |
|---|---|---|
| Веб и API приложения | Next.js App Router и TypeScript | Экраны, серверная проверка входных данных и действия с обращениями |
| Аутентификация | Supabase Auth, `@supabase/ssr` и `@supabase/supabase-js` | Вход по email и паролю для заранее созданных тестовых аккаунтов. Права определяются профилем и ролью в БД |
| Хранение | Supabase PostgreSQL, Data API и Row Level Security (RLS) | Запросы через HTTPS с publishable key и JWT пользователя. RLS ограничивает доступ к строкам и при прямом обращении к API |
| Миграции | SQL в `supabase/migrations/`, Supabase CLI | Версионируем таблицы, индексы, роли доступа, политики RLS и функции для атомарных изменений |
| AI-черновик | OpenAI Responses API, серверный `OPENAI_API_KEY` | Предлагает черновик из описания. Сервер проверяет поля и категорию, автор редактирует и подтверждает карточку |
| Вложения post-MVP | Приватный Supabase Storage | Тестовые файлы с проверкой доступа к обращению |
| Проверка | Браузерные сценарии и проверки прямого Data API | Контроль переходов, повторной отправки, доступа к чужой карточке и публикации итога |

[Supabase Auth для SSR](https://supabase.com/docs/guides/auth/server-side) · [Data API](https://supabase.com/docs/guides/api) · [API-ключи](https://supabase.com/docs/guides/getting-started/api-keys) · [Приватные бакеты](https://supabase.com/docs/guides/storage/buckets/fundamentals)

## Стартер и структура приложения

Одно Next.js-приложение использует SSR-подход из официального `with-supabase`. В `lib/supabase/` находятся клиенты для браузера и сервера, `proxy.ts` обновляет сессию. Лендинг и кабинеты — страницы App Router, вход и запись обращений — Server Actions. Supabase хранит профили, категории, карточки и события. [Исходники шаблона](https://github.com/vercel/next.js/tree/canary/examples/with-supabase)

Интерфейс локализован через `next-intl` без языковых префиксов в URL. Светлая и тёмная темы задаются общими CSS-стилями. Язык и тема сохраняются в cookie и применяются при серверной отрисовке.

Режим разработки без Supabase открывает предпросмотр интерфейса. Общий сценарий в двух сессиях использует подключённый проект Supabase.

## SQL-миграции и подготовка демо

1. При необходимости инициализировать конфигурацию CLI через `supabase init`. Миграции профилей, карточек, маршрутов и событий лежат в `supabase/migrations/`.
2. Привязать отдельный демопроект через `supabase link --project-ref <ref>`. Для актуальной версии CLI применить миграции через `supabase db push --remote`. Локальная проверка с `supabase start` и `supabase db reset` возможна при наличии Docker.
3. Подготовить тестовые аккаунты через `pnpm seed:demo`, затем загрузить маршруты и датасет из `supabase/demo-data.sql`.
4. Для AI-черновика задать `OPENAI_API_KEY` в окружении сервера и при необходимости переопределить `OPENAI_MODEL`. В запрос уходит только описание, выбранный язык и справочник категорий. Ручная подача доступна при отсутствии ключа.
5. Для приложения задать `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Ключ с повышенными правами допускается в отдельном серверном скрипте подготовки аккаунтов. Обычные запросы приложения выполняются с JWT текущего пользователя.
6. Запустить Next.js локально или разместить приложение с доступом к демопроекту Supabase. Проверить вход под каждой ролью, сохранение истории и прямые обращения к Data API. В README указать зависимости от Supabase и модели, способ настройки серверного ключа, ручной режим подачи и запись сценария.

Инструкция по запуску и проверке в двух сессиях находится в [README](../README.md). [Руководство Supabase по миграциям](https://supabase.com/docs/guides/deployment/database-migrations) · [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
