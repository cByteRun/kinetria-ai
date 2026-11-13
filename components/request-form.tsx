'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { prepareDraft, submitRequest } from '../app/workspace/actions'
import { VoiceRecorder } from './voice-recorder'
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
  const expansion = useTranslations('productExpansion')
  const voice = useTranslations('voice')
  const ui = useTranslations('ui')

  const t = useTranslations('requestsMvp')
  const key = useRef<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const [mode, setMode] = useState('manual')
  const [message, setMessage] = useState('')
  const [chat, setChat] = useState<
    ({ text: string; user: boolean; audio?: string; blob?: Blob; transcribing?: boolean; voiceError?: boolean } | { key: string; user?: false })[]
  >([])
  const [voiceActive, setVoiceActive] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const audioUrls = useRef<string[]>([])
  const voiceRequest = useRef<AbortController | null>(null)
  useEffect(() => () => {
    voiceRequest.current?.abort()
    audioUrls.current.forEach(url => URL.revokeObjectURL(url))
  }, [])
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
    audioUrls.current.forEach(url => URL.revokeObjectURL(url))
    audioUrls.current = []
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

  function sendMessage(text = message.trim(), addBubble = true) {
    if (!text || isDrafting) return
    setAiError(undefined)
    const description = [draft.description, text]
      .filter(Boolean)
      .join('\n')
      .slice(0, 4000)
    setDraft((previous) => ({ ...previous, description }))
    setMessage('')
    if (addBubble) setChat((previous) => [...previous, { text, user: true }])
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
            kind: response.draft.kind === 'problem' ? 'problem' : 'idea',
            title: previous.title || response.draft.title,
            description: previous.description,
            category: previous.category || response.draft.category,
            proposal: previous.proposal || response.draft.proposal,
          }))
          setChat((previous) => [
            ...previous,
            {
              text: response.draft.title + (response.draft.proposal ? '\n' + response.draft.proposal : ''), user: false,
            },
          ])
        } else setAiError(response.error)
      } catch {
        setAiError('aiUnavailable')
      }
    })
  }

  async function sendVoice(blob: Blob, existingUrl?: string) {
    if (transcribing || isDrafting) return
    const audio = existingUrl || URL.createObjectURL(blob)
    if (!existingUrl) {
      audioUrls.current.push(audio)
      setChat(previous => [...previous, { user: true, text: '', audio, blob, transcribing: true }])
    } else setChat(previous => previous.map(item => item.user && item.audio === audio ? { ...item, transcribing: true, voiceError: false } : item))
    setTranscribing(true)
    const controller = new AbortController()
    voiceRequest.current = controller
    const timeout = setTimeout(() => controller.abort(), 30000)
    try {
      const form = new FormData()
      const extension = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
      form.set('audio', blob, 'voice.' + extension)
      const response = await fetch('/api/voice/transcribe', { method: 'POST', body: form, signal: controller.signal })
      const result: unknown = await response.json()
      if (!response.ok || !result || typeof result !== 'object' || !('text' in result) || typeof result.text !== 'string' || !result.text.trim()) throw new Error('Transcription failed')
      const text = result.text
      setChat(previous => previous.map(item => item.user && item.audio === audio ? { ...item, text, transcribing: false, voiceError: false } : item))
      sendMessage(text, false)
    } catch {
      setChat(previous => previous.map(item => item.user && item.audio === audio ? { ...item, transcribing: false, voiceError: true } : item))
    } finally {
      clearTimeout(timeout)
      setTranscribing(false)
      voiceRequest.current = null
    }
  }

  return (
    <div data-workspace-busy={isDrafting || transcribing || voiceActive || undefined}>
      <div className="crm-mode-tabs">
        <button disabled={isDrafting || transcribing || voiceActive} aria-pressed={mode === 'ai'} onClick={() => setMode('ai')}>
          {ui('withAi')}
        </button>
        <button
          disabled={isDrafting || transcribing || voiceActive}
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
                  {item.user && item.audio ? <div className="voice-message">
                    <audio controls src={item.audio} aria-label={voice('playback')} />
                    {item.text && <p>{item.text}</p>}
                    {item.transcribing && <span className="voice-status" role="status">{voice('transcribing')}</span>}
                    {item.voiceError && <><p className="voice-error" role="alert">{voice('transcriptionError')}</p>
                      <button type="button" className="button button-outline" disabled={transcribing || isDrafting || voiceActive} onClick={() => { if (item.blob) void sendVoice(item.blob, item.audio) }}>{voice('retry')}</button></>}
                  </div> : 'text' in item ? item.text : ui(item.key)}
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
                disabled={transcribing || isDrafting || voiceActive}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="crm-chat-controls">
                {message.trim() ? <button type="button" className="button button-primary" disabled={isDrafting || transcribing || voiceActive} onClick={() => sendMessage()}><Send size={15} />{ui('send')}</button> : <VoiceRecorder disabled={isDrafting || transcribing} onActiveChange={setVoiceActive} onSend={sendVoice} />}
                <button
                  className="button button-outline"
                  disabled={isDrafting || transcribing || voiceActive}
                  onClick={() =>
                    loadSample(
                      samples[Math.floor(Math.random() * samples.length)].id,
                    )
                  }
                >
                  {ui('randomExample')}
                </button>
                <select
                  disabled={isDrafting || transcribing || voiceActive}
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
          <fieldset disabled={isDrafting || transcribing || voiceActive || isSubmitting}>
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
                {requestKinds.filter(kind => kind !== 'praise').map((kind) => (
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
                    ) : (
                      <Lightbulb />
                    )}
                    {kind === 'idea'
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
            <label>{expansion('hint')}<input name="impactHint" maxLength={500}/><span className="form-hint">{expansion('hintHelp')}</span></label>
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
                audioUrls.current.forEach(url => URL.revokeObjectURL(url))
                audioUrls.current = []
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
