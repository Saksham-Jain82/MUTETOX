/**
 * MUTETOX — Creator Comment Governance & AI Moderation Engine
 * Core domain types shared across the store, engine and UI layers.
 */

export type CommentStatus = "published" | "held" | "deleted";

export type ToxicityCategory = "threat" | "insult" | "profanity" | "spam";

export type DetoxMode = "strict" | "optional";

export type ClusterSeverity = "low" | "medium" | "high";

/** A single category signal raised by the classifier. */
export interface CategoryFlag {
  category: ToxicityCategory;
  score: number; // 0..1, adjusted by creator sensitivity
}

/** Full score breakdown produced by the simulated NLP classifier. */
export interface ToxicityBreakdown {
  overall: number; // 0..1 composite score
  threat: number;
  insult: number;
  profanity: number;
  spam: number;
  topCategory: ToxicityCategory | null;
  flagged: CategoryFlag[]; // categories >= 0.2, sorted descending
}

/** A lexical span in the original text that tripped the classifier. */
export interface LexiconMatch {
  word: string;
  category: ToxicityCategory;
  index: number; // start offset in the original text
  length: number;
}

export interface Comment {
  id: string;
  author: string;
  text: string; // text currently shown / stored
  originalText: string | null; // set when text was revised or blurred
  status: CommentStatus;
  createdAt: number; // epoch ms
  likes: number;
  likedByUser: boolean;
  wasRevised: boolean; // posted via Smart De-Tox AI revision
  wasBlurred: boolean; // posted via Auto Word-Blur
  toxicity: ToxicityBreakdown;
  matches: LexiconMatch[]; // highlighted spans (original text coordinates)
  clusterId: string | null;
}

export interface SmartDetoxSettings {
  enabled: boolean;
  mode: DetoxMode; // strict = original may never post, optional = original routes to review
}

export interface AutoBlurSettings {
  enabled: boolean;
}

export interface CooldownSettings {
  enabled: boolean;
  maxComments: number; // e.g. 3
  windowMinutes: number; // e.g. 5
}

export interface ClusterSettings {
  enabled: boolean;
}

export interface CreatorSettings {
  /** Global hold threshold 0.0 – 1.0. Comments scoring >= threshold are intercepted. */
  threshold: number;
  /** Granular per-category amplifier (0 – 1) applied before compositing. */
  categorySensitivity: Record<"threat" | "insult" | "profanity", number>;
  smartDetox: SmartDetoxSettings;
  autoBlur: AutoBlurSettings;
  cooldown: CooldownSettings;
  clustering: ClusterSettings;
}

/** A simulated semantic embedding cluster over held comments. */
export interface ClusterGroup {
  id: string;
  label: string;
  summary: string;
  dominantCategory: ToxicityCategory;
  severity: ClusterSeverity;
  /** Decorative simulated centroid snippet, rendered monospace. */
  embeddingSnippet: string;
  keywords: string[];
}

export type VerdictAction = "publish" | "blur-publish" | "detox-modal" | "hold";

/** Full evaluation of one draft against the active governance policy. */
export interface Verdict {
  breakdown: ToxicityBreakdown;
  matches: LexiconMatch[];
  blurredText: string;
  blurredCount: number;
  rephrase: string;
  aboveThreshold: boolean;
  action: VerdictAction;
}

export type SubmitOutcome =
  | { kind: "published"; comment: Comment }
  | { kind: "blurred"; comment: Comment }
  | { kind: "held"; comment: Comment }
  | { kind: "detox"; verdict: Verdict; draft: string }
  | { kind: "cooldown"; retryAfterSeconds: number }
  | { kind: "empty" };

export type BulkAction = "approve" | "delete";
