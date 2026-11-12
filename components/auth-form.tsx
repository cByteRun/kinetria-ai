'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

// A full document navigation makes the cookie change and destination atomic.
export function AuthForm({ action, className, pendingLabel, children }: {
  action: string
  className?: string
  pendingLabel: string
  children: ReactNode
}) {
  const [pending, setPending] = useState(false)
  useEffect(() => {
    const restore = () => setPending(false)
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])
  function submit(event: FormEvent<HTMLFormElement>) {
    if (pending) event.preventDefault()
    else {
      window.dispatchEvent(new Event('idearoute:auth-pending'))
      setPending(true)
    }
  }
  return <form action={action} method="post" onSubmit={submit}
    className={className} aria-busy={pending}>
    {children}
    {pending && <span className="auth-progress" role="status">{pendingLabel}</span>}
  </form>
}
