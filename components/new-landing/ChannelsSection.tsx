import { useTranslations } from 'next-intl';
import { Mic, Pencil, Send, Monitor, Sparkles } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function ChannelsSection() {
  const t = useTranslations('newLanding');

const WAVE = [6, 12, 9, 16, 11, 20, 8, 14, 18, 10, 7, 13, 16, 9, 5];


  return (
    <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
      <div className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-wider text-brand-700">{t('copy15')}</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">{t('copy16')}</h2>
        <p className="mt-4 text-lg leading-[1.6] text-slate-600">{t('copy17')}</p>
      </div>

      <div className="mt-14 grid items-center gap-10 lg:grid-cols-[320px_1fr_1fr] lg:gap-6">
        <div className="mx-auto w-full max-w-[300px]">
          <div className="rounded-[2.25rem] border-[10px] border-slate-900 bg-white shadow-lift">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">IR</span>
              <div>
                <p className="text-xs font-medium text-slate-900">{t('copy18')}</p>
                <p className="text-[10px] text-slate-500">{t('copy19')}</p>
              </div>
            </div>
            <div className="space-y-3 bg-slate-50 p-4">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-3 py-2.5 text-white">
                <div className="flex items-center gap-2">
                  <Mic className="h-3.5 w-3.5" />
                  <div className="flex h-5 items-center gap-[2px]">
                    {WAVE.map((h, i) => (
                      <span key={i} className="w-[2px] rounded-full bg-white/80" style={{ height: h }} />
                    ))}
                  </div>
                  <span className="font-mono text-[10px] tabular-nums">0:47</span>
                </div>
              </div>
              <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-white px-3 py-2.5 text-xs leading-[1.5] text-slate-700 shadow-card">
                <p className="mb-2 flex items-center gap-1.5 font-medium text-slate-900">
                  <Sparkles className="h-3 w-3 text-brand-600" />{t('copy20')}</p>
                <p>{t('copy21')}</p>
                <p className="mt-2 text-[10px] text-slate-500">{t('copy22')}</p>
              </div>
              <div className="flex gap-2">
                <span className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-2 text-[11px] font-medium text-slate-700">
                  <Pencil className="h-3 w-3" />{t('copy23')}</span>
                <span className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-600 py-2 text-[11px] font-medium text-white">
                  <Send className="h-3 w-3" />{t('copy24')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto h-12 w-full max-w-[160px] lg:h-full lg:max-w-none">
          <svg viewBox="0 0 160 48" className="absolute inset-0 h-full w-full overflow-visible" fill="none" aria-hidden="true">
            <path
              d="M0 24 H160"
              stroke="rgb(var(--brand-500))"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="6 6"
              opacity={0.35}
            />
            <path
              d="M0 24 H160"
              stroke="rgb(var(--brand-600))"
              strokeWidth={2.5}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset="1"
              className="animate-route-draw"
            />
          </svg>
          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-2 py-1 font-mono text-[10px] text-slate-500 shadow-card lg:block">{t('copy25')}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lift sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
              <Monitor className="h-4 w-4 text-brand-600" />{t('copy26')}</span>
            <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600">{t('copy27')}</span>
          </div>
          <div className="animate-fade-up rounded-xl border border-brand-200 bg-brand-50/60 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-slate-500">{t('copy28')}</span>
              <StatusBadge status="routing" />
            </div>
            <p className="text-sm font-medium text-slate-900">{t('copy29')}</p>
            <p className="mt-1 text-xs leading-[1.5] text-slate-600">{t('copy30')}</p>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li className="flex gap-2"><span className="text-brand-600">•</span>{t('copy31')}</li>
            <li className="flex gap-2"><span className="text-brand-600">•</span>{t('copy32')}</li>
            <li className="flex gap-2"><span className="text-brand-600">•</span>{t('copy33')}</li>
          </ul>
          <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-[1.5] text-slate-600">{t('copy34')}</p>
        </div>
      </div>
    </section>
  );
}
