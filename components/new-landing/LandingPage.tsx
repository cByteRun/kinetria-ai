import Link from 'next/link';
import { getMessages, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { Preferences } from '../preferences';
import { getColorTheme } from '../../i18n/theme';
import type { Theme } from '../../i18n/settings';
import Logo from './Logo';
import HeroSection from './HeroSection';
import ProblemSection from './ProblemSection';
import ChannelsSection from './ChannelsSection';
import RolesSection from './RolesSection';
import AnalyticsSection from './AnalyticsSection';
import RoadmapSection from './RoadmapSection';

export default async function LandingPage({theme}: {theme: Theme}) {
  const [colorTheme, text, messages] = await Promise.all([
    getColorTheme(), getTranslations('newLanding'), getMessages(),
  ]);

  return (
    <div className="new-landing min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-slate-50/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" aria-label={text('copy60')} className="rounded-route">
            <Logo />
          </Link>
          <Preferences theme={theme} colorTheme={colorTheme} compact />
          <nav className="hidden items-center gap-8 text-sm text-slate-600 xl:flex">
            <a href="#problem" className="transition-colors hover:text-slate-900">{text('copy61')}</a>
            <a href="#channels" className="transition-colors hover:text-slate-900">{text('copy62')}</a>
            <a href="#roles" className="transition-colors hover:text-slate-900">{text('copy63')}</a>
            <a href="#analytics" className="transition-colors hover:text-slate-900">{text('copy64')}</a>
            <a href="#roadmap" className="transition-colors hover:text-slate-900">Roadmap</a>
          </nav>
          <Link
            href="/login"
            className="rounded-route bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-800"
          >{text('copy65')}</Link>
        </div>
      </header>

      <NextIntlClientProvider messages={{newLanding: messages.newLanding}}>
      <main>
        <HeroSection />
        <div id="problem"><ProblemSection /></div>
        <div id="channels"><ChannelsSection /></div>
        <div id="roles"><RolesSection /></div>
        <div id="analytics"><AnalyticsSection /></div>
        <div id="roadmap"><RoadmapSection /></div>
      </main>
      </NextIntlClientProvider>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Logo />
          <p>{text('copy66')}</p>
        </div>
      </footer>
    </div>
  );
}
