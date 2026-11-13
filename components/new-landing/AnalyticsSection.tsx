'use client';
import { useTranslations } from 'next-intl';
import { Clock, Repeat, Target } from 'lucide-react';

export default function AnalyticsSection() {
  const t = useTranslations('newLanding');

const WEEKLY_DAYS = [5.1, 4.8, 4.6, 5.3, 4.2, 3.9];
const CLUSTERS = [
  { label: t('copy1'), count: 6, width: 'w-full' },
  { label: t('copy2'), count: 4, width: 'w-2/3' },
  { label: t('copy3'), count: 3, width: 'w-1/2' },
];


  const max = Math.max(...WEEKLY_DAYS);

  return (
    <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-wider text-brand-700">{t('copy4')}</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">{t('copy5')}</h2>
          <p className="mt-4 text-lg leading-[1.6] text-slate-600">{t('copy6')}</p>
        </div>
        <p className="rounded-route border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-[1.5] text-amber-900">{t('copy7')}</p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        <article className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift md:col-span-1">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Clock className="h-4 w-4 text-brand-600" />{t('copy8')}</div>
          <p className="mt-6 font-display text-5xl font-semibold tabular-nums tracking-[-0.02em] text-slate-900">{t('copy9')}</p>
          <p className="mt-2 text-sm text-slate-500">{t('copy10')}</p>
          <div className="mt-8 flex h-24 items-end gap-2" aria-label={t('copy11')}>
            {WEEKLY_DAYS.map((value, index) => (
              <div key={index} className="flex flex-1 flex-col items-center justify-end">
                <span
                  className={`w-full rounded-t-md transition-colors duration-300 ${
                    index === WEEKLY_DAYS.length - 1 ? 'bg-brand-600' : 'bg-slate-200 group-hover:bg-slate-300'
                  }`}
                  style={{ height: `${(value / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </article>

        <article className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Target className="h-4 w-4 text-brand-600" />{t('copy12')}</div>
          <div className="mt-6 flex items-center gap-6">
            <svg viewBox="0 0 96 96" className="h-24 w-24 shrink-0 -rotate-90" aria-hidden="true">
              <circle cx="48" cy="48" r="40" stroke="rgb(var(--slate-200))" strokeWidth="10" fill="none" />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="rgb(var(--brand-600))"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${0.68 * 2 * Math.PI * 40} ${2 * Math.PI * 40}`}
              />
            </svg>
            <p className="font-display text-4xl font-semibold tabular-nums text-slate-900">68%</p>
          </div>
          <p className="mt-6 text-sm leading-[1.5] text-slate-500">{t('copy13')}</p>
        </article>

        <article className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Repeat className="h-4 w-4 text-brand-600" />{t('copy14')}</div>
          <ul className="mt-6 space-y-5">
            {CLUSTERS.map((cluster) => (
              <li key={cluster.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-700">{cluster.label}</span>
                  <span className="font-mono tabular-nums text-slate-500">{cluster.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full bg-brand-500 ${cluster.width}`} />
                </div>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
