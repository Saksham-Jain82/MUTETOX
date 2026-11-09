"use client";

/**
 * Smart De-Tox intercept modal.
 *
 * Shown when a draft crosses the creator's toxicity threshold while the
 * Smart De-Tox module is active. Presents the flagged original beside the
 * AI-rewritten variant. In "optional" mode the viewer may still post the
 * original — which is routed straight into the review queue; in "strict"
 * mode the original can never reach the thread.
 */

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ShieldAlert, Sparkles, Trash2, Wand2 } from "lucide-react";
import { HighlightedText, ScoreBadge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { DetoxMode, Verdict } from "@/types/moderation";

export interface DetoxRequest {
  draft: string;
  verdict: Verdict;
}

export function SmartDetoxModal({
  request,
  mode,
  onResolve,
}: {
  request: DetoxRequest | null;
  mode: DetoxMode;
  onResolve: (choice: "revision" | "original" | "discard") => void;
}) {
  useEffect(() => {
    if (!request) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onResolve("discard");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [request, onResolve]);

  return (
    <AnimatePresence>
      {request && (
        <motion.div
          key="detox-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
          onClick={() => onResolve("discard")}
        >
          <motion.div
            key="detox-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Smart De-Tox intercept"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded border border-amber-500/40 bg-amber-500/10">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-100">Smart De-Tox intercepted this comment</p>
                  <p className="font-mono text-[10px] tracking-[0.16em] text-zinc-500 uppercase">
                    Toxicity {request.verdict.breakdown.overall.toFixed(2)} — above creator threshold
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.2em] uppercase",
                  mode === "strict"
                    ? "border-red-500/40 bg-red-500/10 text-red-400"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                )}
              >
                {mode} mode
              </span>
            </div>

            <div className="space-y-4 px-5 py-4">
              {/* Original */}
              <div className="rounded-md border border-red-500/25 bg-red-500/[0.04] p-3.5">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[9px] tracking-[0.2em] text-red-400/80 uppercase">
                    Your draft
                  </span>
                  {request.verdict.breakdown.flagged.map((f) => (
                    <ScoreBadge key={f.category} category={f.category} score={f.score} compact />
                  ))}
                </div>
                <HighlightedText
                  text={request.draft}
                  matches={request.verdict.matches}
                  className="text-sm leading-relaxed text-zinc-200"
                />
              </div>

              <div className="flex justify-center">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
                  <ArrowDown className="h-3.5 w-3.5 text-zinc-400" />
                </span>
              </div>

              {/* AI revision */}
              <div className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.05] p-3.5">
                <div className="mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-emerald-400" />
                  <span className="font-mono text-[9px] tracking-[0.2em] text-emerald-400/90 uppercase">
                    AI rephrase — same point, no toxicity
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-zinc-100">{request.verdict.rephrase}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 border-t border-zinc-800 bg-zinc-950/60 px-5 py-4">
              <button
                type="button"
                onClick={() => onResolve("revision")}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-emerald-500/60 bg-emerald-500 px-3 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400"
              >
                <Wand2 className="h-4 w-4" />
                Use AI Revision &amp; Post
              </button>
              <div className="flex gap-2">
                {mode === "optional" ? (
                  <button
                    type="button"
                    onClick={() => onResolve("original")}
                    className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border border-zinc-700 bg-transparent px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
                  >
                    Post Original
                    <span className="font-mono text-[9px] tracking-wider text-amber-400/90 uppercase">
                      → review queue
                    </span>
                  </button>
                ) : (
                  <p className="flex flex-1 items-center justify-center rounded border border-dashed border-zinc-800 px-3 py-2 text-center font-mono text-[9px] tracking-[0.14em] text-zinc-600 uppercase">
                    Strict mode — original is blocked
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onResolve("discard")}
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded border border-zinc-800 bg-transparent px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:border-red-500/50 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Discard
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
