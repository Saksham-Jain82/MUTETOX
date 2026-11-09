"use client";

/**
 * MUTETOX — Creator Comment Governance & AI Moderation Engine.
 *
 * App shell with three lenses over one shared Zustand truth:
 *   Public View        — the audience comment experience under live policy
 *   Moderation Queue   — itemized + clustered review of held comments
 *   Settings           — the creator's real-time governance controls
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, ListChecks, Settings2, Shield } from "lucide-react";
import { CommentFeed } from "@/components/CommentFeed";
import { CreatorSettings } from "@/components/CreatorSettings";
import { ModerationQueue } from "@/components/ModerationQueue";
import { useModerationStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type ViewKey = "public" | "queue" | "settings";

const VIEWS: { key: ViewKey; label: string; icon: typeof Eye }[] = [
  { key: "public", label: "Public View", icon: Eye },
  { key: "queue", label: "Creator Queue", icon: ListChecks },
  { key: "settings", label: "Settings & Governance", icon: Settings2 },
];

export default function Home() {
  const [view, setView] = useState<ViewKey>("public");
  const [mounted, setMounted] = useState(false);
  const heldCount = useModerationStore((s) => s.comments.filter((c) => c.status === "held").length);

  // Deferred mount keeps SSR output stable while the persisted store rehydrates.
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      {/* ------------------------------------------------ Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10">
              <Shield className="h-4 w-4 text-emerald-400" />
            </span>
            <div className="leading-tight">
              <p className="font-mono text-[13px] font-semibold tracking-[0.22em] text-zinc-50">
                MUTETOX
              </p>
              <p className="font-mono text-[8px] tracking-[0.28em] text-zinc-500 uppercase">
                Comment Governance Engine
              </p>
            </div>
          </div>

          <nav className="flex rounded-md border border-zinc-800 bg-zinc-900 p-1">
            {VIEWS.map(({ key, label, icon: Icon }) => {
              const active = view === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3",
                    active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-[4px] bg-zinc-800"
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                  <Icon className="relative h-3.5 w-3.5" />
                  <span className="relative hidden md:inline">{label}</span>
                  <span className="relative md:hidden">{label.split(" ")[0]}</span>
                  {key === "queue" && (
                    <span
                      className={cn(
                        "relative rounded px-1 font-mono text-[10px] tabular-nums",
                        heldCount > 0
                          ? "bg-amber-500/15 text-amber-400"
                          : "text-zinc-600"
                      )}
                    >
                      {heldCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="font-mono text-[9px] tracking-[0.2em] text-zinc-500 uppercase">
              NLP engine online · sim v2.4.1
            </span>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------ Body */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {mounted ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {view === "public" && <CommentFeed />}
              {view === "queue" && <ModerationQueue />}
              {view === "settings" && <CreatorSettings />}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="space-y-4">
            <div className="h-[280px] animate-pulse rounded-md border border-zinc-800/70 bg-zinc-900/40" />
            <div className="h-[120px] animate-pulse rounded-md border border-zinc-800/70 bg-zinc-900/40" />
          </div>
        )}
      </main>

      {/* ------------------------------------------------ Footer */}
      <footer className="border-t border-zinc-800/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <p className="font-mono text-[9px] tracking-[0.18em] text-zinc-600 uppercase">
            submit → classify → route → review · state syncs across all views
          </p>
          <p className="font-mono text-[9px] tracking-[0.18em] text-zinc-600 uppercase">
            persisted locally · reset from settings
          </p>
        </div>
      </footer>
    </div>
  );
}
