'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { prepareDraft, submitRequest } from '../app/workspace/actions'
import {
  requestKinds,
  type Draft,
} from '../lib/requests'
import samples from '../lib/demo-requests.json'
import {
  Sparkles,
  Send,
  RotateCcw,
  Paperclip,
  ArrowRight,
  MessageSquareWarning,
  Lightbulb,
  HeartHandshake,
  Route,
  Clock3,
  CircleCheck,
  ShieldCheck,
  GitBranch,
} from 'lucide-react'

const emptyDraft: Draft = {
  title: '',
  description: '',
  proposal: '',
  category: '',
  kind: 'idea',
  sentiment: 5,
  tags: [],
}

export function RequestForm({
  categories,
  aiEnabled,
  routes = {},
  preview = false,
}: {
  categories: { id: string; name: string; days?: number }[]
  aiEnabled: boolean
  routes?: Record<string, string>
  preview?: boolean
}) {
  const t = useTranslations('requestsMvp')
  const key = useRef<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState('manual')
  const [message, setMessage] = useState('')
  const [chat, setChat] = useState<{ text: string; user?: boolean }[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [aiError, setAiError] = useState<'invalid' | 'aiUnavailable'>()
  const [isDrafting, startDraft] = useTransition()
  const [result, submit, isSubmitting] = useActionState(
    async (_: unknown, form: FormData) => {
      key.current ??= crypto.randomUUID()
      form.set('key', key.current)
      form.delete('attachments')
      files.forEach((file) => form.append('attachments', file))
      return submitRequest(form)
    },
    null,
  )

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [field]: value }))
  }

  function loadSample(id: string) {
    const sample = samples.find((item) => item.id === id)
    if (!sample) return
    setDraft({
      ...emptyDraft,
      title: sample.title,
      description: sample.description,
      category: sample.category,
      kind: sample.kind === 'problem' ? 'problem' : 'idea',
    })
    setChat([
      { text: sample.description, user: true },
      {
        text: 'Пример добавлен в карточку. Проверьте категорию и получателя перед регистрацией.',
      },
    ])
  }

  function sendMessage() {
    const text = message.trim()
    if (!text) return
    setAiError(undefined)
    const description = [draft.description, text]
      .filter(Boolean)
      .join('\n')
      .slice(0, 4000)
    setDraft((previous) => ({ ...previous, description }))
    setMessage('')
    setChat((previous) => [...previous, { text, user: true }])
    startDraft(async () => {
      if (!aiEnabled) {
        setChat((previous) => [
          ...previous,
          {
            text: 'Описание добавлено. Заполните тему и выберите категорию в карточке справа. Для автоматического заполнения требуется подключение AI.',
          },
        ])
        return
      }
      try {
        const response = await prepareDraft(description)
        if ('draft' in response) {
          setDraft((previous) => ({
            ...response.draft,
            category: previous.category || response.draft.category,
            proposal: previous.proposal || response.draft.proposal,
          }))
          setChat((previous) => [
            ...previous,
            {
              text: 'Карточка подготовлена. Проверьте описание, категорию и получателя. После подтверждения обращение появится в реестре.',
            },
          ])
        } else setAiError(response.error)
      } catch {
        setAiError('aiUnavailable')
      }
    })
  }

  return (
    <div>
      <div className="crm-mode-tabs">
        <button aria-pressed={mode === 'ai'} onClick={() => setMode('ai')}>
          С помощью AI
        </button>
        <button
          aria-pressed={mode === 'manual'}
          onClick={() => setMode('manual')}
        >
          Заполнить вручную
        </button>
      </div>
      <div className={mode === 'ai' ? 'crm-compose' : 'idea-form-layout'}>
        {mode === 'ai' && (
          <section className="crm-chat">
            <div className="crm-chat-head">
              <Sparkles size={20} />
              <div>
                <strong>Помощник IdeaRoute</strong>
                <small style={{ display: 'block', marginTop: 4 }}>
                  Подготовка черновика обращения
                </small>
              </div>
            </div>
            <div className="crm-chat-body" aria-live="polite">
              <div className="crm-bubble">
                Расскажите о проблеме или предложите улучшение. Укажите
                категорию и предполагаемое решение, если оно есть.
              </div>
              {chat.map((item, index) => (
                <div
                  key={index}
                  className={'crm-bubble' + (item.user ? ' user' : '')}
                >
                  {item.text}
                </div>
              ))}
              {isDrafting && <small>Готовим карточку…</small>}
              {aiError && <p role="alert">{t(aiError)}</p>}
            </div>
            <div className="crm-chat-compose">
              <textarea
                aria-label="Сообщение помощнику"
                placeholder="Например, предлагаю упростить заявки на оборудование…"
                rows={3}
                maxLength={4000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="crm-chat-controls">
                <button
                  className="button button-primary"
                  disabled={isDrafting || !message.trim()}
                  onClick={sendMessage}
                >
                  <Send size={15} />
                  Отправить
                </button>
                <button
                  className="button button-outline"
                  disabled={isDrafting}
                  onClick={() =>
                    loadSample(
                      samples[Math.floor(Math.random() * samples.length)].id,
                    )
                  }
                >
                  Случайный пример
                </button>
                <select
                  aria-label="Пример из датасета"
                  value=""
                  onChange={(e) => loadSample(e.target.value)}
                >
                  <option value="">Выбрать из 20 примеров</option>
                  {samples.map((sample) => (
                    <option key={sample.id} value={sample.id}>
                      {sample.id} · {sample.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}
        <form
          action={submit}
          className="request-fields card form-card ir-request-form"
        >
          <fieldset disabled={isDrafting || isSubmitting}>
            <div className="form-step">
              <span className="step-token">01</span>Выберите тему обращения
            </div>
            <label>
              Категория *
              <select
                name="category"
                required
                value={draft.category}
                onChange={(e) => update('category', e.target.value)}
              >
                <option value="" disabled>
                  Выберите категорию
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="form-hint">
                От категории зависит маршрут к ответственному. Если не уверены,
                выберите «Другое».
              </span>
            </label>
            <div>
              <span className="form-label">Тип обращения</span>
              <div className="choice-grid">
                {requestKinds.map((kind) => (
                  <label className="choice" key={kind}>
                    <input
                      type="radio"
                      name="kind"
                      value={kind}
                      checked={draft.kind === kind}
                      onChange={() => update('kind', kind)}
                    />
                    {kind === 'problem' ? (
                      <MessageSquareWarning />
                    ) : kind === 'idea' ? (
                      <Lightbulb />
                    ) : (
                      <HeartHandshake />
                    )}
                    {kind === 'praise'
                      ? 'Положительный отзыв'
                      : kind === 'idea'
                        ? 'Предложение'
                        : 'Проблема'}
                  </label>
                ))}
              </div>
            </div>
            <div className="rule" />
            <div className="form-step">
              <span className="step-token">02</span>Опишите ситуацию
            </div>
            <label>
              Короткая тема *
              <input
                name="title"
                maxLength={120}
                required
                value={draft.title}
                placeholder="Например, обязательные параметры в заявке"
                onChange={(e) => update('title', e.target.value)}
              />
            </label>
            <label>
              Что произошло или что вы предлагаете? *
              <textarea
                name="description"
                rows={5}
                maxLength={4000}
                required
                value={draft.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Опишите ситуацию: что происходит и как влияет на работу"
              />
              <span className="form-hint">
                Не включайте коммерческие условия, персональные данные и другую
                закрытую информацию.
              </span>
            </label>
            {aiEnabled && mode === 'manual' && (
              <div>
                <button
                  type="button"
                  className="button button-outline"
                  disabled={!draft.description.trim()}
                  onClick={() =>
                    startDraft(async () => {
                      setAiError(undefined)
                      try {
                        const response = await prepareDraft(draft.description)
                        if ('draft' in response)
                          setDraft((previous) => ({
                            ...response.draft,
                            category:
                              previous.category || response.draft.category,
                            proposal:
                              previous.proposal || response.draft.proposal,
                          }))
                        else setAiError(response.error)
                      } catch {
                        setAiError('aiUnavailable')
                      }
                    })
                  }
                >
                  <Sparkles size={15} />
                  {isDrafting ? 'Готовим карточку…' : 'Помочь оформить с ИИ'}
                </button>
                {aiError && (
                  <p className="error" role="alert">
                    {t(aiError)}
                  </p>
                )}
              </div>
            )}
            <label>
              Как это можно решить · необязательно
              <textarea
                name="proposal"
                rows={3}
                maxLength={2000}
                value={draft.proposal}
                onChange={(e) => update('proposal', e.target.value)}
                placeholder="Предложите следующий шаг или улучшение"
              />
            </label>
            <div className="upload-zone">
              <Paperclip />
              <p>Добавьте материалы, если они помогут разобраться</p>
              <input
                ref={fileInput}
                name="attachments"
                type="file"
                multiple
                aria-label="Материалы обращения"
                onChange={(e) => {
                  const selected = Array.from(e.target.files || [])
                  if (
                    selected.length > 3 ||
                    selected.some((f) => f.size > 1048576 || f.size === 0)
                  ) {
                    setFileError(
                      'Выберите до 3 непустых файлов, не более 1 МБ каждый.',
                    )
                    setFiles([])
                    e.target.value = ''
                  } else {
                    setFileError('')
                    setFiles(selected)
                  }
                }}
              />
              <p className="form-hint">
                До 3 файлов · по 1 МБ каждый · доступны участникам обращения
              </p>
            </div>
            {fileError && (
              <p className="form-error" role="alert">
                {fileError}
              </p>
            )}
            {files.length > 0 && (
              <div className="attachments">
                {files.map((f, i) => (
                  <span className="attachment" key={i}>
                    <Paperclip />
                    {f.name}
                    <button
                      type="button"
                      aria-label={'Убрать ' + f.name}
                      onClick={() =>
                        setFiles((previous) =>
                          previous.filter((_, index) => index !== i),
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <details className="idea-metadata">
              <summary>Дополнительно: теги и тональность</summary>
              <label>
                Тональность
                <select
                  name="sentiment"
                  value={draft.sentiment}
                  onChange={(e) => update('sentiment', Number(e.target.value))}
                >
                  {Array.from({ length: 11 }, (_, n) => (
                    <option key={n} value={n}>
                      {n}
                      {n === 5
                        ? ' — нейтральная'
                        : n === 0
                          ? ' — негативная'
                          : n === 10
                            ? ' — позитивная'
                            : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Теги через запятую
                <input
                  name="tags"
                  value={draft.tags.join(',')}
                  maxLength={400}
                  onChange={(e) => update('tags', e.target.value.split(','))}
                />
              </label>
            </details>
            {result?.error && (
              <p className="form-error" role="alert">
                {t(result.error)}
              </p>
            )}
            <div className="ir-form-footer">
              <button
                type="button"
                className="btn"
                onClick={() => loadSample('A-001')}
              >
                Заполнить пример
              </button>
              <button
                className="btn primary"
                disabled={preview || isSubmitting || Boolean(fileError)}
              >
                {isSubmitting ? 'Регистрируем…' : 'Зарегистрировать'}
                <ArrowRight />
              </button>
            </div>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                setDraft(emptyDraft)
                setChat([])
                setMessage('')
                key.current = null
                setAiError(undefined)
                setFiles([])
                setFileError('')
                if (fileInput.current) fileInput.current.value = ''
              }}
            >
              <RotateCcw size={14} />
              Очистить и начать заново
            </button>
          </fieldset>
        </form>
        {mode === 'manual' && (
          <aside className="ir-form-aside">
            <section className="card flow-preview">
              <h2>Ваш маршрут к результату</h2>
              <p className="form-hint">
                До отправки понятно, куда попадёт обращение.
              </p>
              {[
                [
                  MessageSquareWarning,
                  'Регистрация обращения',
                  categories.find((c) => c.id === draft.category)?.name ||
                    'Выберите тему',
                ],
                [
                  GitBranch,
                  draft.category
                    ? routes[draft.category] || 'Резервная очередь'
                    : 'Назначение ответственного',
                  draft.category && !routes[draft.category]
                    ? 'Администратор назначит ответственного'
                    : 'Автоматически по категории',
                ],
                [
                  Clock3,
                  'Контроль срока',
                  (categories.find((c) => c.id === draft.category)?.days
                    ? categories.find((c) => c.id === draft.category)?.days +
                      ' дн. · '
                    : '') + 'Срок появится в карточке обращения',
                ],
                [
                  CircleCheck,
                  'Решение и обратная связь',
                  'Результат в вашем личном кабинете',
                ],
              ].map(([Icon, title, note], i) => {
                const I = Icon as typeof Route
                return (
                  <div className="v-step" key={i}>
                    <span className="v-step-icon">
                      <I />
                    </span>
                    <div>
                      <strong>{String(title)}</strong>
                      <p>{String(note)}</p>
                    </div>
                  </div>
                )
              })}
            </section>
            <section className="card detail-block">
              <h2>
                <ShieldCheck size={17} /> Кто увидит обращение
              </h2>
              <p className="form-hint">
                Вы, ответственный, руководитель направления и администратор
                системы.
              </p>
              <p className="form-hint">
                Подача от вашего имени. Обращение не публикуется для всех
                сотрудников.
              </p>
            </section>
            <div className="repeat-card">
              <h3>Что будет после отправки?</h3>
              <p>
                Вы получите номер обращения. Статус, комментарии и итог
                рассмотрения появятся в разделе «Мои обращения».
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
