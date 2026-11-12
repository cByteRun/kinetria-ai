'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export function WorkspaceLive({ path }: { path: string }) {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => {
      if (
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
        setTimeout(
          () =>
            document
              .querySelector<HTMLInputElement>('[aria-label="Поиск обращений"]')
              ?.focus(),
          200,
        )
      }
    }
    document.addEventListener('keydown', search)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('keydown', search)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [router, path])
  return null
}
