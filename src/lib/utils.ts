import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LexiconMatch, ToxicityCategory } from "@/types/moderation";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export function timeAgo(ts: number): string {
  const diff = Math.max(1, Date.now() - ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export const mono = (n: number, digits = 2) => n.toFixed(digits);

export function initials(author: string): string {
  return author
    .replace(/^@/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_HUES = [142, 197, 262, 24, 336, 48, 174, 286, 4, 220];

export function avatarColor(author: string): string {
  let h = 0;
  for (let i = 0; i < author.length; i++) h = (h * 31 + author.charCodeAt(i)) >>> 0;
  const hue = AVATAR_HUES[h % AVATAR_HUES.length];
  return `hsl(${hue} 45% 46%)`;
}

export type ScoreTone = "safe" | "warn" | "danger";

export function scoreTone(score: number): ScoreTone {
  if (score >= 0.66) return "danger";
  if (score >= 0.4) return "warn";
  return "safe";
}

export const TONE_TEXT: Record<ScoreTone, string> = {
  safe: "text-emerald-400",
  warn: "text-amber-400",
  danger: "text-red-400",
};

export const CATEGORY_LABEL: Record<ToxicityCategory, string> = {
  threat: "THREAT",
  insult: "INSULT",
  profanity: "PROFANITY",
  spam: "SPAM",
};

export interface TextSegment {
  text: string;
  category: LexiconMatch["category"] | null;
}

/** Split raw text into flagged / clean segments for inline highlighting. */
export function segmentByMatches(text: string, matches: LexiconMatch[]): TextSegment[] {
  if (!matches.length) return [{ text, category: null }];
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.index > cursor) segments.push({ text: text.slice(cursor, m.index), category: null });
    segments.push({ text: text.slice(m.index, m.index + m.length), category: m.category });
    cursor = m.index + m.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), category: null });
  return segments;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
