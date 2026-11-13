'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CheckCircle2, UserCheck, Settings, Pencil } from 'lucide-react';
import { ROLE_META, ROLE_ORDER, type Role } from './lifecycle';

interface RoleContent {
  headline: string;
  actions: string[];
  primary: string;
  preview: { id: string; title: string; note: string };
}

export default function RolesSection() {
  const t = useTranslations('newLanding');

const CONTENT: Record<Role, RoleContent> = {
  employee: {
    headline: t('copy104'),
    actions: [t('copy105'), t('copy106'), t('copy107')],
    primary: t('copy107'),
    preview: { id: '#IR-195', title: t('copy108'), note: t('copy109') },
  },
  responsible: {
    headline: t('copy110'),
    actions: [t('copy111'), t('copy112'), t('copy113')],
    primary: t('copy114'),
    preview: { id: '#IR-201', title: t('copy115'), note: t('copy116') },
  },
  manager: {
    headline: t('copy117'),
    actions: [t('copy118'), t('copy119'), t('copy120')],
    primary: t('copy121'),
    preview: { id: '#IR-204', title: t('copy29'), note: t('copy122') },
  },
  admin: {
    headline: t('copy123'),
    actions: [t('copy124'), t('copy125'), t('copy126')],
    primary: t('copy127'),
    preview: { id: t('copy128'), title: t('copy129'), note: t('copy130') },
  },
};

const ROLE_ICON: Record<Role, typeof UserCheck> = {
  employee: CheckCircle2,
  responsible: Pencil,
  manager: UserCheck,
  admin: Settings,
};


  const [role, setRole] = useState<Role>('employee');
  const content = CONTENT[role];
  const Icon = ROLE_ICON[role];

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-wider text-brand-700">{t('copy131')}</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">{t('copy132')}</h2>
          <p className="mt-4 text-lg leading-[1.6] text-slate-600">{t('copy133')}</p>
        </div>

        <div role="group" aria-label={t('copy63')} className="mt-10 flex flex-wrap gap-2">
          {ROLE_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={role === key}
              onClick={() => setRole(key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                role === key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t(ROLE_META[key].label)}
            </button>
          ))}
        </div>

        <div key={role} className="animate-fade-up mt-8 grid gap-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8 lg:grid-cols-[1fr_1fr] lg:gap-10">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-route bg-white text-brand-600 shadow-card">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-5 text-2xl text-slate-900">{content.headline}</h3>
            <p className="mt-2 text-sm text-slate-500">{t(ROLE_META[role].hint)}</p>
            <ul className="mt-6 space-y-3">
              {content.actions.map((action) => (
                <li key={action} className="flex items-start gap-3 text-sm leading-[1.5] text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  {action}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-500">{content.preview.id}</span>
                <span className="font-mono text-[11px] text-slate-400">{t('copy134')}</span>
              </div>
              <p className="mt-3 text-base font-medium leading-snug text-slate-900">{content.preview.title}</p>
              <p className="mt-2 text-sm text-slate-600">{content.preview.note}</p>
            </div>
            <Link
              href="/login"
              className="mt-6 w-full rounded-route bg-brand-600 px-4 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-700"
            >
              {content.primary}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
