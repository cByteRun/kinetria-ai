'use client';
import { useTranslations } from 'next-intl';
import { ArrowRight, Check, CircleDashed, Compass } from 'lucide-react';

export default function RoadmapSection() {
  const t = useTranslations('newLanding');

const STAGES = [
  {
    tag: t('copy87'),
    title: t('copy88'),
    items: [t('copy89'), t('copy90'), t('copy91')],
    state: 'available' as const,
  },
  {
    tag: t('copy92'),
    title: t('copy93'),
    items: [t('copy94'), t('copy95')],
    state: 'planned' as const,
  },
  {
    tag: t('copy96'),
    title: t('copy97'),
    items: [t('copy98'), t('copy99')],
    state: 'later' as const,
  },
];


  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-wider text-brand-700">Roadmap</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">{t('copy100')}</h2>
          <p className="mt-4 text-lg leading-[1.6] text-slate-600">{t('copy101')}</p>
        </div>

        <ol className="relative mt-14 grid gap-6 md:grid-cols-3">
          <span
            aria-hidden="true"
            className="absolute left-0 right-0 top-[11px] hidden h-px bg-gradient-to-r from-brand-600 via-slate-300 to-slate-200 md:block"
          />
          {STAGES.map((stage) => {
            const available = stage.state === 'available';
            return (
              <li key={stage.title} className="relative pt-10 md:pt-12">
                <span
                  className={`absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${
                    available ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {available ? <Check className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
                </span>
                <div
                  className={`h-full rounded-2xl border p-6 transition-shadow duration-300 hover:shadow-card ${
                    available ? 'border-brand-200 bg-brand-50/50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <p className={`font-mono text-xs ${available ? 'text-brand-700' : 'text-slate-500'}`}>{stage.tag}</p>
                  <h3 className="mt-3 text-xl text-slate-900">{stage.title}</h3>
                  <ul className="mt-4 space-y-2 text-sm leading-[1.5] text-slate-600">
                    {stage.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-2xl bg-slate-900 p-8 sm:flex-row sm:items-center sm:p-10">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 font-mono text-xs text-slate-300">
              <Compass className="h-3.5 w-3.5" />{t('copy65')}</p>
            <h3 className="mt-3 text-2xl text-white">{t('copy102')}</h3>
            <p className="mt-2 text-sm leading-[1.6] text-slate-300">{t('copy103')}</p>
          </div>
          <a
            href="/login"
            className="group inline-flex shrink-0 items-center gap-2 rounded-route bg-white px-6 py-3.5 text-sm font-medium text-slate-900 transition-colors duration-200 hover:bg-brand-50"
          >{t('copy54')}<ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
