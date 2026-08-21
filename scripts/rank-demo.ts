/**
 * Shows the recommendation engine working against the seeded agent library.
 *
 * Run: npm run demo
 *
 * Two lists, deliberately. Ranking on impact ÷ effort alone lets a trivial
 * agent outrank a transformative one — that is how a founder drowning in admin
 * ends up being told to build a caption writer. Neither list is the whole
 * truth, so the product shows both and the founder chooses.
 */
import type { GoalWeight } from "../src/domain/goals.js";
import { recommend, type ScoredCandidate } from "../src/domain/priority.js";
import { SEED_LIBRARY } from "../src/domain/seed-library.js";

const PROFILES: ReadonlyArray<readonly [string, GoalWeight[]]> = [
  [
    "Founder drowning in admin",
    [
      { goal: "time", weight: 1 },
      { goal: "headspace", weight: 0.8 },
    ],
  ],
  [
    "Founder who needs revenue now",
    [
      { goal: "revenue", weight: 1 },
      { goal: "time", weight: 0.3 },
    ],
  ],
  [
    "Founder scaling without hiring",
    [
      { goal: "capacity", weight: 1 },
      { goal: "time", weight: 0.6 },
    ],
  ],
];

const ESC = String.fromCharCode(27);
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const OFF = `${ESC}[0m`;

function line(r: ScoredCandidate, i: number, metric: number): string {
  const why = r.contributions
    .filter((c) => c.contribution > 0)
    .map((c) => `${c.goal} ${c.impact}x${c.weight}`)
    .join(" + ");
  return (
    `    ${i + 1}. ${r.candidate.name.padEnd(21)}` +
    `${metric.toFixed(2).padStart(6)}   ` +
    `${DIM}${why}  (effort ${r.candidate.setupEffort})${OFF}`
  );
}

for (const [label, weights] of PROFILES) {
  const goals = weights.map((w) => `${w.goal} x${w.weight}`).join(", ");
  const { biggestImpact, quickestWins } = recommend(SEED_LIBRARY, weights);

  console.log(`\n${BOLD}${label}${OFF}`);
  console.log(`${DIM}  optimising for: ${goals}${OFF}\n`);

  console.log(`  ${BOLD}Biggest impact${OFF} ${DIM}(what matters most)${OFF}`);
  biggestImpact.slice(0, 3).forEach((r, i) => console.log(line(r, i, r.impact)));

  console.log(`\n  ${BOLD}Quickest wins${OFF} ${DIM}(what to do first)${OFF}`);
  quickestWins.slice(0, 3).forEach((r, i) => console.log(line(r, i, r.score)));
}
console.log("");
