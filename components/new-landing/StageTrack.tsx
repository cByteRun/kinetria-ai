'use client';
import { useTranslations } from 'next-intl';
import { STAGES } from './lifecycle';

interface StageTrackProps {
  progress: number;
  showLabels?: boolean;
  className?: string;
}

export default function StageTrack({ progress, showLabels = false, className = '' }: StageTrackProps) {
 const t=useTranslations('newLanding');
  return (
    <div className={`flex items-start ${className}`} aria-label={t('stageLabel', {stage: STAGES[Math.min(progress, 4) - 1] ? t(STAGES[Math.min(progress, 4) - 1]) : t('copy135')})}>
      {STAGES.map((stage, index) => {
        const done = index < progress;
        const current = index === progress - 1 && progress < 4;
        const isLast = index === STAGES.length - 1;
        return (
          <div key={t(stage)} className={`flex items-start ${isLast ? '' : 'flex-1'}`}>
            <div className="flex flex-col items-center">
              <span
                className={`relative flex h-2.5 w-2.5 items-center justify-center rounded-full transition-colors duration-300 ${
                  done ? 'bg-brand-600' : 'bg-slate-200'
                }`}
              >
                {current && <span className="absolute inset-0 animate-pulse-dot rounded-full bg-brand-500/40" />}
              </span>
              {showLabels && (
                <span className={`mt-2 whitespace-nowrap text-xs ${done ? 'text-slate-700' : 'text-slate-400'}`}>
                  {t(stage)}
                </span>
              )}
            </div>
            {!isLast && (
              <span
                className={`mx-1 mt-[4px] h-px flex-1 transition-colors duration-300 ${
                  index < progress - 1 ? 'bg-brand-600' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
