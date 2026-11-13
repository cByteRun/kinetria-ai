import Link from 'next/link';
import { getMessages, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { GlobalHeader } from '../global-header';
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
      <GlobalHeader theme={theme} colorTheme={colorTheme} context={<nav className="landing-header-links">
        <a href="#problem">{text('copy61')}</a><a href="#channels">{text('copy62')}</a><a href="#roles">{text('copy63')}</a><a href="#analytics">{text('copy64')}</a><a href="#roadmap">Roadmap</a>
      </nav>}><Link className="global-header-cta" href="/login">{text('copy65')}</Link></GlobalHeader>

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
