'use client'

import { useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

export function RequestDrawer({ closeHref, children }: { closeHref: string; children: ReactNode }) {
  const router = useRouter()
  const attachDialog = useCallback((panel: HTMLDialogElement | null) => {
    if (panel && !panel.open) panel.showModal()
  }, [])

  function close() {
    router.replace(closeHref, { scroll: false })
  }

  return <dialog ref={attachDialog} className="crm-request-drawer" aria-labelledby="request-drawer-title"
    onCancel={event => { event.preventDefault(); close() }}
    onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div className="crm-drawer-inner">
      <header><strong id="request-drawer-title">Обращение</strong>
        <button type="button" className="button button-outline" aria-label="Закрыть обращение" onClick={close}><X size={18} /></button>
      </header>
      {children}
    </div>
  </dialog>
}
