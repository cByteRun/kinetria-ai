'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { prepareDraft, submitRequest } from '../app/workspace/actions'
import { FileUpload } from './file-upload'
import { requestKinds, type Draft } from '../lib/requests'
import samples from '../lib/demo-requests.json'
import {
  Sparkles,
  Send,
  RotateCcw,
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
  const ui = useTranslations('ui')

  const t = useTranslations('requestsMvp')
  const key = useRef<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const [mode, setMode] = useState('manual')
  const [message, setMessage] = useState('')
  const [chat, setChat] = useState<
    ({ text: string; user: true } | { key: string; user?: false })[]
  >([])
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
        key: 'theExampleIsInTheCardCheckIts',
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
            key: 'descriptionAddedFillInTheSubjectAndSelect',
          },
        ])
        return
      }
      try {
        const response = await prepareDraft(description)
        if ('draft' in response) {
          setDraft((previous) => ({
            ...response.draft,
            title: previous.title || response.draft.title,
            description: previous.description,
            category: previous.category || response.draft.category,
            proposal: previous.proposal || response.draft.proposal,
          }))
          setChat((previous) => [
            ...previous,
            {
              key: 'theCardIsReadyReviewTheDescriptionCategory',
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
          {ui('withAi')}
        </button>
        <button
          aria-pressed={mode === 'manual'}
          onClick={() => setMode('manual')}
        >
          {ui('fillInManually')}
        </button>
      </div>
      <div className={mode === 'ai' ? 'crm-compose' : 'idea-form-layout'}>
        {mode === 'ai' && (
          <section className="crm-chat">
            <div className="crm-chat-head">
              <Sparkles size={20} />
              <div>
                <strong>{ui('idearouteAssistant')}</strong>
                <small style={{ display: 'block', marginTop: 4 }}>
                  {ui('preparingARequestDraft')}
                </small>
              </div>
            </div>
            <div className="crm-chat-body" aria-live="polite">
              <div className="crm-bubble">
                {ui('reportAProblemOrSuggestAnImprovementInclude')}
              </div>
              {chat.map((item, index) => (
                <div
                  key={index}
                  className={'crm-bubble' + (item.user ? ' user' : '')}
                >
                  {'text' in item ? item.text : ui(item.key)}
                </div>
              ))}
              {isDrafting && <small>{ui('preparingTheCard')}</small>}
              {aiError && <p role="alert">{t(aiError)}</p>}
            </div>
            <div className="crm-chat-compose">
              <textarea
                aria-label={ui('messageToTheAssistant')}
                placeholder={ui(
                  'forExampleISuggestSimplifyingEquipmentRequests',
                )}
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
                  {ui('send')}
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
                  {ui('randomExample')}
                </button>
                <select
                  aria-label={ui('datasetExample')}
                  value=""
                  onChange={(e) => loadSample(e.target.value)}
                >
                  <option value="">{ui('chooseFrom20Examples')}</option>
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
              <span className="step-token">01</span>
              {ui('chooseTheRequestTopic')}
            </div>
            <label>
              {ui('category2')}
              <select
                name="category"
                required
                value={draft.category}
                onChange={(e) => update('category', e.target.value)}
              >
                <option value="" disabled>
                  {ui('chooseACategory')}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="form-hint">
                {ui('theCategoryDeterminesRoutingToTheOwnerIf')}
              </span>
            </label>
            <div>
              <span className="form-label">{ui('requestType')}</span>
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
                      ? ui('positiveFeedback')
                      : kind === 'idea'
                        ? ui('suggestion')
                        : ui('problem')}
                  </label>
                ))}
              </div>
            </div>
            <div className="rule" />
            <div className="form-step">
              <span className="step-token">02</span>
              {ui('describeTheSituation')}
            </div>
            <label>
              {ui('shortSubject')}
              <input
                name="title"
                maxLength={120}
                required
                value={draft.title}
                placeholder={ui('forExampleRequiredFieldsInARequest')}
                onChange={(e) => update('title', e.target.value)}
              />
            </label>
            <label>
              {ui('whatHappenedOrWhatDoYouSuggest')}
              <textarea
                name="description"
                rows={5}
                maxLength={4000}
                required
                value={draft.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder={ui('describeWhatIsHappeningAndHowItAffects')}
              />
              <span className="form-hint">
                {ui('doNotIncludeCommercialTermsPersonalDataOr')}
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
                            title: previous.title || response.draft.title,
                            description: previous.description,
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
                  {isDrafting
                    ? ui('preparingTheCard')
                    : ui('helpMeDraftWithAi')}
                </button>
                {aiError && (
                  <p className="error" role="alert">
                    {t(aiError)}
                  </p>
                )}
              </div>
            )}
            <label>
              {ui('howThisCouldBeSolvedOptional')}
              <textarea
                name="proposal"
                rows={3}
                maxLength={2000}
                value={draft.proposal}
                onChange={(e) => update('proposal', e.target.value)}
                placeholder={ui('suggestANextStepOrImprovement')}
              />
            </label>
            <FileUpload files={files} onChange={setFiles} error={fileError} onError={setFileError} />
            <section className="idea-metadata">
              <h3 className="form-label">{ui('moreTagsAndSentiment')}</h3>
              <label>
                {ui('sentiment')}
                <select
                  name="sentiment"
                  value={draft.sentiment}
                  onChange={(e) => update('sentiment', Number(e.target.value))}
                >
                  {Array.from({ length: 11 }, (_, n) => (
                    <option key={n} value={n}>
                      {n}
                      {n === 5
                        ? ui('neutral2')
                        : n === 0
                          ? ui('negative2')
                          : n === 10
                            ? ui('positive2')
                            : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {ui('commaSeparatedTags')}
                <input
                  name="tags"
                  value={draft.tags.join(',')}
                  maxLength={400}
                  onChange={(e) => update('tags', e.target.value.split(','))}
                />
              </label>
            </section>
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
                {ui('fillInAnExample')}
              </button>
              <button
                className="btn primary"
                disabled={preview || isSubmitting || Boolean(fileError)}
              >
                {isSubmitting ? ui('submitting') : ui('submit')}
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
              }}
            >
              <RotateCcw size={14} />
              {ui('clearAndStartAgain')}
            </button>
          </fieldset>
        </form>
        {mode === 'manual' && (
          <aside className="ir-form-aside">
            <section className="card flow-preview">
              <h2>{ui('yourRouteToAnOutcome')}</h2>
              <p className="form-hint">
                {ui('seeWhereTheRequestWillGoBeforeYou')}
              </p>
              {[
                [
                  MessageSquareWarning,
                  ui('requestSubmission'),
                  categories.find((c) => c.id === draft.category)?.name ||
                    ui('chooseATopic'),
                ],
                [
                  GitBranch,
                  draft.category
                    ? routes[draft.category] || ui('fallbackQueue')
                    : ui('ownerAssignment'),
                  draft.category && !routes[draft.category]
                    ? ui('theAdministratorWillAssignAnOwner')
                    : ui('automaticallyByCategory'),
                ],
                [
                  Clock3,
                  ui('deadlineTracking'),
                  (categories.find((c) => c.id === draft.category)?.days
                    ? categories.find((c) => c.id === draft.category)?.days +
                      ui('days')
                    : '') + ui('theDeadlineWillAppearInTheRequestCard'),
                ],
                [
                  CircleCheck,
                  ui('decisionAndFeedback'),
                  ui('theResultInYourWorkspace'),
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
                <ShieldCheck size={17} /> {ui('whoCanSeeTheRequest')}
              </h2>
              <p className="form-hint">
                {ui('youTheOwnerTheAreaManagerAndThe')}
              </p>
              <p className="form-hint">
                {ui('submittedUnderYourNameTheRequestIsNot')}
              </p>
            </section>
            <div className="repeat-card">
              <h3>{ui('whatHappensAfterSubmission')}</h3>
              <p>{ui('youWillReceiveARequestNumberStatusComments')}</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
