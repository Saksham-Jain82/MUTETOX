/**
 * One-shot Vercel deployment via REST API.
 * Uploads git-tracked files via /v2/files, creates a production deployment
 * via /v13/deployments, polls until READY.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const TOKEN = process.env.VERCEL_TOKEN;
if (!TOKEN) {
  console.error("VERCEL_TOKEN is required");
  process.exit(1);
}

const API = "https://api.vercel.com";

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers ?? {}) },
  });
  return res;
}

/* 1 — collect tracked files (excludes .env, node_modules via git) */
const files = execSync("git ls-files", { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
console.log(`uploading ${files.length} files...`);

const manifest = [];
for (const file of files) {
  const body = readFileSync(file);
  const sha = createHash("sha1").update(body).digest("hex");
  const res = await api("/v2/files", {
    method: "POST",
    headers: {
      "x-vercel-digest": sha,
      "Content-Length": String(body.length),
      "Content-Type": "application/octet-stream",
    },
    body,
  });
  if (!res.ok) {
    console.error(`upload failed for ${file}:`, res.status, await res.text());
    process.exit(1);
  }
  manifest.push({ file, sha, size: body.length });
  process.stdout.write(`  ok ${file}\n`);
}

/* 2 — create deployment */
console.log("creating deployment...");
const createRes = await api("/v13/deployments", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "mutetox",
    target: "production",
    files: manifest,
    projectSettings: { framework: "nextjs" },
  }),
});
if (!createRes.ok) {
  console.error("deployment creation failed:", createRes.status, await createRes.text());
  process.exit(1);
}
const deployment = await createRes.json();
console.log(`deployment created: ${deployment.id} -> https://${deployment.url}`);

/* 3 — poll until terminal state */
const deadline = Date.now() + 9 * 60_000;
let lastState = "";
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 5000));
  const poll = await api(`/v13/deployments/${deployment.id}`);
  const d = await poll.json();
  const state = d.readyState ?? d.status ?? "UNKNOWN";
  if (state !== lastState) {
    console.log(`  state: ${state}`);
    lastState = state;
  }
  if (state === "READY") {
    console.log(`\nDEPLOYED: https://${d.url}`);
    if (Array.isArray(d.alias)) for (const a of d.alias) console.log(`  alias: https://${a}`);
    if (d.aliasFinal) console.log(`  alias: https://${d.aliasFinal}`);
    process.exit(0);
  }
  if (state === "ERROR" || state === "CANCELED") {
    console.error("deployment failed:", JSON.stringify(d.error ?? d, null, 2).slice(0, 2000));
    process.exit(1);
  }
}
console.error("timed out waiting for deployment");
process.exit(1);
