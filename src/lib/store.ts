"use client";

/**
 * MUTETOX — global governance store (Zustand).
 *
 * Single source of truth for creator settings, every comment in the
 * pipeline, cooldown bookkeeping and cluster state. All three views
 * (Public / Queue / Settings) subscribe to this store, so a toggle flip
 * or a bulk purge is reflected everywhere immediately. Persisted to
 * localStorage so the moderator's world survives reloads.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  assignCluster,
  evaluateComment,
  evaluateSubmission,
} from "@/lib/moderationEngine";
import { buildSeedState, DEFAULT_SETTINGS } from "@/lib/mockData";
import { uid } from "@/lib/utils";
import type {
  BulkAction,
  ClusterGroup,
  Comment,
  CreatorSettings,
  SubmitOutcome,
  ToxicityCategory,
  Verdict,
} from "@/types/moderation";

export const SESSION_HANDLE = "@you";

interface ModerationState {
  comments: Comment[];
  clusters: ClusterGroup[];
  settings: CreatorSettings;
  /** Epoch ms of the session user's recent posts, used for friction cooldowns. */
  userTimestamps: number[];

  /* Settings ------------------------------------------------------- */
  updateSettings: (patch: Partial<CreatorSettings>) => void;
  setThreshold: (value: number) => void;
  setCategorySensitivity: (category: "threat" | "insult" | "profanity", value: number) => void;
  setSmartDetox: (patch: Partial<CreatorSettings["smartDetox"]>) => void;
  setAutoBlur: (patch: Partial<CreatorSettings["autoBlur"]>) => void;
  setCooldown: (patch: Partial<CreatorSettings["cooldown"]>) => void;
  setClustering: (patch: Partial<CreatorSettings["clustering"]>) => void;

  /* Engine --------------------------------------------------------- */
  evaluateText: (text: string) => Verdict;
  submitComment: (text: string) => SubmitOutcome;
  resolveDetox: (
    draft: string,
    verdict: Verdict,
    choice: "revision" | "original" | "discard"
  ) => Comment | null;

  /* Queue ---------------------------------------------------------- */
  approveComment: (id: string) => void;
  deleteComment: (id: string) => void;
  bulkCluster: (clusterId: string, action: BulkAction) => number;
  likeComment: (id: string) => void;
  resetDemo: () => void;
}

function makeComment(partial: {
  text: string;
  originalText: string | null;
  status: Comment["status"];
  verdict: Verdict;
  revised?: boolean;
  blurred?: boolean;
  clusterOn?: boolean;
}): Comment {
  return {
    id: uid(),
    author: SESSION_HANDLE,
    text: partial.text,
    originalText: partial.originalText,
    status: partial.status,
    createdAt: Date.now(),
    likes: 0,
    likedByUser: false,
    wasRevised: partial.revised ?? false,
    wasBlurred: partial.blurred ?? false,
    toxicity: partial.verdict.breakdown,
    matches: partial.verdict.matches,
    clusterId:
      partial.status === "held" && partial.clusterOn
        ? assignCluster(partial.originalText ?? partial.text, partial.verdict.breakdown)
        : null,
  };
}

export const useModerationStore = create<ModerationState>()(
  persist(
    (set, get) => ({
      ...buildSeedState(),

      /* Settings ---------------------------------------------------- */
      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      setThreshold: (value) =>
        set((s) => ({
          settings: { ...s.settings, threshold: Math.min(1, Math.max(0, value)) },
        })),

      setCategorySensitivity: (category, value) =>
        set((s) => ({
          settings: {
            ...s.settings,
            categorySensitivity: {
              ...s.settings.categorySensitivity,
              [category]: Math.min(1, Math.max(0, value)),
            },
          },
        })),

      setSmartDetox: (patch) =>
        set((s) => ({
          settings: { ...s.settings, smartDetox: { ...s.settings.smartDetox, ...patch } },
        })),

      setAutoBlur: (patch) =>
        set((s) => ({
          settings: { ...s.settings, autoBlur: { ...s.settings.autoBlur, ...patch } },
        })),

      setCooldown: (patch) =>
        set((s) => ({
          settings: { ...s.settings, cooldown: { ...s.settings.cooldown, ...patch } },
        })),

      setClustering: (patch) =>
        set((s) => ({
          settings: { ...s.settings, clustering: { ...s.settings.clustering, ...patch } },
        })),

      /* Engine ------------------------------------------------------ */
      evaluateText: (text) => evaluateSubmission(text, get().settings),

      submitComment: (raw) => {
        const text = raw.trim();
        if (!text) return { kind: "empty" };
        const { settings, userTimestamps } = get();

        /* Stage 0 — friction-based cooldown */
        if (settings.cooldown.enabled) {
          const windowMs = settings.cooldown.windowMinutes * 60_000;
          const now = Date.now();
          const recent = userTimestamps.filter((t) => now - t < windowMs);
          if (recent.length >= settings.cooldown.maxComments) {
            const oldest = Math.min(...recent);
            const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
            set({ userTimestamps: recent });
            return { kind: "cooldown", retryAfterSeconds };
          }
          set({ userTimestamps: recent });
        }

        /* Stage 1 — toxicity classification + routing */
        const verdict = evaluateSubmission(text, settings);

        if (verdict.action === "publish") {
          const comment = makeComment({ text, originalText: null, status: "published", verdict });
          set((s) => ({
            comments: [comment, ...s.comments],
            userTimestamps: [...s.userTimestamps, comment.createdAt],
          }));
          return { kind: "published", comment };
        }

        if (verdict.action === "blur-publish") {
          const comment = makeComment({
            text: verdict.blurredText,
            originalText: text,
            status: "published",
            verdict,
            blurred: true,
          });
          set((s) => ({
            comments: [comment, ...s.comments],
            userTimestamps: [...s.userTimestamps, comment.createdAt],
          }));
          return { kind: "blurred", comment };
        }

        if (verdict.action === "detox-modal") {
          // Intercepted — awaiting the viewer's decision in the Smart De-Tox modal.
          return { kind: "detox", verdict, draft: text };
        }

        const comment = makeComment({
          text,
          originalText: null,
          status: "held",
          verdict,
          clusterOn: settings.clustering.enabled,
        });
        set((s) => ({
          comments: [comment, ...s.comments],
          userTimestamps: [...s.userTimestamps, comment.createdAt],
        }));
        return { kind: "held", comment };
      },

      resolveDetox: (draft, verdict, choice) => {
        if (choice === "discard") return null;
        const { settings } = get();

        if (choice === "revision") {
          const comment = makeComment({
            text: verdict.rephrase,
            originalText: draft,
            status: "published",
            verdict,
            revised: true,
          });
          set((s) => ({
            comments: [comment, ...s.comments],
            userTimestamps: [...s.userTimestamps, comment.createdAt],
          }));
          return comment;
        }

        // choice === "original" → routed to Held for Review (only reachable in Optional mode).
        const comment = makeComment({
          text: draft,
          originalText: null,
          status: "held",
          verdict,
          clusterOn: settings.clustering.enabled,
        });
        set((s) => ({
          comments: [comment, ...s.comments],
          userTimestamps: [...s.userTimestamps, comment.createdAt],
        }));
        return comment;
      },

      /* Queue ------------------------------------------------------- */
      approveComment: (id) =>
        set((s) => ({
          comments: s.comments.map((c) =>
            c.id === id ? { ...c, status: "published", clusterId: null } : c
          ),
        })),

      deleteComment: (id) =>
        set((s) => ({
          comments: s.comments.map((c) =>
            c.id === id ? { ...c, status: "deleted", clusterId: null } : c
          ),
        })),

      bulkCluster: (clusterId, action) => {
        const ids = get()
          .comments.filter((c) => c.status === "held" && c.clusterId === clusterId)
          .map((c) => c.id);
        if (!ids.length) return 0;
        set((s) => ({
          comments: s.comments.map((c) =>
            ids.includes(c.id)
              ? { ...c, status: action === "approve" ? "published" : "deleted", clusterId: null }
              : c
          ),
        }));
        return ids.length;
      },

      likeComment: (id) =>
        set((s) => ({
          comments: s.comments.map((c) =>
            c.id === id
              ? {
                  ...c,
                  likedByUser: !c.likedByUser,
                  likes: c.likes + (c.likedByUser ? -1 : 1),
                }
              : c
          ),
        })),

      resetDemo: () => set({ ...buildSeedState() }),
    }),
    {
      name: "mutetox-governance-v1",
      version: 1,
    }
  )
);

/* ------------------------------------------------------------------ */
/* Derived selectors                                                   */
/* ------------------------------------------------------------------ */

export const selectPublished = (s: { comments: Comment[] }) =>
  s.comments.filter((c) => c.status === "published");

export const selectHeld = (s: { comments: Comment[] }) =>
  s.comments.filter((c) => c.status === "held");

export const selectDeleted = (s: { comments: Comment[] }) =>
  s.comments.filter((c) => c.status === "deleted");

export function clusterCount(comments: Comment[], clusterId: string): number {
  return comments.filter((c) => c.status === "held" && c.clusterId === clusterId).length;
}

export function reEvaluateForSettings(comments: Comment[], settings: CreatorSettings) {
  /** Re-scores held originals — used by the settings sandbox preview. */
  return comments.map((c) => ({ id: c.id, score: evaluateComment(c.text, settings).overall }));
}

export type { ToxicityCategory };
export { DEFAULT_SETTINGS };
