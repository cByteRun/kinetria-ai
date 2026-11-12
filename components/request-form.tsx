'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { prepareDraft, submitRequest } from '../app/workspace/actions'
import { requestKinds, requestKindLabels, type Draft, type RequestKind } from '../lib/requests'
import samples from '../lib/demo-requests.json'
import { Sparkles, Send, RotateCcw } from 'lucide-react'

const emptyDraft: Draft = {
  title: '', description: '', proposal: '', category: '', kind: 'idea', sentiment: 5, tags: [],
}

export function RequestForm({ categories, aiEnabled, routes = {}, preview = false }: {
  categories: { id: string; name: string }[]
  aiEnabled: boolean
  routes?: Record<string, string>
  preview?: boolean
}) {
  const t = useTranslations('requestsMvp')
  const key = useRef<string | null>(null)
  const [mode, setMode] = useState('manual')
  const [message, setMessage] = useState('')
  const [chat, setChat] = useState<{ text: string; user?: boolean }[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [aiError, setAiError] = useState<'invalid' | 'aiUnavailable'>()
  const [isDrafting, startDraft] = useTransition()
  const [result, submit, isSubmitting] = useActionState(async (_: unknown, form: FormData) => {
    key.current ??= crypto.randomUUID()
    form.set('key', key.current)
    return submitRequest(form)
  }, null)

  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft(previous => ({ ...previous, [field]: value }))
  }

  function loadSample(id: string) {
    const sample = samples.find(item => item.id === id)
    if (!sample) return
    setDraft({ ...emptyDraft, title: sample.title, description: sample.description, category: sample.category,
      kind: sample.kind === 'problem' ? 'problem' : 'idea' })
    setChat([{ text: sample.description, user: true }, { text: 'Пример добавлен в карточку. Проверьте категорию и получателя перед регистрацией.' }])
  }

  function sendMessage() {
    const text = message.trim()
    if (!text) return
    setAiError(undefined)
    const description = [draft.description, text].filter(Boolean).join('\n').slice(0, 4000)
    setDraft(previous => ({ ...previous, description }))
    setMessage('')
    setChat(previous => [...previous, { text, user: true }])
    startDraft(async () => {
      if (!aiEnabled) {
        setChat(previous => [...previous, { text: 'Описание добавлено. Заполните тему и выберите категорию в карточке справа. Для автоматического заполнения требуется подключение AI.' }])
        return
      }
      try {
        const response = await prepareDraft(description)
        if ('draft' in response) {
          setDraft(previous => ({ ...response.draft, category: previous.category || response.draft.category, proposal: previous.proposal || response.draft.proposal }))
          setChat(previous => [...previous, { text: 'Карточка подготовлена. Проверьте описание, категорию и получателя. После подтверждения обращение появится в реестре.' }])
        } else setAiError(response.error)
      } catch { setAiError('aiUnavailable') }
    })
  }

  return (
    <div>
    <div className="crm-mode-tabs"><button aria-pressed={mode === 'ai'} onClick={() => setMode('ai')}>С помощью AI</button><button aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>Заполнить вручную</button></div>
    <div className={mode === 'ai' ? 'crm-compose' : 'idea-form-layout'}>
    {mode === 'ai' && <section className="crm-chat">
      <div className="crm-chat-head"><Sparkles size={20} /><div><strong>Помощник IdeaRoute</strong><small style={{ display: 'block', marginTop: 4 }}>Подготовка черновика обращения</small></div></div>
      <div className="crm-chat-body" aria-live="polite">
        <div className="crm-bubble">Расскажите о проблеме или предложите улучшение. Укажите категорию и предполагаемое решение, если оно есть.</div>
        {chat.map((item, index) => <div key={index} className={'crm-bubble' + (item.user ? ' user' : '')}>{item.text}</div>)}
        {isDrafting && <small>Готовим карточку…</small>}
        {aiError && <p role="alert">{t(aiError)}</p>}
      </div>
      <div className="crm-chat-compose">
        <textarea aria-label="Сообщение помощнику" placeholder="Например, предлагаю упростить заявки на оборудование…" rows={3} maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} />
        <div className="crm-chat-controls"><button className="button button-primary" disabled={isDrafting || !message.trim()} onClick={sendMessage}><Send size={15} />Отправить</button>
          <button className="button button-outline" disabled={isDrafting} onClick={() => loadSample(samples[Math.floor(Math.random() * samples.length)].id)}>Случайный пример</button>
          <select aria-label="Пример из датасета" value="" onChange={e => loadSample(e.target.value)}><option value="">Выбрать из 20 примеров</option>{samples.map(sample => <option key={sample.id} value={sample.id}>{sample.id} · {sample.title}</option>)}</select>
        </div>
      </div>
    </section>}
    <form action={submit} className="request-fields workspace-panel request-panel" style={{ margin: 0 }}>
      <h2>Что можно улучшить?</h2><p className="muted">Выберите категорию, опишите ситуацию и проверьте получателя. Предполагаемое решение — по желанию.</p>
      <div className="crm-routing-preview"><small>Будет направлено</small><br /><strong>{draft.category ? routes[draft.category] || 'Резервная очередь · администратор' : 'Выберите категорию обращения'}</strong></div>
      <fieldset disabled={isDrafting || isSubmitting}>
        <label>{t('category')}<select name="category" required value={draft.category}
          onChange={event => update('category', event.target.value)}>
          <option value="" disabled>{t('chooseCategory')}</option>
          {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select></label>
        <label>Тип обращения<select name="kind" value={draft.kind}
          onChange={event => update('kind', event.target.value as RequestKind)}>
          {requestKinds.map(kind => <option key={kind} value={kind}>{requestKindLabels[kind]}</option>)}
        </select></label>
        <label>{t('title')}<input name="title" maxLength={120} required value={draft.title}
          onChange={event => update('title', event.target.value)} /></label>
        <label>{t('description')}<textarea name="description" rows={5} maxLength={4000} required
          value={draft.description} onChange={event => update('description', event.target.value)} /></label>
        {aiEnabled && mode === 'manual' && <div>
          <button type="button" className="button button-outline" disabled={!draft.description.trim()}
            onClick={() => startDraft(async () => {
              setAiError(undefined)
              try {
                const response = await prepareDraft(draft.description)
                if ('draft' in response) {
                  setDraft(previous => ({ ...response.draft, category: previous.category || response.draft.category, proposal: previous.proposal || response.draft.proposal }))
                } else {
                  setAiError(response.error)
                }
              } catch {
                setAiError('aiUnavailable')
              }
            })}>
            {isDrafting ? t('drafting') : t('draftWithAi')}
          </button>
          <p className="muted">{t('aiHint')}</p>
          {aiError && <p className="error" role="alert">{t(aiError)}</p>}
        </div>}
        <label>{t('proposal')}<textarea name="proposal" rows={3} maxLength={2000}
          value={draft.proposal} onChange={event => update('proposal', event.target.value)} /></label>
        <details className="idea-metadata"><summary>Дополнительно: теги и тональность</summary>
        <label>Тональность<select name="sentiment" value={draft.sentiment}
          onChange={event => update('sentiment', Number(event.target.value))}>
          {Array.from({ length: 11 }, (_, score) => <option key={score} value={score}>
            {score}{score === 0 ? ' — негативная' : score === 5 ? ' — нейтральная' : score === 10 ? ' — позитивная' : ''}
          </option>)}
        </select></label>
        <label>Теги через запятую<input name="tags" value={draft.tags.join(',')} maxLength={400}
          onChange={event => update('tags', event.target.value.split(','))} /></label>
        </details>
        {result?.error && <p className="error" role="alert">{t(result.error)}</p>}
        <button className="button button-primary" disabled={preview}>{isSubmitting ? t('saving') : 'Зарегистрировать обращение'}</button>
        <button type="button" className="button button-outline" onClick={() => {
          setDraft(emptyDraft)
          setChat([]); setMessage(''); key.current = null; setAiError(undefined)
        }}><RotateCcw size={14} />Очистить и начать заново</button>
      </fieldset>
    </form>{mode === 'manual' && <aside className="idea-form-guide"><p className="idea-eyebrow">КАК ЭТО РАБОТАЕТ</p><h2>У обращения есть путь</h2><ol><li><strong>Опишите ситуацию</strong>Что происходит, где и как влияет на работу.</li><li><strong>Проверьте получателя</strong>Категория определяет маршрут рассмотрения.</li><li><strong>Следите за результатом</strong>Статус, уточнения и решение доступны в «Моих обращениях».</li></ol><p>Обращение подаётся от вашего имени. Его видят автор, ответственный, руководитель направления и администратор.</p><details className="idea-metadata"><summary>Попробовать пример из датасета</summary><select aria-label="Пример из датасета" value="" onChange={e => loadSample(e.target.value)}><option value="">Выберите пример</option>{samples.map(sample => <option key={sample.id} value={sample.id}>{sample.id} · {sample.title}</option>)}</select></details></aside>}
    </div></div>
  )
}
