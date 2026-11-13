'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Mic, Send, X } from 'lucide-react'

const maxBytes = 3 * 1024 * 1024
const maxSeconds = 120

export function VoiceRecorder({ disabled, onSend, onActiveChange }: {
  disabled: boolean; onActiveChange: (active: boolean) => void; onSend: (audio: Blob) => Promise<void>
}) {
  const t = useTranslations('voice')
  const [phase, setPhase] = useState<'idle' | 'permission' | 'recording' | 'ready'>('idle')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ blob: Blob; url: string }>()
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const mounted = useRef(false)
  const pendingPermission = useRef(false)
  const finish = useRef<'send' | 'preview' | 'cancel'>('cancel')
  const permissionVersion = useRef(0)
  const started = useRef(0)
  const previewUrl = useRef<string | undefined>(undefined)

  function release() { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null }
  function clearPreview() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    previewUrl.current = undefined
    setPreview(undefined)
  }
  useEffect(() => { onActiveChange(phase !== 'idle'); return () => onActiveChange(false) }, [phase, onActiveChange])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      finish.current = 'cancel'
      if (recorder.current?.state === 'recording') recorder.current.stop()
      stream.current?.getTracks().forEach(track => track.stop())
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    }
  }, [])
  useEffect(() => {
    if (phase !== 'recording') return
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started.current) / 1000)
      setSeconds(Math.min(elapsed, maxSeconds))
      if (elapsed >= maxSeconds && recorder.current?.state === 'recording') {
        finish.current = 'preview'
        recorder.current.stop()
        release()
      }
    }, 250)
    return () => clearInterval(timer)
  }, [phase])

  async function start() {
    if (disabled || pendingPermission.current || phase !== 'idle') return
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('unsupported'); return
    }
    const version = ++permissionVersion.current
    pendingPermission.current = true
    setPhase('permission')
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mounted.current || !pendingPermission.current || version !== permissionVersion.current) { audioStream.getTracks().forEach(track => track.stop()); return }
      stream.current = audioStream
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type))
      if (!mimeType) throw new Error('unsupported')
      const capture = new MediaRecorder(audioStream, { mimeType, audioBitsPerSecond: 64000 })
      recorder.current = capture
      const chunks: Blob[] = []
      let size = 0
      finish.current = 'preview'
      capture.ondataavailable = event => {
        size += event.data.size
        if (size > maxBytes) {
          finish.current = 'cancel'
          if (mounted.current) setError('tooLarge')
          if (capture.state === 'recording') capture.stop()
          release()
        } else if (event.data.size) chunks.push(event.data)
      }
      capture.onerror = () => {
        finish.current = 'cancel'; release()
        if (mounted.current) { setPhase('idle'); setError('recordingError') }
      }
      capture.onstop = () => {
        release()
        if (!mounted.current) return
        setPhase('idle')
        if (finish.current === 'cancel') return
        const blob = new Blob(chunks, { type: capture.mimeType })
        if (!blob.size || Date.now() - started.current < 350) { setError('empty'); return }
        if (finish.current === 'send') { void onSend(blob); return }
        const url = URL.createObjectURL(blob)
        previewUrl.current = url
        setPreview({ blob, url })
        setPhase('ready')
      }
      started.current = Date.now()
      setSeconds(0)
      capture.start(250)
      setPhase('recording')
    } catch (cause) {
      release()
      if (mounted.current && version === permissionVersion.current) {
        setPhase('idle')
        setError(cause instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(cause.name) ? 'permissionDenied' : cause instanceof Error && cause.message === 'unsupported' ? 'unsupported' : 'recordingError')
      }
    } finally { if (version === permissionVersion.current) pendingPermission.current = false }
  }
  function cancel() {
    permissionVersion.current++
    pendingPermission.current = false
    finish.current = 'cancel'
    if (recorder.current?.state === 'recording') recorder.current.stop()
    release(); clearPreview(); setPhase('idle')
  }
  return <div className="voice-controls" data-workspace-busy={phase !== 'idle' || disabled || undefined}>
    {phase === 'idle' ? <button type="button" className="button button-primary" disabled={disabled} onClick={start} aria-label={t('start')}><Mic size={18} />{t('start')}</button> : <>
      {phase === 'permission' && <span role="status">{t('permission')}</span>}
      {phase === 'recording' && <>
        <span className="voice-recording" role="status" aria-label={t('recording')}>
          <span className="voice-waves" aria-hidden="true">{[0,1,2,3,4,5,6].map(n => <i key={n} />)}</span>
          <span aria-hidden="true">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>
          <small>{t('limit')}</small>
        </span>
        <button type="button" className="button button-primary" onClick={() => { finish.current = 'send'; recorder.current?.stop(); release() }}><Send size={16} />{t('send')}</button>
      </>}
      {phase === 'ready' && preview && <>
        <audio controls src={preview.url} aria-label={t('playback')} />
        <button type="button" className="button button-primary" disabled={disabled} onClick={() => { const blob = preview.blob; clearPreview(); setPhase('idle'); void onSend(blob) }}><Send size={16} />{t('send')}</button>
      </>}
      <button type="button" className="button button-outline" onClick={cancel}><X size={16} />{t('cancel')}</button>
    </>}
    {error && <p className="voice-error" role="alert">{t(error)}</p>}
  </div>
}
