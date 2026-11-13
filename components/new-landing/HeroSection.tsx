'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ArrowRight, Mic, FileText, UserCheck, CheckCircle2, BellRing } from 'lucide-react';
import StageTrack from './StageTrack';
import StatusBadge from './StatusBadge';
import type { Status } from './lifecycle';

interface LifecycleStep {
  label: string;
  icon: typeof Mic;
  note: string;
  status: Status;
  assignee: string | null;
  progress: number;
  body: string;
}

export default function HeroSection() {
  const t = useTranslations('newLanding');

const STEPS: LifecycleStep[] = [
  {
    label: t('copy35'),
    icon: Mic,
    note: t('copy36'),
    status: 'draft',
    assignee: null,
    progress: 1,
    body: t('copy37'),
  },
  {
    label: t('copy38'),
    icon: FileText,
    note: t('copy39'),
    status: 'draft',
    assignee: null,
    progress: 1,
    body: t('copy40'),
  },
  {
    label: t('copy41'),
    icon: UserCheck,
    note: t('copy42'),
    status: 'in_progress',
    assignee: t('copy43'),
    progress: 2,
    body: t('copy21'),
  },
  {
    label: t('copy44'),
    icon: CheckCircle2,
    note: t('copy45'),
    status: 'resolved',
    assignee: t('copy46'),
    progress: 3,
    body: t('copy47'),
  },
  {
    label: t('copy48'),
    icon: BellRing,
    note: t('copy49'),
    status: 'closed',
    assignee: t('copy46'),
    progress: 4,
    body: t('copy50'),
  },
];

const AUTO_ADVANCE_MS = 3800;


  const [active, setActive] = useState(0);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (manual || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % STEPS.length);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [manual]);

  const step = STEPS[active];

  const selectStep = (index: number) => {
    setManual(true);
    setActive(index);
  };

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[55fr_45fr] lg:gap-16 lg:px-8 lg:pb-28 lg:pt-24">
        <div className="animate-fade-up">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-xs text-slate-600 shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />{t('copy51')}</p>
          <h1 className="text-4xl font-semibold leading-[1.15] text-slate-900 sm:text-5xl lg:text-[56px]">{t('copy52')}</h1>
          <p className="mt-6 max-w-xl text-lg leading-[1.6] text-slate-600">{t('copy53')}</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="group inline-flex items-center justify-center gap-2 rounded-route bg-brand-600 px-6 py-3.5 text-base font-medium text-white shadow-card transition-all duration-200 hover:bg-brand-700 hover:shadow-lift"
            >{t('copy54')}<ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <p className="text-sm text-slate-500">{t('copy55')}</p>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lift sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-900">{t('copy56')}</p>
              <span className="font-mono text-xs text-slate-500">{t('copy57')}{active + 1} / {STEPS.length}</span>
            </div>

            <div className="mb-5 grid grid-cols-5 gap-1.5">
              {STEPS.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => selectStep(index)}
                  aria-pressed={index === active}
                  className={`rounded-route px-1 py-2 text-[11px] leading-tight transition-colors duration-200 sm:text-xs ${
                    index === active
                      ? 'bg-brand-600 text-white'
                      : index < active
                        ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div key={active} className="animate-fade-up rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-slate-500">#IR-204</span>
                <StatusBadge status={step.status} />
              </div>
              <p className="text-base font-medium leading-snug text-slate-900">{t('copy29')}</p>
              <p className="mt-2 text-sm leading-[1.5] text-slate-600">{step.body}</p>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>{t('copy58')}<span className="text-slate-700">{step.assignee ?? t('copy59')}</span></span>
              </div>
              <StageTrack progress={step.progress} className="mt-4" />
            </div>

            <p className="mt-4 flex min-h-[44px] items-start gap-2 text-sm leading-[1.5] text-slate-600">
              <step.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>{step.note}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
