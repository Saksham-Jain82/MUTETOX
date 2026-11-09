/**
 * MUTETOX — simulated NLP moderation engine.
 *
 * A deterministic, lexicon-driven stand-in for a neural toxicity classifier.
 * It scores four independent category heads (threat / insult / profanity /
 * spam), applies creator category sensitivity, composites an overall score,
 * and exposes word-blurring + polite-rephrase transformers used by the
 * Smart De-Tox pipeline.
 */

import type {
  CreatorSettings,
  LexiconMatch,
  ToxicityBreakdown,
  ToxicityCategory,
  Verdict,
} from "@/types/moderation";

/* ------------------------------------------------------------------ */
/* Lexicons                                                            */
/* ------------------------------------------------------------------ */

interface LexiconEntry {
  pattern: RegExp;
  weight: number;
}

const PROFANITY: LexiconEntry[] = [
  { pattern: /\bbullshit\b/gi, weight: 0.66 },
  { pattern: /\bf+u+c+k+(ing|ed)?\b/gi, weight: 0.78 },
  { pattern: /\bshit(ty)?\b/gi, weight: 0.56 },
  { pattern: /\bpiss(ed)?\b/gi, weight: 0.42 },
  { pattern: /\bdamn+\b/gi, weight: 0.3 },
  { pattern: /\bhell\b/gi, weight: 0.24 },
  { pattern: /\bcrap(py)?\b/gi, weight: 0.34 },
  { pattern: /\bsuck(s|ed)?\b/gi, weight: 0.34 },
  { pattern: /\bscrew (you|this)\b/gi, weight: 0.46 },
  { pattern: /\bass(hat|hole)?\b/gi, weight: 0.5 },
];

const INSULT: LexiconEntry[] = [
  { pattern: /\bidiot(s)?\b/gi, weight: 0.62 },
  { pattern: /\bmoron(s)?\b/gi, weight: 0.66 },
  { pattern: /\bclown(s)?\b/gi, weight: 0.46 },
  { pattern: /\bhack(s)?\b/gi, weight: 0.5 },
  { pattern: /\bpathetic\b/gi, weight: 0.58 },
  { pattern: /\bloser(s)?\b/gi, weight: 0.56 },
  { pattern: /\bstupid\b/gi, weight: 0.46 },
  { pattern: /\bdumb(ass)?\b/gi, weight: 0.44 },
  { pattern: /\btalentless\b/gi, weight: 0.62 },
  { pattern: /\bgarbage\b/gi, weight: 0.4 },
  { pattern: /\btrash\b/gi, weight: 0.36 },
  { pattern: /\bworthless\b/gi, weight: 0.6 },
  { pattern: /\bnobody cares\b/gi, weight: 0.38 },
  { pattern: /\bwaste of time\b/gi, weight: 0.4 },
  { pattern: /\bdelete (your|this|ur) (channel|account|video)\b/gi, weight: 0.6 },
  { pattern: /\bcringe\b/gi, weight: 0.3 },
  { pattern: /\bfail(ing)?\b/gi, weight: 0.26 },
  { pattern: /\bworst\b/gi, weight: 0.3 },
  { pattern: /\bbroke(n)? (audio|mic|sound)\b/gi, weight: 0.18 },
];

const THREAT: LexiconEntry[] = [
  { pattern: /\bwatch your back\b/gi, weight: 0.9 },
  { pattern: /\b(i will|i'?ll|gonna) find (you|u)\b/gi, weight: 0.86 },
  { pattern: /\bcome to your (studio|house|place)\b/gi, weight: 0.82 },
  { pattern: /\bbeat (some sense into|up)\b/gi, weight: 0.78 },
  { pattern: /\bhurt (you|u)\b/gi, weight: 0.74 },
  { pattern: /\byou'?ll regret\b/gi, weight: 0.66 },
  { pattern: /\bexpose you\b/gi, weight: 0.58 },
  { pattern: /\byou'?re done\b/gi, weight: 0.6 },
  { pattern: /\byour days are numbered\b/gi, weight: 0.88 },
  { pattern: /\bread the comments and weep\b/gi, weight: 0.3 },
];

const SPAM: LexiconEntry[] = [
  { pattern: /https?:\/\/\S+/gi, weight: 0.5 },
  { pattern: /\bcheck (out )?my (channel|page|profile)\b/gi, weight: 0.58 },
  { pattern: /\bfree (followers|subs|views)\b/gi, weight: 0.82 },
  { pattern: /\bsub ?4 ?sub\b/gi, weight: 0.78 },
  { pattern: /\bcrypto( |$)|bitcoin|nft drop/gi, weight: 0.62 },
  { pattern: /\bdm me\b/gi, weight: 0.5 },
  { pattern: /\bgiveaway\b/gi, weight: 0.44 },
  { pattern: /\b(whats ?app|telegram)\b/gi, weight: 0.62 },
  { pattern: /(.)\1{6,}/gi, weight: 0.34 },
];

const CATEGORY_LEXICONS: Record<ToxicityCategory, LexiconEntry[]> = {
  threat: THREAT,
  insult: INSULT,
  profanity: PROFANITY,
  spam: SPAM,
};

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Deterministic pseudo-noise so scores feel model-like without randomness. */
function semanticJitter(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return ((h % 13) - 6) / 100; // ±0.06
}

export function collectMatches(text: string): LexiconMatch[] {
  const raw: LexiconMatch[] = [];
  (Object.keys(CATEGORY_LEXICONS) as ToxicityCategory[]).forEach((category) => {
    for (const { pattern } of CATEGORY_LEXICONS[category]) {
      const re = new RegExp(pattern.source, pattern.flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        raw.push({ word: m[0], category, index: m.index, length: m[0].length });
      }
    }
  });
  // De-dupe overlapping spans, keep earliest/longest.
  raw.sort((a, b) => a.index - b.index || b.length - a.length);
  const kept: LexiconMatch[] = [];
  let cursor = -1;
  for (const match of raw) {
    if (match.index >= cursor) {
      kept.push(match);
      cursor = match.index + match.length;
    }
  }
  return kept;
}

export function evaluateComment(
  text: string,
  settings: CreatorSettings
): ToxicityBreakdown {
  const raw: Record<ToxicityCategory, number> = {
    threat: 0,
    insult: 0,
    profanity: 0,
    spam: 0,
  };

  (Object.keys(CATEGORY_LEXICONS) as ToxicityCategory[]).forEach((category) => {
    for (const { pattern, weight } of CATEGORY_LEXICONS[category]) {
      const re = new RegExp(pattern.source, pattern.flags);
      const hits = text.match(re);
      if (hits) raw[category] += weight * (1 + (hits.length - 1) * 0.5);
    }
  });

  // Delivery heuristics: shouting + punctuation floods.
  const words = text.split(/\s+/).filter(Boolean);
  const upper = words.filter((w) => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w)).length;
  const capsRatio = words.length ? upper / words.length : 0;
  if (capsRatio > 0.45) raw.insult += 0.18;
  if (/!{3,}/.test(text)) raw.insult += 0.1;
  if (/\byou\b/i.test(text) && raw.insult > 0) raw.insult += 0.08; // directed hostility

  const threat = clamp01(raw.threat * settings.categorySensitivity.threat);
  const insult = clamp01(raw.insult * settings.categorySensitivity.insult);
  const profanity = clamp01(raw.profanity * settings.categorySensitivity.profanity);
  const spam = clamp01(raw.spam); // spam always runs at full weight

  const adjusted = { threat, insult, profanity, spam };
  const entries = Object.entries(adjusted) as [ToxicityCategory, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const topCategory = entries[0][1] >= 0.2 ? entries[0][0] : null;

  const mean = (threat + insult + profanity + spam) / 4;
  const composite = clamp01(entries[0][1] * 0.82 + mean * 0.18 + semanticJitter(text) * (topCategory ? 1 : 0));

  return {
    overall: round2(composite),
    threat: round2(threat),
    insult: round2(insult),
    profanity: round2(profanity),
    spam: round2(spam),
    topCategory,
    flagged: entries
      .filter(([, score]) => score >= 0.2)
      .map(([category, score]) => ({ category, score: round2(score) })),
  };
}

/* ------------------------------------------------------------------ */
/* Word blurring                                                       */
/* ------------------------------------------------------------------ */

const BLUR_LEXICONS: LexiconEntry[][] = [PROFANITY, INSULT, THREAT];

export function blurToxicWords(text: string): { text: string; count: number } {
  let out = text;
  let count = 0;
  for (const lexicon of BLUR_LEXICONS) {
    for (const { pattern } of lexicon) {
      const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
      out = out.replace(re, () => {
        count += 1;
        return "[***]";
      });
    }
  }
  // Tidy up duplicate mask runs: "[***], you [***]" stays, "[***] [***]" collapses visually.
  return { text: out.replace(/(\[\*\*\*\])( \[\*\*\*\])+/g, "[***]").trim(), count };
}

/* ------------------------------------------------------------------ */
/* Smart De-Tox rephrasing                                             */
/* ------------------------------------------------------------------ */

const SOFTENERS: [RegExp, string][] = [
  [/\bstfu\b/gi, "let me phrase this calmly"],
  [/\bshut up\b/gi, "hear me out"],
  [/\byou suck\b/gi, "this one didn't land for me"],
  [/\b(idiot|moron|clown|loser|hack)s?\b/gi, "creator"],
  [/\bpathetic\b/gi, "disappointing"],
  [/\b(stupid|dumb)\b/gi, "ill-considered"],
  [/\btalentless\b/gi, "still developing"],
  [/\b(garbage|trash)\b/gi, "not up to your usual standard"],
  [/\bnobody cares\b/gi, "this may not resonate with everyone"],
  [/\bwaste of time\b/gi, "tough watch"],
  [/\bdelete (your|this|ur) (channel|account|video)\b/gi, "rethink the format"],
  [/\bcringe\b/gi, "a bit awkward"],
  [/\bworst\b/gi, "weakest"],
  [/\bbroke(n)? (audio|mic|sound)\b/gi, "uneven $2"],
  [/\bbullshit\b/gi, "hard to believe"],
  [/\bf+u+c+k+(ing|ed)?\b/gi, ""],
  [/\bshit(ty)?\b/gi, "rough"],
  [/\bpiss(ed)?\b/gi, "frustrated"],
  [/\bdamn+\b/gi, "very"],
  [/\bhell\b/gi, "heck"],
  [/\bcrap(py)?\b/gi, "poor"],
  [/\bsuck(s|ed)?\b/gi, "falls short"],
  [/\bscrew (you|this)\b/gi, "I disagree"],
  [/\bass(hat|hole)?\b/gi, ""],
];

function tidySentence(text: string): string {
  let out = text.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
  out = out.replace(/!{2,}/g, "!").replace(/\?{2,}/g, "?");
  if (out && !/[.!?]$/.test(out)) out += ".";
  // De-shout ALL CAPS sentences.
  const letters = out.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 8 && letters === letters.toUpperCase()) {
    out = out.toLowerCase();
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
}

const TOPIC_FRAMES: { test: RegExp; frame: (body: string) => string }[] = [
  {
    test: /\b(audio|sound|mic|volume|mix|music|hear)\b/i,
    frame: (body) =>
      `Honest feedback, respectfully: the audio mix felt off to me — ${body} I'd genuinely love to keep watching if the levels get another pass.`,
  },
  {
    test: /\b(guest|interview|host)\b/i,
    frame: (body) =>
      `Sharing this respectfully: the guest segment didn't work for me — ${body} Maybe a different format next time?`,
  },
  {
    test: /\b(edit|editing|cut|pacing|boring|long)\b/i,
    frame: (body) =>
      `Constructive note: the pacing lost me partway through — ${body} Tighter cuts would keep the energy up.`,
  },
  {
    test: /\b(light|lighting|color|grade|camera|quality|video)\b/i,
    frame: (body) =>
      `Respectful feedback on the visuals: ${body} Your production is usually stronger, so I'm sure the next one will be better.`,
  },
];

export function generateRephrase(text: string): string {
  let cleaned = text;
  for (const [pattern, replacement] of SOFTENERS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  // Drop residual threat phrasing entirely — it cannot be salvaged.
  cleaned = cleaned.replace(/[^.!?]*(watch your back|find (you|u)|come to your (studio|house|place)|beat (some sense into|up)|hurt (you|u))[^.!?]*[.!?]?/gi, "I feel strongly about this. ");
  cleaned = tidySentence(cleaned.replace(/\s{2,}/g, " "));
  if (!cleaned || cleaned === ".") cleaned = "I wanted to flag a concern about this upload";

  for (const topic of TOPIC_FRAMES) {
    if (topic.test.test(text)) {
      return tidySentence(topic.frame(cleaned));
    }
  }
  return tidySentence(
    `Strong opinion here, so let me say it constructively: ${cleaned} I hope this lands as feedback, not an attack.`
  );
}

/* ------------------------------------------------------------------ */
/* Routing (governance policy) + clustering                            */
/* ------------------------------------------------------------------ */

export function evaluateSubmission(text: string, settings: CreatorSettings): Verdict {
  const breakdown = evaluateComment(text, settings);
  const matches = collectMatches(text);
  const { text: blurredText, count: blurredCount } = blurToxicWords(text);
  const aboveThreshold = breakdown.overall >= settings.threshold;

  let action: Verdict["action"] = "publish";
  if (aboveThreshold) {
    if (settings.autoBlur.enabled && blurredCount > 0) action = "blur-publish";
    else if (settings.smartDetox.enabled) action = "detox-modal";
    else action = "hold";
  }

  return {
    breakdown,
    matches,
    blurredText,
    blurredCount,
    rephrase: aboveThreshold ? generateRephrase(text) : text,
    aboveThreshold,
    action,
  };
}

/** Simulated embedding assignment: routes text into a semantic cluster. */
export function assignCluster(text: string, breakdown: ToxicityBreakdown): string {
  const t = text.toLowerCase();
  if (breakdown.spam >= 0.4 || /(https?:|crypto|followers|sub ?4 ?sub|giveaway|dm me)/.test(t)) {
    return "cluster-spam";
  }
  if (/(audio|sound|mic|volume|mix|music|hear|bass)/.test(t)) return "cluster-audio";
  if (breakdown.threat >= 0.4) return "cluster-abuse";
  if (breakdown.insult >= 0.35 || breakdown.profanity >= 0.35) return "cluster-hostility";
  return "cluster-misc";
}
