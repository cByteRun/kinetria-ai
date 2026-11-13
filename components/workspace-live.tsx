'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
export function WorkspaceLive({ path }: { path: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const screen = `${params.get('view') || 'overview'}:${params.get('id') || ''}`
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [screen])
  useEffect(() => {
    let authPending = false
    let focusTimer: ReturnType<typeof setTimeout> | undefined
    const pauseForAuth = () => {
      authPending = true
    }
    const refresh = () => {
      if (
        !authPending &&
        document.visibilityState === 'visible' &&
        !document.querySelector('form:focus-within')
      )
        router.refresh()
    }
    const timer = setInterval(refresh, 30000)
    const search = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !(e.target as Element)?.closest(
          'input,textarea,select,[contenteditable]',
        )
      ) {
        e.preventDefault()
        router.push(path + '?view=registry')
        clearTimeout(focusTimer)
        focusTimer = setTimeout(
          () =>
            document
              .querySelector<HTMLInputElement>('[data-request-search]')
              ?.focus(),
          200,
        )
      }
    }
    window.addEventListener('idearoute:auth-pending', pauseForAuth)
    document.addEventListener('keydown', search)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      clearTimeout(focusTimer)
      window.removeEventListener('idearoute:auth-pending', pauseForAuth)
      document.removeEventListener('keydown', search)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [router, path])
  return null
}
