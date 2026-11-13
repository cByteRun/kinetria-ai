import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Theme } from '../i18n/settings'
import type { ColorTheme } from '../i18n/theme'
import { LogoMark } from './logo-mark'
import { Preferences } from './preferences'

/** One header for public pages, workspaces and the client portal. */
export function GlobalHeader({ theme, colorTheme, context, children }: {
  theme: Theme; colorTheme: ColorTheme; context?: ReactNode; children?: ReactNode
}) {
  return <header className="global-header">
    <Link className="global-brand" href="/" aria-label="IdeaRoute"><LogoMark size={28} /><span>IdeaRoute</span></Link>
    {context && <div className="global-header-context">{context}</div>}
    <div className="global-header-actions"><Preferences theme={theme} colorTheme={colorTheme} compact />{children}</div>
  </header>
}
