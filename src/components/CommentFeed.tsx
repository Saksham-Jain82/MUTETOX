"use client";

/**
 * Public View — the audience-facing comment section.
 *
 * Simulates a viewer's experience under live governance: every draft runs
 * through the moderation pipeline, module status chips mirror the creator's
 * settings in real time, and the Smart De-Tox modal intercepts flagged text.
 */

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Eye,
  Heart,
  Play,
  SendHorizonal,
  ShieldCheck,
  ThumbsUp,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { SESSION_HANDLE, useModerationStore } from "@/lib/store";
import { avatarColor, cn, initials, scoreTone, TONE_TEXT, timeAgo } from "@/lib/utils";
import { SmartDetoxModal, type DetoxRequest } from "@/components/SmartDetoxModal";
import { StatusDot } from "@/components/ui";
import type { Comment, SubmitOutcome } from "@/types/moderation";

type Banner =
  | { kind: "published" | "blurred" | "held"; id: number }
  | { kind: "cooldown"; id: number };

export function CommentFeed() {
  const comments = useModerationStore((s) => s.comments);
  const settings = useModerationStore((s) => s.settings);
  const submitComment = useModerationStore((s) => s.submitComment);
  const resolveDetox = useModerationStore((s) => s.resolveDetox);
  const likeComment = useModerationStore((s) => s.likeComment);

  const [draft, setDraft] = useState("");
  const [detox, setDetox] = useState<DetoxRequest | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  const published = useMemo(
    () =>
      comments
        .filter((c) => c.status === "published")
        .sort((a, b) => b.createdAt - a.createdAt),
    [comments]
  );

  useEffect(() => {
    if (!banner || banner.kind === "cooldown") return;
    const t = window.setTimeout(() => setBanner(null), 5200);
    return () => window.clearTimeout(t);
  }, [banner]);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = window.setInterval(() => setCooldownLeft((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(t);
  }, [cooldownLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocked = settings.cooldown.enabled && cooldownLeft > 0;

  function handleOutcome(outcome: SubmitOutcome) {
    switch (outcome.kind) {
      case "published":
      case "blurred":
      case "held":
        setDraft("");
        setBanner({ kind: outcome.kind, id: Date.now() });
        break;
      case "detox":
        setDetox({ draft: outcome.draft, verdict: outcome.verdict });
        break;
      case "cooldown":
        setCooldownLeft(outcome.retryAfterSeconds);
        setBanner({ kind: "cooldown", id: Date.now() });
        break;
      case "empty":
        break;
    }
  }

  function handleDetoxResolve(choice: "revision" | "original" | "discard") {
    if (!detox) return;
    const { draft: originalDraft, verdict } = detox;
    setDetox(null);
    if (choice === "revision") {
      resolveDetox(originalDraft, verdict, "revision");
      setDraft("");
      setBanner({ kind: "published", id: Date.now() });
    } else if (choice === "original") {
      resolveDetox(originalDraft, verdict, "original");
      setDraft("");
      setBanner({ kind: "held", id: Date.now() });
    }
  }

  const modules = [
    { label: "SMART DE-TOX", on: settings.smartDetox.enabled },
    { label: "AUTO-BLUR", on: settings.autoBlur.enabled },
    {
      label: `COOLDOWN ${settings.cooldown.maxComments}/${settings.cooldown.windowMinutes}M`,
      on: settings.cooldown.enabled,
    },
    { label: "CLUSTERING", on: settings.clustering.enabled },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      {/* -------------------------------------------------- Player column */}
      <div>
        <div className="group relative aspect-video overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
          <Image
            src="/images/studio-thumb.jpg"
            alt="Studio rebuild timelapse thumbnail"
            fill
            priority
            className="object-cover opacity-90 transition-transform duration-700 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-black/25" />
          <button
            type="button"
            className="absolute inset-0 m-auto flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/60 text-white transition-transform duration-200 hover:scale-105"
            aria-label="Play video"
          >
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </button>
          <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-zinc-200">
            22:41
          </span>
          <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded border border-emerald-500/40 bg-black/70 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.16em] text-emerald-400 uppercase">
            <ShieldCheck className="h-3 w-3" />
            Governance active
          </span>
        </div>

        <h1 className="mt-4 text-lg font-semibold tracking-tight text-zinc-50">
          I Rebuilt My Entire Studio in 48 Hours (Full Timelapse)
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" /> 1,284,913 views
          </span>
          <span>3 days ago</span>
          <span className="font-mono text-[10px] tracking-wider text-zinc-600">
            #build #studio #timelapse
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 font-mono text-xs font-semibold text-zinc-950">
              MB
            </span>
            <div>
              <p className="flex items-center gap-1 text-sm font-medium text-zinc-100">
                Marco Builds
                <BadgeCheck className="h-3.5 w-3.5 text-zinc-500" />
              </p>
              <p className="text-xs text-zinc-500">2.41M subscribers</p>
            </div>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded bg-zinc-100 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-white"
          >
            Subscribe
          </button>
        </div>
      </div>

      {/* ------------------------------------------------ Comments column */}
      <div className="flex flex-col">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-baseline gap-2 text-sm font-semibold text-zinc-100">
            Comments
            <span className="font-mono text-xs font-normal text-zinc-500 tabular-nums">
              {published.length}
            </span>
          </h2>
          <span className="font-mono text-[10px] tracking-[0.14em] text-zinc-600 uppercase">
            threshold τ={settings.threshold.toFixed(2)}
          </span>
        </div>

        {/* Live module status strip */}
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2">
          {modules.map((m) => (
            <span key={m.label} className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.14em] text-zinc-500">
              <StatusDot tone={m.on ? "on" : "off"} />
              <span className={m.on ? "text-zinc-300" : "text-zinc-600"}>{m.label}</span>
            </span>
          ))}
        </div>

        {/* Composer */}
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 font-mono text-[11px] font-semibold text-zinc-950">
            Y
          </span>
          <div className="flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!blocked) handleOutcome(submitComment(draft));
                }
              }}
              disabled={blocked}
              rows={2}
              placeholder={
                blocked
                  ? `Cooldown active — retry in ${cooldownLeft}s`
                  : `Add a comment as ${SESSION_HANDLE}…`
              }
              className={cn(
                "w-full resize-none rounded-md border bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none",
                blocked
                  ? "cursor-not-allowed border-amber-500/40 opacity-60"
                  : "border-zinc-800 focus:border-zinc-600"
              )}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[9px] tracking-[0.14em] text-zinc-600 uppercase">
                {blocked ? (
                  <span className="flex items-center gap-1 text-amber-400">
                    <Timer className="h-3 w-3" /> friction cooldown {cooldownLeft}s
                  </span>
                ) : (
                  "NLP scorer evaluates on submit"
                )}
              </span>
              <button
                type="button"
                disabled={blocked || !draft.trim()}
                onClick={() => handleOutcome(submitComment(draft))}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  blocked || !draft.trim()
                    ? "cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-600"
                    : "border-emerald-500/60 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                )}
              >
                <SendHorizonal className="h-3.5 w-3.5" />
                Comment
              </button>
            </div>
          </div>
        </div>

        {/* Outcome banner */}
        <AnimatePresence mode="wait">
          {banner && (
            <motion.div
              key={banner.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                banner.kind === "published" &&
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                banner.kind === "blurred" &&
                  "border-amber-500/30 bg-amber-500/10 text-amber-300",
                banner.kind === "held" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
                banner.kind === "cooldown" && "border-amber-500/30 bg-amber-500/10 text-amber-300"
              )}
            >
              {banner.kind === "published" && (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Posted — your comment passed the
                  classifier and is live.
                </>
              )}
              {banner.kind === "blurred" && (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Posted — Auto Word-Blur masked
                  flagged terms as [***].
                </>
              )}
              {banner.kind === "held" && (
                <>
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> Your comment was flagged and
                  routed to the creator&apos;s review queue.
                </>
              )}
              {banner.kind === "cooldown" && (
                <>
                  <Timer className="h-3.5 w-3.5 shrink-0" /> Slow down — friction cooldown is
                  limiting you to {settings.cooldown.maxComments} comments /{" "}
                  {settings.cooldown.windowMinutes} min.
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feed */}
        <ul className="mt-5 space-y-5">
          <AnimatePresence initial={false}>
            {published.map((comment) => (
              <FeedItem key={comment.id} comment={comment} onLike={() => likeComment(comment.id)} />
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <SmartDetoxModal
        request={detox}
        mode={settings.smartDetox.mode}
        onResolve={handleDetoxResolve}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FeedItem({ comment, onLike }: { comment: Comment; onLike: () => void }) {
  const isOwn = comment.author === SESSION_HANDLE;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-start gap-3"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold text-zinc-950"
        style={{ backgroundColor: avatarColor(comment.author) }}
      >
        {initials(comment.author)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("text-xs font-medium", isOwn ? "text-sky-300" : "text-zinc-300")}>
            {comment.author}
          </span>
          <span className="text-[11px] text-zinc-600">{timeAgo(comment.createdAt)}</span>
          {comment.wasRevised && (
            <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1 py-px font-mono text-[8px] tracking-[0.16em] text-emerald-400 uppercase">
              AI revised
            </span>
          )}
          {comment.wasBlurred && (
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-px font-mono text-[8px] tracking-[0.16em] text-amber-400 uppercase">
              auto-censored
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-relaxed break-words text-zinc-200">{comment.text}</p>
        {comment.wasRevised && comment.originalText && (
          <p className="mt-1 border-l-2 border-zinc-800 pl-2 text-[11px] text-zinc-600 italic line-through decoration-red-500/40">
            {comment.originalText}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-4 text-zinc-600">
          <button
            type="button"
            onClick={onLike}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 text-[11px] transition-colors",
              comment.likedByUser ? "text-emerald-400" : "hover:text-zinc-300"
            )}
          >
            <ThumbsUp className={cn("h-3.5 w-3.5", comment.likedByUser && "fill-current")} />
            <span className="font-mono tabular-nums">{comment.likes}</span>
          </button>
          <button type="button" className="cursor-pointer text-[11px] transition-colors hover:text-zinc-300">
            Reply
          </button>
          <button type="button" className="cursor-pointer transition-colors hover:text-zinc-300">
            <Heart className="h-3.5 w-3.5" />
          </button>
          {isOwn && comment.toxicity.overall > 0 && (
            <span
              className={cn(
                "font-mono text-[9px] tracking-wider tabular-nums",
                TONE_TEXT[scoreTone(comment.toxicity.overall)]
              )}
            >
              τ {comment.toxicity.overall.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </motion.li>
  );
}
