"use client";

/**
 * Creator Queue — held comments in two lenses.
 *
 * Itemized: every held draft with full classifier breakdown and per-item
 * approve/delete. Clusters: simulated-embedding groups with one-click bulk
 * actions that permanently rewrite the store. Stats strip stays live while
 * actions land.
 */

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  Boxes,
  CheckCheck,
  Layers,
  ListChecks,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useModerationStore } from "@/lib/store";
import { avatarColor, cn, initials, mono, scoreTone, timeAgo } from "@/lib/utils";
import { HighlightedText, Panel, ScoreBadge } from "@/components/ui";
import type { ClusterGroup, Comment } from "@/types/moderation";

type QueueTab = "itemized" | "clusters";

const SEVERITY_STYLES: Record<ClusterGroup["severity"], string> = {
  high: "border-red-500/40 bg-red-500/10 text-red-400",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  low: "border-zinc-700 bg-zinc-800/60 text-zinc-400",
};

export function ModerationQueue() {
  const comments = useModerationStore((s) => s.comments);
  const clusters = useModerationStore((s) => s.clusters);
  const clusteringEnabled = useModerationStore((s) => s.settings.clustering.enabled);
  const approveComment = useModerationStore((s) => s.approveComment);
  const deleteComment = useModerationStore((s) => s.deleteComment);
  const bulkCluster = useModerationStore((s) => s.bulkCluster);

  const [tab, setTab] = useState<QueueTab>("itemized");
  const [toast, setToast] = useState<{ id: number; text: string; tone: "ok" | "danger" } | null>(
    null
  );

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const held = useMemo(
    () => comments.filter((c) => c.status === "held").sort((a, b) => b.createdAt - a.createdAt),
    [comments]
  );
  const publishedCount = useMemo(
    () => comments.filter((c) => c.status === "published").length,
    [comments]
  );
  const deletedCount = useMemo(
    () => comments.filter((c) => c.status === "deleted").length,
    [comments]
  );
  const avgToxicity = useMemo(
    () => (held.length ? held.reduce((acc, c) => acc + c.toxicity.overall, 0) / held.length : 0),
    [held]
  );

  const clusterMembers = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const c of held) {
      if (!c.clusterId) continue;
      const list = map.get(c.clusterId) ?? [];
      list.push(c);
      map.set(c.clusterId, list);
    }
    return map;
  }, [held]);

  const activeClusters = clusters.filter((c) => (clusterMembers.get(c.id) ?? []).length > 0);
  const ungrouped = held.filter((c) => !c.clusterId).length;

  function handleBulk(cluster: ClusterGroup, action: "approve" | "delete") {
    const n = bulkCluster(cluster.id, action);
    if (n > 0) {
      setToast({
        id: Date.now(),
        tone: action === "delete" ? "danger" : "ok",
        text:
          action === "delete"
            ? `Purged ${n} comment${n === 1 ? "" : "s"} from “${cluster.label}”`
            : `Approved and published ${n} comment${n === 1 ? "" : "s"} from “${cluster.label}”`,
      });
    }
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------ Stats strip */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
        {[
          { label: "HELD FOR REVIEW", value: held.length, tone: "text-amber-400" },
          { label: "PUBLISHED", value: publishedCount, tone: "text-emerald-400" },
          { label: "PERMANENTLY DELETED", value: deletedCount, tone: "text-red-400" },
          {
            label: "AVG HELD TOXICITY",
            value: mono(avgToxicity),
            tone: held.length ? "text-amber-400" : "text-zinc-500",
            mono: true,
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900 px-4 py-3.5">
            <p className="font-mono text-[9px] tracking-[0.18em] text-zinc-500 uppercase">
              {stat.label}
            </p>
            <p
              className={cn(
                "mt-1 text-2xl font-medium tracking-tight tabular-nums",
                stat.mono ? "font-mono" : "",
                stat.tone
              )}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------ Tabs + toast */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border border-zinc-800 bg-zinc-900 p-1">
          {(
            [
              ["itemized", `Itemized`, held.length, ListChecks],
              ["clusters", `Clustered`, activeClusters.length, Boxes],
            ] as const
          ).map(([key, label, count, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-[4px] px-3.5 py-1.5 text-xs font-medium transition-colors",
                tab === key ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <span
                className={cn(
                  "rounded px-1 font-mono text-[10px] tabular-nums",
                  tab === key ? "bg-zinc-950 text-zinc-300" : "text-zinc-600"
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs",
                toast.tone === "danger"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              )}
            >
              {toast.tone === "danger" ? (
                <Trash2 className="h-3.5 w-3.5" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5" />
              )}
              {toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ------------------------------------------------ Views */}
      {tab === "itemized" ? (
        held.length === 0 ? (
          <EmptyState
            title="Queue clear"
            body="No comments are currently held for review. Flagged submissions will land here."
          />
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {held.map((comment) => (
                <HeldRow
                  key={comment.id}
                  comment={comment}
                  clusterLabel={clusters.find((c) => c.id === comment.clusterId)?.label ?? null}
                  onApprove={() => approveComment(comment.id)}
                  onDelete={() => deleteComment(comment.id)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )
      ) : !clusteringEnabled ? (
        <Panel className="border-dashed">
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <Ban className="h-6 w-6 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-300">Cluster aggregation is disabled</p>
            <p className="max-w-md text-xs leading-relaxed text-zinc-500">
              Enable <span className="font-mono text-zinc-300">LLM Cluster Aggregation</span> in
              Settings &amp; Governance to embed held comments into semantic cards. Itemized review
              remains available.
            </p>
          </div>
        </Panel>
      ) : activeClusters.length === 0 ? (
        <EmptyState
          title="No active clusters"
          body="Held comments will be embedded into semantic groups as they arrive."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {activeClusters.map((cluster) => (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                members={clusterMembers.get(cluster.id) ?? []}
                onApprove={() => handleBulk(cluster, "approve")}
                onDelete={() => handleBulk(cluster, "delete")}
              />
            ))}
          </AnimatePresence>
          {ungrouped > 0 && (
            <p className="col-span-full font-mono text-[10px] tracking-[0.14em] text-zinc-600 uppercase">
              + {ungrouped} ungrouped item{ungrouped === 1 ? "" : "s"} visible in itemized view
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function HeldRow({
  comment,
  clusterLabel,
  onApprove,
  onDelete,
}: {
  comment: Comment;
  clusterLabel: string | null;
  onApprove: () => void;
  onDelete: () => void;
}) {
  const tone = scoreTone(comment.toxicity.overall);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
      transition={{ duration: 0.22 }}
      className="rounded-md border border-zinc-800 bg-zinc-900"
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-zinc-800/70 px-4 py-2.5">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[9px] font-semibold text-zinc-950"
          style={{ backgroundColor: avatarColor(comment.author) }}
        >
          {initials(comment.author)}
        </span>
        <span className="text-xs font-medium text-zinc-200">{comment.author}</span>
        <span className="text-[11px] text-zinc-600">{timeAgo(comment.createdAt)}</span>
        {clusterLabel && (
          <span className="rounded border border-zinc-700 bg-zinc-800/70 px-1.5 py-px font-mono text-[9px] tracking-[0.12em] text-zinc-400 uppercase">
            <Layers className="mr-1 inline h-2.5 w-2.5" />
            {clusterLabel}
          </span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {comment.toxicity.flagged.map((f) => (
            <ScoreBadge key={f.category} category={f.category} score={f.score} compact />
          ))}
          <ScoreBadge category="OVERALL" score={comment.toxicity.overall} compact />
        </span>
      </div>
      <div className="px-4 py-3">
        <HighlightedText
          text={comment.text}
          matches={comment.matches}
          className="text-sm leading-relaxed break-words text-zinc-300"
        />
      </div>
      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-b-md border-t px-4 py-2.5",
          tone === "danger"
            ? "border-red-500/20 bg-red-500/[0.05]"
            : "border-zinc-800/70 bg-zinc-950/40"
        )}
      >
        <span className="font-mono text-[9px] tracking-[0.16em] text-zinc-600 uppercase">
          {tone === "danger"
            ? "high-severity signal — recommended action: delete"
            : "held by classifier — awaiting creator decision"}
        </span>
        <span className="flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="flex cursor-pointer items-center gap-1.5 rounded border border-emerald-500/50 bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/15"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Approve &amp; Publish
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex cursor-pointer items-center gap-1.5 rounded border border-red-500/50 bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/15"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Permanently Delete
          </button>
        </span>
      </div>
    </motion.li>
  );
}

/* ------------------------------------------------------------------ */

function ClusterCard({
  cluster,
  members,
  onApprove,
  onDelete,
}: {
  cluster: ClusterGroup;
  members: Comment[];
  onApprove: () => void;
  onDelete: () => void;
}) {
  const avg =
    members.length > 0
      ? members.reduce((acc, m) => acc + m.toxicity.overall, 0) / members.length
      : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ duration: 0.24 }}
      className="flex flex-col rounded-md border border-zinc-800 bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800/70 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">{cluster.label}</p>
          <p className="mt-0.5 font-mono text-[9px] tracking-[0.14em] text-zinc-600">
            {cluster.embeddingSnippet}
          </p>
        </div>
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.18em] uppercase",
            SEVERITY_STYLES[cluster.severity]
          )}
        >
          {cluster.severity}
        </span>
      </div>

      <div className="flex-1 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-medium text-zinc-100 tabular-nums">
            {members.length}
          </span>
          <span className="font-mono text-[10px] tracking-[0.14em] text-zinc-500 uppercase">
            held · avg τ {mono(avg)}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{cluster.summary}</p>

        <div className="mt-3 space-y-1.5">
          {members.slice(0, 2).map((m) => (
            <p
              key={m.id}
              className="truncate rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1.5 text-[11px] text-zinc-400 italic"
            >
              “{m.text}”
            </p>
          ))}
          {members.length > 2 && (
            <p className="px-0.5 font-mono text-[9px] tracking-[0.14em] text-zinc-600 uppercase">
              +{members.length - 2} more in this cluster
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {cluster.keywords.map((k) => (
            <span
              key={k}
              className="rounded border border-zinc-800 px-1.5 py-px font-mono text-[9px] text-zinc-500"
            >
              {k}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2 border-t border-zinc-800/70 bg-zinc-950/40 px-4 py-3">
        <button
          type="button"
          onClick={onApprove}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border border-emerald-500/50 px-2 py-2 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/15"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Bulk Approve
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border border-red-500/50 bg-red-500/10 px-2 py-2 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Bulk Delete Cluster
        </button>
      </div>
    </motion.div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Panel className="border-dashed">
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <ShieldCheck className="h-6 w-6 text-emerald-500/60" />
        <p className="text-sm font-medium text-zinc-300">{title}</p>
        <p className="max-w-md text-xs leading-relaxed text-zinc-500">{body}</p>
        <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.16em] text-zinc-600 uppercase">
          <TrendingUp className="h-3 w-3" /> real-time sync with public thread
        </span>
      </div>
    </Panel>
  );
}
