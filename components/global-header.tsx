import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Theme } from '../i18n/settings'
import type { ColorTheme } from '../i18n/theme'
import { LogoMark } from './logo-mark'
import { Preferences } from './preferences'
import { TourStartButton } from './tour-provider'

/** One header for public pages, workspaces and the client portal. */
export function GlobalHeader({ theme, colorTheme, context, search, children }: {
  theme: Theme; colorTheme: ColorTheme; context?: ReactNode; search?: ReactNode; children?: ReactNode
}) {
  return <header className="global-header">
    <Link className="global-brand" href="/" aria-label="IdeaRoute"><LogoMark size={28} /><span>IdeaRoute</span></Link>
    {context && <div className="global-header-context">{context}</div>}
    <div className="global-header-actions tour-header-actions">
      <div className="tour-header-search">{search}</div>
      <TourStartButton />
      <div className="tour-header-controls"><Preferences theme={theme} colorTheme={colorTheme} compact />{children}</div>
    </div>
  </header>
}
