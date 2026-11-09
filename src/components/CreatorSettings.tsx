"use client";

/**
 * Settings & Governance — the creator's control surface.
 *
 * Every control writes straight into the Zustand store, which the Public
 * view consumes live. Includes a classifier sandbox so creators can probe
 * the scoring pipeline before saving a posture change.
 */

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Gauge,
  RotateCcw,
  ScanText,
  ShieldCheck,
  Timer,
  Wand2,
} from "lucide-react";
import { useModerationStore } from "@/lib/store";
import { cn, mono, scoreTone, TONE_TEXT } from "@/lib/utils";
import { Panel, PanelHeader, Slider, Switch } from "@/components/ui";
import type { ToxicityCategory } from "@/types/moderation";

export function CreatorSettings() {
  const settings = useModerationStore((s) => s.settings);
  const heldCount = useModerationStore((s) => s.comments.filter((c) => c.status === "held").length);
  const setThreshold = useModerationStore((s) => s.setThreshold);
  const setCategorySensitivity = useModerationStore((s) => s.setCategorySensitivity);
  const setSmartDetox = useModerationStore((s) => s.setSmartDetox);
  const setAutoBlur = useModerationStore((s) => s.setAutoBlur);
  const setCooldown = useModerationStore((s) => s.setCooldown);
  const setClustering = useModerationStore((s) => s.setClustering);
  const resetDemo = useModerationStore((s) => s.resetDemo);

  const posture =
    settings.threshold < 0.35 ? "AGGRESSIVE" : settings.threshold < 0.7 ? "BALANCED" : "LENIENT";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* -------------------------------------------- Moderation modules */}
      <Panel className="lg:col-span-2">
        <PanelHeader
          title="Moderation Modules"
          hint="Toggles propagate to the public comment thread instantly — no deploy required."
          right={
            <span className="font-mono text-[10px] tracking-[0.14em] text-zinc-500 uppercase">
              {heldCount} held for review
            </span>
          }
        />
        <div className="grid gap-px bg-zinc-800 sm:grid-cols-2">
          {/* Smart De-Tox */}
          <ModuleCell
            icon={<Wand2 className="h-4 w-4" />}
            name="Smart De-Tox Rewriter"
            description="Intercepts flagged drafts and offers an AI-polished rephrase before anything reaches the thread."
            enabled={settings.smartDetox.enabled}
            onToggle={(v) => setSmartDetox({ enabled: v })}
          >
            <div
              className={cn(
                "mt-3 flex rounded border border-zinc-800 p-0.5 transition-opacity",
                !settings.smartDetox.enabled && "pointer-events-none opacity-40"
              )}
            >
              {(["optional", "strict"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSmartDetox({ mode })}
                  className={cn(
                    "flex-1 cursor-pointer rounded-[3px] px-2 py-1 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors",
                    settings.smartDetox.mode === mode
                      ? mode === "strict"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-amber-500/15 text-amber-400"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
              {settings.smartDetox.mode === "strict"
                ? "Strict — the original can never post; the viewer must accept the revision."
                : "Optional — the viewer may post the original anyway; it lands in your review queue."}
            </p>
          </ModuleCell>

          {/* Auto Word-Blur */}
          <ModuleCell
            icon={<ScanText className="h-4 w-4" />}
            name="Auto-Censoring & Word Blur"
            description="Masks flagged tokens as [***] and publishes immediately. Fastest path, no viewer friction."
            enabled={settings.autoBlur.enabled}
            onToggle={(v) => setAutoBlur({ enabled: v })}
          >
            <p className="mt-3 rounded border border-zinc-800 bg-zinc-950/50 px-2.5 py-2 font-mono text-[11px] text-zinc-500">
              &quot;this mix is <span className="text-amber-400">[***]</span> and you&apos;re a{" "}
              <span className="text-amber-400">[***]</span>&quot;
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
              Takes priority over Smart De-Tox when both are enabled.
            </p>
          </ModuleCell>

          {/* Friction cooldowns */}
          <ModuleCell
            icon={<Timer className="h-4 w-4" />}
            name="Friction-Based Cooldowns"
            description="Rate-limits accounts that post too aggressively. Applies to every viewer, per session."
            enabled={settings.cooldown.enabled}
            onToggle={(v) => setCooldown({ enabled: v })}
          >
            <div
              className={cn(
                "mt-3 flex items-center gap-2 transition-opacity",
                !settings.cooldown.enabled && "pointer-events-none opacity-40"
              )}
            >
              <NumberStepper
                label="Max comments"
                value={settings.cooldown.maxComments}
                min={1}
                max={10}
                onChange={(v) => setCooldown({ maxComments: v })}
              />
              <span className="pt-4 font-mono text-[10px] text-zinc-600">per</span>
              <NumberStepper
                label="Window (min)"
                value={settings.cooldown.windowMinutes}
                min={1}
                max={30}
                onChange={(v) => setCooldown({ windowMinutes: v })}
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
              Current rule: {settings.cooldown.maxComments} comments per{" "}
              {settings.cooldown.windowMinutes} minutes before a forced pause.
            </p>
          </ModuleCell>

          {/* Cluster aggregation */}
          <ModuleCell
            icon={<Boxes className="h-4 w-4" />}
            name="LLM Cluster Aggregation"
            description="Embeds held comments and groups them into semantic cards for one-click bulk actions in the queue."
            enabled={settings.clustering.enabled}
            onToggle={(v) => setClustering({ enabled: v })}
          >
            <p className="mt-3 font-mono text-[10px] tracking-[0.12em] text-zinc-600 uppercase">
              embedding: simulated-ε-128d · cosine k-means
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
              When disabled, new holds skip clustering and the queue&apos;s cluster tab is
              suspended.
            </p>
          </ModuleCell>
        </div>
      </Panel>

      {/* -------------------------------------------- Threshold */}
      <Panel>
        <PanelHeader
          title="Global Toxicity Threshold"
          hint="Drafts scoring at or above τ are intercepted."
          right={
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.18em] uppercase",
                posture === "AGGRESSIVE" && "border-red-500/40 bg-red-500/10 text-red-400",
                posture === "BALANCED" && "border-amber-500/40 bg-amber-500/10 text-amber-400",
                posture === "LENIENT" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              )}
            >
              {posture}
            </span>
          }
        />
        <div className="px-4 py-5">
          <div className="mb-2 flex items-end justify-between">
            <span className="font-mono text-4xl font-medium tracking-tight text-zinc-100 tabular-nums">
              {mono(settings.threshold)}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-zinc-500 uppercase">
              <Gauge className="h-3.5 w-3.5" /> intercept line
            </span>
          </div>
          <Slider
            value={settings.threshold}
            min={0}
            max={1}
            step={0.01}
            onChange={setThreshold}
            ariaLabel="Global toxicity threshold"
          />
          <div className="mt-2 flex justify-between font-mono text-[9px] tracking-[0.16em] text-zinc-600 uppercase">
            <span>0.00 · hold everything</span>
            <span>1.00 · hold nothing</span>
          </div>
        </div>
        <div className="border-t border-zinc-800 px-4 py-4">
          <h4 className="mb-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-zinc-400 uppercase">
            <Activity className="h-3.5 w-3.5" /> Category sensitivity
          </h4>
          <div className="space-y-3">
            {(
              [
                ["threat", "Threat", "text-red-400"],
                ["insult", "Insult", "text-amber-400"],
                ["profanity", "Profanity", "text-orange-400"],
              ] as ["threat" | "insult" | "profanity", string, string][]
            ).map(([key, label, color]) => (
              <div key={key} className="grid grid-cols-[86px_1fr_44px] items-center gap-3">
                <span className={cn("font-mono text-[10px] tracking-[0.14em] uppercase", color)}>
                  {label}
                </span>
                <Slider
                  value={settings.categorySensitivity[key]}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => setCategorySensitivity(key, v)}
                  ariaLabel={`${label} sensitivity`}
                />
                <span className="text-right font-mono text-[11px] text-zinc-300 tabular-nums">
                  {Math.round(settings.categorySensitivity[key] * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* -------------------------------------------- Sandbox */}
      <ClassifierSandbox />

      {/* -------------------------------------------- Danger zone */}
      <Panel className="border-red-500/20 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <div>
              <p className="text-sm font-medium text-zinc-200">Reset demonstration state</p>
              <p className="text-xs text-zinc-500">
                Restores the seeded thread, held backlog, clusters and default governance posture.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetDemo}
            className="flex cursor-pointer items-center gap-1.5 rounded border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset demo data
          </button>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ModuleCell({
  icon,
  name,
  description,
  enabled,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded border transition-colors",
              enabled
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-800 bg-zinc-950 text-zinc-600"
            )}
          >
            {icon}
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-100">{name}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{description}</p>
          </div>
        </div>
        <Switch checked={enabled} onChange={onToggle} label={name} />
      </div>
      {children}
    </div>
  );
}

function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[9px] tracking-[0.14em] text-zinc-500 uppercase">
        {label}
      </span>
      <span className="flex items-center rounded border border-zinc-800">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="cursor-pointer px-2 py-1 font-mono text-xs text-zinc-400 hover:text-zinc-100"
        >
          −
        </button>
        <span className="min-w-8 text-center font-mono text-xs text-zinc-100 tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="cursor-pointer px-2 py-1 font-mono text-xs text-zinc-400 hover:text-zinc-100"
        >
          +
        </button>
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Classifier sandbox                                                  */
/* ------------------------------------------------------------------ */

function ClassifierSandbox() {
  const evaluateText = useModerationStore((s) => s.evaluateText);
  const [probe, setProbe] = useState("The audio is trash and you are a pathetic hack, fix your mix damn it");

  const verdict = useMemo(
    () => (probe.trim() ? evaluateText(probe) : null),
    [probe, evaluateText]
  );

  const bars: [ToxicityCategory, string][] = [
    ["threat", "bg-red-400"],
    ["insult", "bg-amber-400"],
    ["profanity", "bg-orange-400"],
    ["spam", "bg-sky-400"],
  ];

  return (
    <Panel>
      <PanelHeader
        title="Classifier Sandbox"
        hint="Probe the NLP pipeline with the live settings above."
        right={
          verdict && (
            <span className="font-mono text-[10px] tracking-[0.14em] text-zinc-500 uppercase">
              τ={verdict.breakdown.overall.toFixed(2)}
            </span>
          )
        }
      />
      <div className="px-4 py-4">
        <textarea
          value={probe}
          onChange={(e) => setProbe(e.target.value)}
          rows={3}
          placeholder="Type anything to see how the engine scores it…"
          className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
        />

        {verdict ? (
          <div className="mt-4 space-y-2.5">
            {bars.map(([key, barColor]) => (
              <div key={key} className="grid grid-cols-[86px_1fr_40px] items-center gap-3">
                <span className="font-mono text-[9px] tracking-[0.16em] text-zinc-500 uppercase">
                  {key}
                </span>
                <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={cn("h-full rounded-full transition-all duration-300", barColor)}
                    style={{ width: `${Math.max(2, verdict.breakdown[key] * 100)}%` }}
                  />
                </div>
                <span className="text-right font-mono text-[10px] text-zinc-400 tabular-nums">
                  {verdict.breakdown[key].toFixed(2)}
                </span>
              </div>
            ))}

            <div
              className={cn(
                "mt-4 flex items-center gap-2 rounded border px-3 py-2 text-xs font-medium",
                verdict.action === "publish" &&
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                verdict.action === "blur-publish" &&
                  "border-amber-500/30 bg-amber-500/10 text-amber-300",
                verdict.action === "detox-modal" &&
                  "border-amber-500/30 bg-amber-500/10 text-amber-300",
                verdict.action === "hold" && "border-red-500/30 bg-red-500/10 text-red-300"
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              {verdict.action === "publish" && "Would publish — below the intercept line."}
              {verdict.action === "blur-publish" &&
                `Would auto-blur ${verdict.blurredCount} token${verdict.blurredCount === 1 ? "" : "s"} and publish.`}
              {verdict.action === "detox-modal" && "Would trigger the Smart De-Tox modal."}
              {verdict.action === "hold" && "Would route straight to the review queue."}
            </div>

            {verdict.aboveThreshold && (
              <div className="rounded border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
                <p className="mb-1 font-mono text-[9px] tracking-[0.16em] text-emerald-400/80 uppercase">
                  De-Tox preview
                </p>
                <p className="text-xs leading-relaxed text-zinc-300">{verdict.rephrase}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 font-mono text-[10px] tracking-[0.14em] text-zinc-600 uppercase">
            awaiting input…
          </p>
        )}
      </div>
    </Panel>
  );
}
