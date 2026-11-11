# 04 — Технологии и запуск

| Слой | Выбор | Назначение |
|---|---|---|
| Веб и API приложения | Next.js App Router и TypeScript | Экраны, серверная проверка входных данных и действия с обращениями |
| Аутентификация | Supabase Auth, `@supabase/ssr` и `@supabase/supabase-js` | Вход по email и паролю для заранее созданных тестовых аккаунтов. Права определяются профилем и ролью в БД |
| Хранение | Supabase PostgreSQL, Data API и Row Level Security (RLS) | Запросы через HTTPS с publishable key и JWT пользователя. RLS ограничивает доступ к строкам и при прямом обращении к API |
| Миграции | SQL в `supabase/migrations/`, Supabase CLI | Версионируем таблицы, индексы, роли доступа, политики RLS и функции для атомарных изменений |
| Вложения post-MVP | Приватный Supabase Storage | Тестовые файлы с проверкой доступа к обращению |
| Проверка | Браузерные сценарии и проверки прямого Data API | Контроль переходов, повторной отправки, доступа к чужой карточке и публикации итога |

[Supabase Auth для SSR](https://supabase.com/docs/guides/auth/server-side) · [Data API](https://supabase.com/docs/guides/api) · [API-ключи](https://supabase.com/docs/guides/getting-started/api-keys) · [Приватные бакеты](https://supabase.com/docs/guides/storage/buckets/fundamentals)

## SQL-миграции и подготовка демо

1. Инициализировать каталог через `supabase init`. Создать первую миграцию через `supabase migration new initial_schema` и записать в неё схему и правила доступа.
2. Привязать отдельный демопроект через `supabase link --project-ref <ref>`. Для актуальной версии CLI применить миграции через `supabase db push --remote`. Локальная проверка с `supabase start` и `supabase db reset` возможна при наличии Docker.
3. Завести тестовые аккаунты через Supabase Auth и загрузить синтетический набор с профилями и ролями. Хранить SQL для схемы и инструкции по подготовке демо в репозитории. Зафиксировать версии CLI, рантайма и зависимостей при реализации.
4. Для приложения задать `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Ключ с повышенными правами допускается в отдельном серверном скрипте подготовки аккаунтов. Обычные запросы приложения выполняются с JWT текущего пользователя.
5. Запустить Next.js локально или разместить приложение с доступом к демопроекту Supabase. Проверить вход под каждой ролью, сохранение истории и прямые обращения к Data API. В README указать зависимость от Supabase и приложить запись сценария.

SQL-миграции меняют схему через CLI. Рабочие запросы приложения идут через Data API. Текущий репозиторий содержит спецификацию запуска. [Руководство Supabase по миграциям](https://supabase.com/docs/guides/deployment/database-migrations)
