/**
 * MUTETOX — pre-populated mock dataset.
 *
 * Simulates the state of a real creator upload: a healthy published thread,
 * a held-for-review backlog organized into semantic clusters, and the
 * default governance configuration. Held comments are scored through the
 * same engine users hit at runtime, so every badge in the queue is real.
 */

import { evaluateComment, collectMatches, assignCluster } from "@/lib/moderationEngine";
import type {
  ClusterGroup,
  Comment,
  CommentStatus,
  CreatorSettings,
} from "@/types/moderation";
import { uid } from "@/lib/utils";

export const DEFAULT_SETTINGS: CreatorSettings = {
  threshold: 0.55,
  categorySensitivity: { threat: 1, insult: 0.9, profanity: 0.8 },
  smartDetox: { enabled: true, mode: "optional" },
  autoBlur: { enabled: false },
  cooldown: { enabled: true, maxComments: 3, windowMinutes: 5 },
  clustering: { enabled: true },
};

export const CLUSTERS: ClusterGroup[] = [
  {
    id: "cluster-audio",
    label: "Audio Complaints",
    summary:
      "Repeated grievances about mix levels, microphone clipping and background music drowning the voiceover.",
    dominantCategory: "insult",
    severity: "medium",
    embeddingSnippet: "ε[0.18, -0.42, 0.77, …]",
    keywords: ["audio", "mix", "mic", "volume", "music"],
  },
  {
    id: "cluster-spam",
    label: "Bot Spam & Self-Promo",
    summary:
      "Coordinated promotional drops: link farms, sub-for-sub solicitations and crypto giveaways.",
    dominantCategory: "spam",
    severity: "high",
    embeddingSnippet: "ε[0.91, 0.12, -0.33, …]",
    keywords: ["free followers", "sub4sub", "crypto", "dm me"],
  },
  {
    id: "cluster-hostility",
    label: "Personal Attacks",
    summary:
      "Direct hostility toward the creator — insults about talent, appearance and credibility.",
    dominantCategory: "profanity",
    severity: "high",
    embeddingSnippet: "ε[-0.55, 0.68, 0.21, …]",
    keywords: ["trash", "talentless", "pathetic", "delete"],
  },
  {
    id: "cluster-abuse",
    label: "Threats & Intimidation",
    summary:
      "Credible threat signals: doxxing hints, intimidation and implied physical harm. Zero tolerance.",
    dominantCategory: "threat",
    severity: "high",
    embeddingSnippet: "ε[-0.84, -0.29, 0.46, …]",
    keywords: ["find you", "watch your back", "regret"],
  },
  {
    id: "cluster-misc",
    label: "General Toxicity",
    summary:
      "Uncategorized low-grade negativity that failed the civility threshold but has no semantic home yet.",
    dominantCategory: "insult",
    severity: "low",
    embeddingSnippet: "ε[0.05, 0.31, -0.12, …]",
    keywords: ["worst", "boring", "fail"],
  },
];

const minutesAgo = (m: number) => Date.now() - m * 60_000;

interface Seed {
  author: string;
  text: string;
  at: number;
  likes: number;
  status: CommentStatus;
}

const PUBLISHED_SEEDS: Seed[] = [
  {
    author: "@lens.and.light",
    text: "The LED wall in the back left is such a smart move — bounce lighting without a single extra fixture. Saved this for my own build.",
    at: minutesAgo(3),
    likes: 214,
    status: "published",
  },
  {
    author: "@grainframe",
    text: "48 hours is insane turnaround. The cable management under the desk deserves its own tutorial honestly.",
    at: minutesAgo(11),
    likes: 96,
    status: "published",
  },
  {
    author: "@audio.dave",
    text: "Notice you kept the room slightly live instead of deadening everything. Bold choice but the dialogue sounds natural because of it.",
    at: minutesAgo(26),
    likes: 61,
    status: "published",
  },
  {
    author: "@mara.cuts",
    text: "The match cut from bare drywall to finished set at 14:32 was so satisfying. Editing keeps getting sharper every upload.",
    at: minutesAgo(48),
    likes: 143,
    status: "published",
  },
  {
    author: "@benchbuilt",
    text: "Curious about the acoustic panel spacing — did you measure first reflection points or just eyeball the grid? Either way it looks clean.",
    at: minutesAgo(90),
    likes: 38,
    status: "published",
  },
  {
    author: "@setlife.sam",
    text: "Respect for showing the mistakes too. The part where the truss sagged and you had to re-rig everything was the most useful segment.",
    at: minutesAgo(160),
    likes: 87,
    status: "published",
  },
  {
    author: "@quietmode",
    text: "Watching this while procrastinating my own studio cleanup. The guilt is motivating though, shelf install starts tomorrow.",
    at: minutesAgo(240),
    likes: 52,
    status: "published",
  },
];

const HELD_SEEDS: Seed[] = [
  {
    author: "@basshead99",
    text: "Your audio is TRASH again. The music drowns your voice completely, learn to mix you idiot.",
    at: minutesAgo(6),
    likes: 0,
    status: "held",
  },
  {
    author: "@nullrenderer",
    text: "Is the mic broken or are your ears? This mix is garbage and the hiss at 9:20 is pathetic.",
    at: minutesAgo(18),
    likes: 0,
    status: "held",
  },
  {
    author: "@flatfreq",
    text: "Nobody cares about the lights when the sound sucks this much. Fix the audio, damn.",
    at: minutesAgo(33),
    likes: 0,
    status: "held",
  },
  {
    author: "@growthbot_iris",
    text: "Great video!! FREE FOLLOWERS for small creators, check out my channel https://boostly.click/xk2 — sub4sub always on.",
    at: minutesAgo(9),
    likes: 0,
    status: "held",
  },
  {
    author: "@defi_don",
    text: "DM me on telegram for the crypto giveaway, 10x guaranteed. Real ones know. https://t.me/airdrop_king",
    at: minutesAgo(21),
    likes: 0,
    status: "held",
  },
  {
    author: "@promo.paul",
    text: "Nice edit. Check out my channel for the full breakdown, free subs and views for anyone who joins!! https://promopaul.tv",
    at: minutesAgo(44),
    likes: 0,
    status: "held",
  },
  {
    author: "@rawtakes",
    text: "You are a talentless hack, Marco. This channel is a waste of time and everyone pretending otherwise is a clown.",
    at: minutesAgo(14),
    likes: 0,
    status: "held",
  },
  {
    author: "@exitvector",
    text: "Absolute bullshit content. Delete your channel loser, you suck at the one thing you claim to teach.",
    at: minutesAgo(57),
    likes: 0,
    status: "held",
  },
  {
    author: "@sidewindow",
    text: "I know where that studio is. Watch your back, Marco — you will regret scamming sponsors.",
    at: minutesAgo(27),
    likes: 0,
    status: "held",
  },
  {
    author: "@yawn.performer",
    text: "WORST video this year, 22 minutes of boring nothing. Total fail from start to finish.",
    at: minutesAgo(71),
    likes: 0,
    status: "held",
  },
];

function seedComment(seed: Seed): Comment {
  const toxicity = evaluateComment(seed.text, DEFAULT_SETTINGS);
  const matches = collectMatches(seed.text);
  return {
    id: uid(),
    author: seed.author,
    text: seed.text,
    originalText: null,
    status: seed.status,
    createdAt: seed.at,
    likes: seed.likes,
    likedByUser: false,
    wasRevised: false,
    wasBlurred: false,
    toxicity,
    matches,
    clusterId: seed.status === "held" ? assignCluster(seed.text, toxicity) : null,
  };
}

export function buildSeedComments(): Comment[] {
  return [...PUBLISHED_SEEDS.map(seedComment), ...HELD_SEEDS.map(seedComment)];
}

export interface SeedState {
  comments: Comment[];
  clusters: ClusterGroup[];
  settings: CreatorSettings;
  userTimestamps: number[];
}

export function buildSeedState(): SeedState {
  return {
    comments: buildSeedComments(),
    clusters: CLUSTERS.map((c) => ({ ...c })),
    settings: structuredClone(DEFAULT_SETTINGS),
    userTimestamps: [],
  };
}
