/**
 * Shows the priority engine working against the seeded agent library.
 *
 * Run: npm run demo
 *
 * The point of this script is the last column: every ranking states the
 * arithmetic that produced it, because the product promises the order can be
 * defended out loud on a coaching call.
 */
import type { GoalWeight } from "../src/domain/goals.js";
import { rankCandidates } from "../src/domain/priority.js";
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

for (const [label, weights] of PROFILES) {
  const goals = weights.map((w) => `${w.goal} x${w.weight}`).join(", ");
  console.log(`\n${BOLD}${label}${OFF}`);
  console.log(`${DIM}  optimising for: ${goals}${OFF}`);

  for (const [i, r] of rankCandidates(SEED_LIBRARY, weights).slice(0, 3).entries()) {
    const why = r.contributions
      .filter((c) => c.contribution > 0)
      .map((c) => `${c.goal} ${c.impact}x${c.weight}`)
      .join(" + ");
    console.log(
      `  ${i + 1}. ${r.candidate.name.padEnd(21)}` +
        `${r.score.toFixed(2).padStart(6)}   ` +
        `${DIM}(${why}) / ${r.candidate.setupEffort} effort${OFF}`,
    );
  }
}
console.log("");
