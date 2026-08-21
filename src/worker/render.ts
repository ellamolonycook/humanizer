import { GOAL_TYPES, type GoalWeight } from "../domain/goals.js";
import { recommend, type ScoredCandidate } from "../domain/priority.js";
import { SEED_LIBRARY, type SeedAgent } from "../domain/seed-library.js";

/** Agent names are data. Escape them rather than trusting them. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const GOAL_LABEL: Record<(typeof GOAL_TYPES)[number], string> = {
  time: "Time back",
  revenue: "Revenue",
  capacity: "Capacity",
  headspace: "Headspace",
};

/** The arithmetic, in words. This is the promise the whole product rests on. */
function workingOut(r: ScoredCandidate): string {
  const parts = r.contributions
    .filter((c) => c.contribution > 0)
    .map((c) => `${c.goal} ${c.impact}&times;${c.weight}`);
  return parts.length > 0 ? parts.join(" + ") : "no impact on your goals";
}

function row(r: ScoredCandidate, i: number, metric: number, showEffort: boolean): string {
  const a = r.candidate as SeedAgent;
  const effort = showEffort ? ` &divide; ${a.setupEffort} effort` : "";
  return `
      <li class="row">
        <span class="rank">${i + 1}</span>
        <span class="who">
          <span class="agent">${escapeHtml(a.name)}</span>
          <span class="job">${escapeHtml(a.jobDescription ?? "")}</span>
          <span class="why">${workingOut(r)}${effort}</span>
        </span>
        <span class="metric">${metric.toFixed(1)}</span>
      </li>`;
}

function slider(weights: readonly GoalWeight[], goal: (typeof GOAL_TYPES)[number]): string {
  const current = weights.find((w) => w.goal === goal)?.weight ?? 0;
  return `
        <label class="slider">
          <span class="slabel">${GOAL_LABEL[goal]}</span>
          <input type="range" name="${goal}" min="0" max="1" step="0.1"
                 value="${current}" oninput="this.nextElementSibling.textContent=this.value">
          <output>${current}</output>
        </label>`;
}

/**
 * The whole page, server-rendered.
 *
 * Two lists, never one. Ranking on impact-over-effort alone recommends trivial
 * agents over transformative ones; ranking on impact alone always recommends the
 * hardest thing first. Both are shown and the reader chooses.
 */
export function renderPage(
  weights: readonly GoalWeight[],
  library: readonly SeedAgent[] = SEED_LIBRARY,
): string {
  const { biggestImpact, quickestWins } = recommend(library, weights);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>What should I build next</title>
<style>
  :root {
    --ground:#F8FAF3; --surface:#FFFFFF; --ink:#241B45; --ink-soft:#6E6790;
    --line:#E2E1F0; --mint:#CCEEA0; --accent:#5A8C2B; --violet:#7C3AED;
    --on-mint:#22331A;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground:#15112A; --surface:#1E1839; --ink:#EFECFA; --ink-soft:#9A93BC;
      --line:#322B55; --mint:#CCEEA0; --accent:#AEDC79; --violet:#A78BFA;
      --on-mint:#22331A;
    }
  }
  :root[data-theme="dark"] {
    --ground:#15112A; --surface:#1E1839; --ink:#EFECFA; --ink-soft:#9A93BC;
    --line:#322B55; --mint:#CCEEA0; --accent:#AEDC79; --violet:#A78BFA;
    --on-mint:#22331A;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--ground);color:var(--ink);
    font:16px/1.6 ui-sans-serif,system-ui,-apple-system,sans-serif;
    -webkit-font-smoothing:antialiased}
  .wrap{max-width:860px;margin:0 auto;padding:clamp(24px,5vw,56px) clamp(16px,4vw,32px) 80px;
    display:flex;flex-direction:column;gap:36px}
  h1{font-size:clamp(1.9rem,5vw,2.6rem);margin:0;letter-spacing:-.02em;text-wrap:balance}
  .lede{color:var(--ink-soft);margin:.4rem 0 0;max-width:56ch}
  h2{font-size:1.05rem;margin:0;display:flex;align-items:center;gap:9px}
  h2 .pip{width:10px;height:10px;border-radius:50%;background:var(--mint);
    box-shadow:0 0 0 2px var(--accent)}
  h2 .note{font-weight:400;color:var(--ink-soft);font-size:.86rem}
  form{background:var(--surface);border:1px solid var(--line);border-radius:14px;
    padding:20px 22px;display:flex;flex-direction:column;gap:16px}
  .sliders{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
  .slider{display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center}
  .slabel{font-size:.85rem;font-weight:600;grid-column:1/-1}
  input[type=range]{width:100%;accent-color:var(--violet)}
  output{font-variant-numeric:tabular-nums;font-size:.85rem;color:var(--ink-soft);min-width:2ch}
  button{background:var(--mint);color:var(--on-mint);border:0;border-radius:999px;
    padding:11px 22px;font-weight:700;font-size:.92rem;cursor:pointer;align-self:flex-start}
  button:hover{filter:brightness(.95)}
  ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
  .row{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:baseline;
    background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 18px}
  .rank{font-variant-numeric:tabular-nums;color:var(--ink-soft);font-size:.85rem;min-width:1.4ch}
  .who{display:flex;flex-direction:column;gap:3px;min-width:0}
  .agent{font-weight:700}
  .job{font-size:.87rem;color:var(--ink-soft)}
  .why{font-size:.78rem;color:var(--violet);font-family:ui-monospace,monospace}
  .metric{font-variant-numeric:tabular-nums;font-weight:700;font-size:1.05rem}
  section{display:flex;flex-direction:column;gap:12px}
  a{color:var(--accent)}
  :focus-visible{outline:2px solid var(--violet);outline-offset:2px}
</style>
</head>
<body>
<div class="wrap">

  <header>
    <h1>What should I build next?</h1>
    <p class="lede">Move the sliders to say what you're optimising for. Everything below
    re-ranks, and every row shows the arithmetic that put it there.</p>
  </header>

  <form method="get" action="/">
    <div class="sliders">${GOAL_TYPES.map((g) => slider(weights, g)).join("")}
    </div>
    <button type="submit">Re-rank</button>
  </form>

  <section>
    <h2><span class="pip"></span>Biggest impact <span class="note">&mdash; what matters most, whatever it costs</span></h2>
    <ol>${biggestImpact.slice(0, 5).map((r, i) => row(r, i, r.impact, false)).join("")}
    </ol>
  </section>

  <section>
    <h2><span class="pip"></span>Quickest wins <span class="note">&mdash; what to do first, to get moving</span></h2>
    <ol>${quickestWins.slice(0, 5).map((r, i) => row(r, i, r.score, true)).join("")}
    </ol>
  </section>

</div>
</body>
</html>`;
}
