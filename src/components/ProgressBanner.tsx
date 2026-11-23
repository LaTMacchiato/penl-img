import React, { useId } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

export interface ActivityProgress {
  active: boolean;
  phase: 'scanning' | 'importing' | 'decoding' | 'processing' | 'done';
  title: string;
  detail: string;
  currentFile?: string;
  current: number;
  total: number;
  /** 0–100 for determinate progress; undefined for indeterminate (e.g. folder scan) */
  percent?: number;
}

interface ProgressBannerProps {
  progress: ActivityProgress;
  variant?: 'inline' | 'floating';
  onCancel?: () => void;
}

export const ProgressBanner: React.FC<ProgressBannerProps> = ({
  progress,
  variant = 'inline',
  onCancel,
}) => {
  const labelId = useId();

  if (!progress.active) return null;

  const isDone = progress.phase === 'done';
  const isIndeterminate = !isDone && progress.percent === undefined;
  const clampedPercent =
    progress.percent !== undefined
      ? Math.max(0, Math.min(100, Math.round(progress.percent)))
      : undefined;

  if (variant === 'floating') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,460px)] bg-stone-900/95 backdrop-blur-md text-white px-5 py-4 rounded-2xl shadow-2xl border border-stone-700/80 space-y-2.5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {isDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-orange-400 animate-spin shrink-0" />
            )}
            <span id={labelId} className="font-semibold text-xs text-white truncate">
              {progress.title}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
            {progress.total > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-300 border border-stone-700 tabular-nums">
                {progress.current}/{progress.total}
              </span>
            )}
            {clampedPercent !== undefined && (
              <span
                className={`font-bold tabular-nums min-w-[36px] text-right ${
                  isDone ? 'text-emerald-400' : 'text-orange-400'
                }`}
              >
                {clampedPercent}%
              </span>
            )}
          </div>
        </div>

        <progress
          className="penl-progress"
          aria-labelledby={labelId}
          max={100}
          {...(!isIndeterminate ? { value: clampedPercent ?? 0 } : {})}
          style={
            {
              '--progress-bar-track': '#292524',
              '--progress-bar-fill': isDone ? '#10b981' : '#f97316',
            } as React.CSSProperties
          }
        />

        {(progress.currentFile || progress.detail) && (
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-stone-300 min-w-0">
            <span className="truncate">
              {progress.currentFile ? (
                <>
                  <strong className="text-white font-semibold">{progress.currentFile}</strong>
                  {progress.detail ? ` — ${progress.detail}` : ''}
                </>
              ) : (
                progress.detail
              )}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <section
      role="status"
      aria-live="polite"
      className={`rounded-2xl border px-5 py-4 shadow-tactile space-y-2.5 transition-colors ${
        isDone
          ? 'bg-emerald-50/70 border-emerald-200'
          : 'bg-white border-stone-200/90'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isDone
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-orange-500/10 text-orange-600'
            }`}
          >
            {isDone ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
          </div>
          <div className="min-w-0">
            <div id={labelId} className="text-xs sm:text-sm font-bold text-stone-900 truncate">
              {progress.title}
            </div>
            {(progress.currentFile || progress.detail) && (
              <div className="font-mono text-[11px] text-stone-500 truncate mt-0.5">
                {progress.currentFile ? (
                  <>
                    <span className="text-stone-800 font-semibold">{progress.currentFile}</span>
                    {progress.detail ? ` • ${progress.detail}` : ''}
                  </>
                ) : (
                  progress.detail
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
          {progress.total > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-stone-200 text-stone-700 font-semibold tabular-nums">
              {progress.current} / {progress.total}
            </span>
          )}
          {clampedPercent !== undefined ? (
            <span
              className={`font-bold tabular-nums min-w-[40px] text-right ${
                isDone ? 'text-emerald-700' : 'text-orange-600'
              }`}
            >
              {clampedPercent}%
            </span>
          ) : (
            <span className="text-[11px] text-stone-400 font-medium">En cours…</span>
          )}
          {!isDone && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="ml-1 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-700 border border-stone-200 hover:border-rose-200 text-[11px] font-semibold transition cursor-pointer"
            >
              Annuler
            </button>
          )}
        </div>
      </div>

      <progress
        className="penl-progress"
        aria-labelledby={labelId}
        max={100}
        {...(!isIndeterminate ? { value: clampedPercent ?? 0 } : {})}
        style={
          {
            '--progress-bar-track': isDone ? '#d1fae5' : '#e7e5e4',
            '--progress-bar-fill': isDone ? '#059669' : '#ea580c',
          } as React.CSSProperties
        }
      />
    </section>
  );
};
