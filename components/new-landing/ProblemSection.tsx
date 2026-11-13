import { useTranslations } from 'next-intl';
import { MessageSquare, Mail, StickyNote, Mic, ArrowRight } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function ProblemSection() {
  const t = useTranslations('newLanding');

const CHAOS = [
  { icon: MessageSquare, text: t('copy67'), tilt: '-rotate-2' },
  { icon: Mail, text: t('copy68'), tilt: 'rotate-1' },
  { icon: Mic, text: t('copy69'), tilt: '-rotate-1' },
  { icon: StickyNote, text: t('copy70'), tilt: 'rotate-2' },
];

const REGISTRY = [
  { id: 'IR-204', title: t('copy71'), owner: t('copy72'), due: '14.11', status: 'in_progress' as const },
  { id: 'IR-201', title: t('copy73'), owner: t('copy72'), due: '15.11', status: 'in_progress' as const },
  { id: 'IR-198', title: t('copy74'), owner: t('copy72'), due: '14.11', status: 'clarification' as const },
];


  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-wider text-brand-700">{t('copy75')}</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">{t('copy76')}</h2>
          <p className="mt-4 text-lg leading-[1.6] text-slate-600">{t('copy77')}</p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:gap-10">
          <div className="relative rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 sm:p-8">
            <p className="mb-6 text-sm font-medium text-slate-500">{t('copy78')}</p>
            <div className="space-y-4">
              {CHAOS.map((item) => (
                <div
                  key={item.text}
                  className={`flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-[1.5] text-slate-600 shadow-card transition-transform duration-300 hover:rotate-0 ${item.tilt}`}
                >
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-lift sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-900">{t('copy79')}</p>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500">{t('copy80')}<ArrowRight className="h-3 w-3" />{t('copy81')}</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[72px_1fr_auto] gap-3 bg-slate-50 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-slate-500 sm:grid-cols-[84px_1fr_auto_auto]">
                <span>{t('copy82')}</span>
                <span>{t('copy83')}</span>
                <span className="hidden sm:block">{t('copy84')}</span>
                <span>{t('copy85')}</span>
              </div>
              {REGISTRY.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[72px_1fr_auto] items-center gap-3 border-t border-slate-200 px-4 py-3.5 transition-colors duration-200 hover:bg-slate-50 sm:grid-cols-[84px_1fr_auto_auto]"
                >
                  <span className="font-mono text-xs text-slate-500">{row.id}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{row.title}</p>
                    <p className="text-xs text-slate-500">{t('copy58')}{row.owner}</p>
                  </div>
                  <span className="hidden font-mono text-xs tabular-nums text-slate-600 sm:block">{row.due}</span>
                  <StatusBadge status={row.status} />
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-[1.5] text-slate-600">{t('copy86')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
