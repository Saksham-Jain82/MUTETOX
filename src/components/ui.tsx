"use client";

import type { ReactNode } from "react";
import { cn, segmentByMatches } from "@/lib/utils";
import type { LexiconMatch, ToxicityCategory } from "@/types/moderation";
import { CATEGORY_LABEL, scoreTone, TONE_TEXT } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Switch                                                              */
/* ------------------------------------------------------------------ */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors duration-200",
        checked ? "border-emerald-500/60 bg-emerald-500/90" : "border-zinc-700 bg-zinc-800"
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 block h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all duration-200",
          checked ? "left-[18px] bg-zinc-950" : "left-[3px] bg-zinc-400"
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Slider                                                              */
/* ------------------------------------------------------------------ */

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="range"
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="mutetox-slider w-full"
      style={{ ["--fill" as string]: `${((value - min) / (max - min)) * 100}%` }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Score badge — the monospace classifier readout                      */
/* ------------------------------------------------------------------ */

export function ScoreBadge({
  category,
  score,
  compact = false,
}: {
  category: ToxicityCategory | "OVERALL";
  score: number;
  compact?: boolean;
}) {
  const tone = scoreTone(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-1.5 py-0.5 font-mono text-[10px] tracking-wider",
        compact ? "rounded-[3px]" : "rounded",
        tone === "danger" && "border-red-500/40 bg-red-500/10",
        tone === "warn" && "border-amber-500/40 bg-amber-500/10",
        tone === "safe" && "border-zinc-700 bg-zinc-800/60"
      )}
    >
      <span className="text-zinc-500">{category === "OVERALL" ? "TOXICITY" : CATEGORY_LABEL[category]}</span>
      <span className={cn("font-medium tabular-nums", TONE_TEXT[tone])}>{score.toFixed(2)}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Highlighted text — renders classifier-flagged spans inline          */
/* ------------------------------------------------------------------ */

const HIGHLIGHT_CLASS: Record<ToxicityCategory, string> = {
  threat: "bg-red-500/15 text-red-300 border-b border-red-500/50",
  insult: "bg-amber-500/15 text-amber-300 border-b border-amber-500/50",
  profanity: "bg-orange-500/15 text-orange-300 border-b border-orange-500/50",
  spam: "bg-sky-500/15 text-sky-300 border-b border-sky-500/50",
};

export function HighlightedText({
  text,
  matches,
  className,
}: {
  text: string;
  matches: LexiconMatch[];
  className?: string;
}) {
  const segments = segmentByMatches(text, matches);
  return (
    <p className={className}>
      {segments.map((seg, i) =>
        seg.category ? (
          <mark key={i} className={cn("rounded-[2px] px-0.5", HIGHLIGHT_CLASS[seg.category])}>
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Chrome                                                              */
/* ------------------------------------------------------------------ */

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-zinc-800 bg-zinc-900", className)}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-4 py-3">
      <div>
        <h3 className="font-mono text-[11px] font-medium tracking-[0.18em] text-zinc-300 uppercase">
          {title}
        </h3>
        {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function StatusDot({ tone }: { tone: "on" | "off" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        tone === "on" && "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
        tone === "off" && "bg-zinc-600",
        tone === "warn" && "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
      )}
    />
  );
}
