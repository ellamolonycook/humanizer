# Humanizer Domain Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and fully test the two pure engines the whole product depends on — agent
priority scoring and outcome rollups — plus the database schema, with no infrastructure
and no credentials required.

**Architecture:** Everything in this plan is pure TypeScript with no I/O. Scoring takes
a candidate plus goal weights and returns a score *with its per-goal contributions*, so
the UI can always show its working. Rollups fold `Outcome` rows into totals grouped by
agent, human, or company. The schema is plain SQL, verified against Node's built-in
SQLite (D1 is SQLite-compatible), so it needs no Cloudflare account.

**Tech Stack:** TypeScript 5, Vitest, `node:sqlite` (built into Node 24 — no dependency).

## Global Constraints

- Node >= 24 (verified locally: v24.14.1). `node:sqlite` requires it.
- All modules are ESM (`"type": "module"`).
- **Skipped confirmations are `null`, never `0`.** A missing day means "not confirmed"
  and must never be summed as a zero outcome. This is the single most important
  invariant in this plan.
- **"Period" means one day.** Rollups aggregate days upward; nothing stores weeks.
- Goal types are exactly: `time`, `revenue`, `capacity`, `headspace`.
- Scoring must return its per-goal contributions. A score without its working is a
  spec violation — the ranking has to be defensible out loud.
- No `any` in exported signatures.
- Currency is GBP. Money is stored in **pence as integers**, never floats.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`
- Test: `src/index.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm test` command that later tasks rely on.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "humanizer",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023"],
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Write the failing smoke test**

Create `src/index.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { VERSION } from "./index.js";

describe("package", () => {
  it("exposes a version string", () => {
    expect(VERSION).toBe("0.0.1");
  });
});
```

- [ ] **Step 5: Install and run the test to verify it fails**

Run: `npm install && npm test`
Expected: FAIL — `Failed to resolve import "./index.js"`

- [ ] **Step 6: Create `src/index.ts`**

```typescript
export const VERSION = "0.0.1";
```

- [ ] **Step 7: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: 1 test passes; typecheck exits 0.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/index.ts src/index.test.ts
git commit -m "chore: scaffold TypeScript project with vitest"
```

---

### Task 2: Domain types and goal-weight validation

**Files:**
- Create: `src/domain/goals.ts`
- Test: `src/domain/goals.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type GoalType = "time" | "revenue" | "capacity" | "headspace"`
  - `const GOAL_TYPES: readonly GoalType[]`
  - `interface GoalWeight { goal: GoalType; weight: number }`
  - `class InvalidGoalWeightsError extends Error`
  - `function validateGoalWeights(weights: readonly GoalWeight[]): void` — throws
    `InvalidGoalWeightsError`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/goals.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  GOAL_TYPES,
  InvalidGoalWeightsError,
  validateGoalWeights,
} from "./goals.js";

describe("GOAL_TYPES", () => {
  it("is exactly the four spec goals", () => {
    expect([...GOAL_TYPES]).toEqual(["time", "revenue", "capacity", "headspace"]);
  });
});

describe("validateGoalWeights", () => {
  it("accepts a single weighted goal", () => {
    expect(() => validateGoalWeights([{ goal: "time", weight: 1 }])).not.toThrow();
  });

  it("accepts several weighted goals", () => {
    expect(() =>
      validateGoalWeights([
        { goal: "time", weight: 0.6 },
        { goal: "revenue", weight: 0.4 },
      ]),
    ).not.toThrow();
  });

  it("rejects an empty list", () => {
    expect(() => validateGoalWeights([])).toThrow(InvalidGoalWeightsError);
  });

  it("rejects weights that are all zero, because priority would be undefined", () => {
    expect(() =>
      validateGoalWeights([
        { goal: "time", weight: 0 },
        { goal: "revenue", weight: 0 },
      ]),
    ).toThrow(/at least one goal/i);
  });

  it("rejects a negative weight", () => {
    expect(() => validateGoalWeights([{ goal: "time", weight: -1 }])).toThrow(
      /between 0 and 1/i,
    );
  });

  it("rejects a weight above 1", () => {
    expect(() => validateGoalWeights([{ goal: "time", weight: 1.5 }])).toThrow(
      /between 0 and 1/i,
    );
  });

  it("rejects a duplicated goal", () => {
    expect(() =>
      validateGoalWeights([
        { goal: "time", weight: 0.5 },
        { goal: "time", weight: 0.5 },
      ]),
    ).toThrow(/duplicate/i);
  });

  it("rejects a non-finite weight", () => {
    expect(() =>
      validateGoalWeights([{ goal: "time", weight: Number.NaN }]),
    ).toThrow(/between 0 and 1/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domain/goals.test.ts`
Expected: FAIL — `Failed to resolve import "./goals.js"`

- [ ] **Step 3: Write the implementation**

Create `src/domain/goals.ts`:

```typescript
/** The four things a company can optimise for. Order is the display order. */
export const GOAL_TYPES = ["time", "revenue", "capacity", "headspace"] as const;

export type GoalType = (typeof GOAL_TYPES)[number];

/** How much a company cares about one goal, 0..1. */
export interface GoalWeight {
  readonly goal: GoalType;
  readonly weight: number;
}

export class InvalidGoalWeightsError extends Error {
  override readonly name = "InvalidGoalWeightsError";
}

/**
 * Throws unless the weights can produce a defined priority score.
 *
 * Rejecting all-zero weights is deliberate: with every weight at zero every
 * candidate scores zero, so the backlog has no order and the product silently
 * stops working. Better to refuse at onboarding.
 */
export function validateGoalWeights(weights: readonly GoalWeight[]): void {
  if (weights.length === 0) {
    throw new InvalidGoalWeightsError("Pick at least one goal to optimise for.");
  }

  const seen = new Set<GoalType>();
  for (const { goal, weight } of weights) {
    if (seen.has(goal)) {
      throw new InvalidGoalWeightsError(`Duplicate goal: ${goal}.`);
    }
    seen.add(goal);

    if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
      throw new InvalidGoalWeightsError(
        `Weight for ${goal} must be a number between 0 and 1, got ${weight}.`,
      );
    }
  }

  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  if (total <= 0) {
    throw new InvalidGoalWeightsError(
      "Give at least one goal a weight above zero, or nothing can be ranked.",
    );
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/domain/goals.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/goals.ts src/domain/goals.test.ts
git commit -m "feat: goal types and weight validation"
```

---

### Task 3: Priority scoring engine

**Files:**
- Create: `src/domain/priority.ts`
- Test: `src/domain/priority.test.ts`

**Interfaces:**
- Consumes: `GoalType`, `GoalWeight`, `validateGoalWeights` from `./goals.js`
- Produces:
  - `interface AgentCandidate { id: string; name: string; expectedImpact: Partial<Record<GoalType, number>>; setupEffort: number }`
  - `interface ScoreContribution { goal: GoalType; impact: number; weight: number; contribution: number }`
  - `interface ScoredCandidate { candidate: AgentCandidate; score: number; contributions: ScoreContribution[] }`
  - `class InvalidCandidateError extends Error`
  - `function scoreCandidate(candidate: AgentCandidate, weights: readonly GoalWeight[]): ScoredCandidate`
  - `function rankCandidates(candidates: readonly AgentCandidate[], weights: readonly GoalWeight[]): ScoredCandidate[]`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/priority.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { GoalWeight } from "./goals.js";
import {
  InvalidCandidateError,
  rankCandidates,
  scoreCandidate,
  type AgentCandidate,
} from "./priority.js";

const timeOnly: readonly GoalWeight[] = [{ goal: "time", weight: 1 }];

function candidate(over: Partial<AgentCandidate> = {}): AgentCandidate {
  return {
    id: "a1",
    name: "Inbox agent",
    expectedImpact: { time: 8 },
    setupEffort: 2,
    ...over,
  };
}

describe("scoreCandidate", () => {
  it("divides weighted impact by setup effort", () => {
    // (8 impact x 1.0 weight) / 2 effort = 4
    expect(scoreCandidate(candidate(), timeOnly).score).toBe(4);
  });

  it("sums contributions across several goals", () => {
    const weights: GoalWeight[] = [
      { goal: "time", weight: 0.5 },
      { goal: "revenue", weight: 1 },
    ];
    const c = candidate({ expectedImpact: { time: 8, revenue: 6 }, setupEffort: 2 });
    // ((8 x 0.5) + (6 x 1)) / 2 = 5
    expect(scoreCandidate(c, weights).score).toBe(5);
  });

  it("ignores impact on goals the company did not pick", () => {
    const c = candidate({ expectedImpact: { time: 8, headspace: 100 }, setupEffort: 2 });
    expect(scoreCandidate(c, timeOnly).score).toBe(4);
  });

  it("treats a missing impact as zero", () => {
    const c = candidate({ expectedImpact: {}, setupEffort: 2 });
    expect(scoreCandidate(c, timeOnly).score).toBe(0);
  });

  it("shows its working, one contribution per weighted goal", () => {
    const weights: GoalWeight[] = [
      { goal: "time", weight: 0.5 },
      { goal: "revenue", weight: 1 },
    ];
    const c = candidate({ expectedImpact: { time: 8, revenue: 6 }, setupEffort: 2 });
    // Sorted largest-contribution-first, same as the test below asserts.
    expect(scoreCandidate(c, weights).contributions).toEqual([
      { goal: "revenue", impact: 6, weight: 1, contribution: 6 },
      { goal: "time", impact: 8, weight: 0.5, contribution: 4 },
    ]);
  });

  it("orders contributions largest first, so the UI leads with the real reason", () => {
    const weights: GoalWeight[] = [
      { goal: "time", weight: 0.1 },
      { goal: "revenue", weight: 1 },
    ];
    const c = candidate({ expectedImpact: { time: 8, revenue: 6 }, setupEffort: 1 });
    const goals = scoreCandidate(c, weights).contributions.map((x) => x.goal);
    expect(goals).toEqual(["revenue", "time"]);
  });

  it("rejects zero setup effort rather than dividing by zero", () => {
    expect(() => scoreCandidate(candidate({ setupEffort: 0 }), timeOnly)).toThrow(
      InvalidCandidateError,
    );
  });

  it("rejects negative setup effort", () => {
    expect(() => scoreCandidate(candidate({ setupEffort: -1 }), timeOnly)).toThrow(
      /above zero/i,
    );
  });

  it("rejects a negative expected impact", () => {
    expect(() =>
      scoreCandidate(candidate({ expectedImpact: { time: -3 } }), timeOnly),
    ).toThrow(/impact/i);
  });

  it("rejects invalid weights via the shared validator", () => {
    expect(() => scoreCandidate(candidate(), [])).toThrow(/at least one goal/i);
  });
});

describe("rankCandidates", () => {
  it("returns highest score first", () => {
    const cheap = candidate({ id: "cheap", expectedImpact: { time: 8 }, setupEffort: 1 });
    const dear = candidate({ id: "dear", expectedImpact: { time: 8 }, setupEffort: 4 });
    const ranked = rankCandidates([dear, cheap], timeOnly);
    expect(ranked.map((r) => r.candidate.id)).toEqual(["cheap", "dear"]);
  });

  it("breaks ties by name so the order is stable across reloads", () => {
    const b = candidate({ id: "b", name: "Beta" });
    const a = candidate({ id: "a", name: "Alpha" });
    const ranked = rankCandidates([b, a], timeOnly);
    expect(ranked.map((r) => r.candidate.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const input = [candidate({ id: "x", setupEffort: 4 }), candidate({ id: "y", setupEffort: 1 })];
    rankCandidates(input, timeOnly);
    expect(input.map((c) => c.id)).toEqual(["x", "y"]);
  });

  it("returns an empty list for no candidates", () => {
    expect(rankCandidates([], timeOnly)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domain/priority.test.ts`
Expected: FAIL — `Failed to resolve import "./priority.js"`

- [ ] **Step 3: Write the implementation**

Create `src/domain/priority.ts`:

```typescript
import {
  validateGoalWeights,
  type GoalType,
  type GoalWeight,
} from "./goals.js";

/** An agent someone could build, with what they expect it to be worth. */
export interface AgentCandidate {
  readonly id: string;
  readonly name: string;
  /** Expected impact per goal, 0..10. Absent means no expected impact. */
  readonly expectedImpact: Partial<Record<GoalType, number>>;
  /** Relative cost to set up. Must be above zero. */
  readonly setupEffort: number;
}

/** One goal's share of a candidate's score — this is the "why". */
export interface ScoreContribution {
  readonly goal: GoalType;
  readonly impact: number;
  readonly weight: number;
  readonly contribution: number;
}

export interface ScoredCandidate {
  readonly candidate: AgentCandidate;
  readonly score: number;
  readonly contributions: readonly ScoreContribution[];
}

export class InvalidCandidateError extends Error {
  override readonly name = "InvalidCandidateError";
}

/**
 * priority = Σ (expected_impact[goal] × goal_weight[goal]) ÷ setup_effort
 *
 * Returns the per-goal contributions alongside the score. That is not a
 * convenience — the product promises the ranking can be defended out loud, so
 * a score that cannot show its working is useless.
 */
export function scoreCandidate(
  candidate: AgentCandidate,
  weights: readonly GoalWeight[],
): ScoredCandidate {
  validateGoalWeights(weights);

  if (!Number.isFinite(candidate.setupEffort) || candidate.setupEffort <= 0) {
    throw new InvalidCandidateError(
      `Setup effort for "${candidate.name}" must be above zero, got ${candidate.setupEffort}.`,
    );
  }

  const contributions: ScoreContribution[] = weights.map(({ goal, weight }) => {
    const impact = candidate.expectedImpact[goal] ?? 0;
    if (!Number.isFinite(impact) || impact < 0) {
      throw new InvalidCandidateError(
        `Expected impact on ${goal} for "${candidate.name}" cannot be negative, got ${impact}.`,
      );
    }
    return { goal, impact, weight, contribution: impact * weight };
  });

  const weighted = contributions.reduce((sum, c) => sum + c.contribution, 0);

  return {
    candidate,
    score: weighted / candidate.setupEffort,
    contributions: [...contributions].sort((a, b) => b.contribution - a.contribution),
  };
}

/** Scores every candidate and returns them best-first. Does not mutate the input. */
export function rankCandidates(
  candidates: readonly AgentCandidate[],
  weights: readonly GoalWeight[],
): ScoredCandidate[] {
  return candidates
    .map((c) => scoreCandidate(c, weights))
    .sort(
      (a, b) =>
        b.score - a.score || a.candidate.name.localeCompare(b.candidate.name),
    );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/domain/priority.test.ts`
Expected: PASS — 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/priority.ts src/domain/priority.test.ts
git commit -m "feat: agent priority scoring that shows its working"
```

---

### Task 4: Outcome rollups

**Files:**
- Create: `src/domain/outcomes.ts`
- Test: `src/domain/outcomes.test.ts`

**Interfaces:**
- Consumes: `GoalType` from `./goals.js`
- Produces:
  - `type SignalSource = "run_log" | "draft_feedback" | "platform_metric" | "check_in"`
  - `interface Outcome { agentId: string; humanId: string; companyId: string; day: string; goal: GoalType; predicted: number; actual: number | null; source: SignalSource }`
  - `interface Rollup { goal: GoalType; predicted: number; actual: number; confirmedDays: number; skippedDays: number }`
  - `function rollupByAgent(outcomes: readonly Outcome[]): Map<string, Rollup[]>`
  - `function rollupByHuman(outcomes: readonly Outcome[]): Map<string, Rollup[]>`
  - `function rollupByCompany(outcomes: readonly Outcome[]): Map<string, Rollup[]>`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/outcomes.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  rollupByAgent,
  rollupByCompany,
  rollupByHuman,
  type Outcome,
} from "./outcomes.js";

function outcome(over: Partial<Outcome> = {}): Outcome {
  return {
    agentId: "agent-1",
    humanId: "human-1",
    companyId: "co-1",
    day: "2026-08-21",
    goal: "time",
    predicted: 60,
    actual: 45,
    source: "run_log",
    ...over,
  };
}

describe("rollupByAgent", () => {
  it("sums predicted and actual for one agent and goal", () => {
    const rows = [
      outcome({ day: "2026-08-21", predicted: 60, actual: 45 }),
      outcome({ day: "2026-08-22", predicted: 60, actual: 30 }),
    ];
    expect(rollupByAgent(rows).get("agent-1")).toEqual([
      { goal: "time", predicted: 120, actual: 75, confirmedDays: 2, skippedDays: 0 },
    ]);
  });

  it("counts a null actual as a skipped day and excludes it from the total", () => {
    const rows = [
      outcome({ day: "2026-08-21", predicted: 60, actual: 45 }),
      outcome({ day: "2026-08-22", predicted: 60, actual: null }),
    ];
    expect(rollupByAgent(rows).get("agent-1")).toEqual([
      { goal: "time", predicted: 120, actual: 45, confirmedDays: 1, skippedDays: 1 },
    ]);
  });

  it("never treats a skipped day as a zero outcome", () => {
    const rows = [outcome({ actual: null })];
    const [rollup] = rollupByAgent(rows).get("agent-1") ?? [];
    expect(rollup?.actual).toBe(0);
    expect(rollup?.confirmedDays).toBe(0);
    expect(rollup?.skippedDays).toBe(1);
  });

  it("keeps an explicit zero actual distinct from a skipped day", () => {
    const rows = [outcome({ actual: 0 })];
    expect(rollupByAgent(rows).get("agent-1")).toEqual([
      { goal: "time", predicted: 60, actual: 0, confirmedDays: 1, skippedDays: 0 },
    ]);
  });

  it("splits rollups by goal within one agent", () => {
    const rows = [
      outcome({ goal: "time", predicted: 60, actual: 45 }),
      outcome({ goal: "revenue", predicted: 500, actual: 250 }),
    ];
    const rollups = rollupByAgent(rows).get("agent-1") ?? [];
    expect(rollups).toHaveLength(2);
    expect(rollups.map((r) => r.goal).sort()).toEqual(["revenue", "time"]);
  });

  it("keeps separate agents separate", () => {
    const rows = [outcome({ agentId: "a" }), outcome({ agentId: "b" })];
    expect([...rollupByAgent(rows).keys()].sort()).toEqual(["a", "b"]);
  });

  it("returns an empty map for no rows", () => {
    expect(rollupByAgent([]).size).toBe(0);
  });
});

describe("rollupByHuman", () => {
  it("merges every agent belonging to one human", () => {
    const rows = [
      outcome({ agentId: "a", humanId: "h1", predicted: 60, actual: 45 }),
      outcome({ agentId: "b", humanId: "h1", predicted: 30, actual: 15 }),
    ];
    expect(rollupByHuman(rows).get("h1")).toEqual([
      { goal: "time", predicted: 90, actual: 60, confirmedDays: 2, skippedDays: 0 },
    ]);
  });

  it("keeps separate humans separate", () => {
    const rows = [outcome({ humanId: "h1" }), outcome({ humanId: "h2" })];
    expect([...rollupByHuman(rows).keys()].sort()).toEqual(["h1", "h2"]);
  });
});

describe("rollupByCompany", () => {
  it("merges every human in one company", () => {
    const rows = [
      outcome({ humanId: "h1", companyId: "co-1", predicted: 60, actual: 45 }),
      outcome({ humanId: "h2", companyId: "co-1", predicted: 60, actual: 30 }),
    ];
    expect(rollupByCompany(rows).get("co-1")).toEqual([
      { goal: "time", predicted: 120, actual: 75, confirmedDays: 2, skippedDays: 0 },
    ]);
  });

  it("keeps separate companies separate", () => {
    const rows = [outcome({ companyId: "co-1" }), outcome({ companyId: "co-2" })];
    expect([...rollupByCompany(rows).keys()].sort()).toEqual(["co-1", "co-2"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/domain/outcomes.test.ts`
Expected: FAIL — `Failed to resolve import "./outcomes.js"`

- [ ] **Step 3: Write the implementation**

Create `src/domain/outcomes.ts`:

```typescript
import { GOAL_TYPES, type GoalType } from "./goals.js";

/** Which signal produced an outcome. Only `run_log` ships in the MVP. */
export type SignalSource =
  | "run_log"
  | "draft_feedback"
  | "platform_metric"
  | "check_in";

/** One agent's result against one goal on one day. */
export interface Outcome {
  readonly agentId: string;
  readonly humanId: string;
  readonly companyId: string;
  /** ISO date, YYYY-MM-DD. A period is one day. */
  readonly day: string;
  readonly goal: GoalType;
  readonly predicted: number;
  /** `null` means the owner did not confirm. It is NOT a zero outcome. */
  readonly actual: number | null;
  readonly source: SignalSource;
}

export interface Rollup {
  readonly goal: GoalType;
  readonly predicted: number;
  readonly actual: number;
  readonly confirmedDays: number;
  readonly skippedDays: number;
}

type Accumulator = {
  predicted: number;
  actual: number;
  confirmedDays: number;
  skippedDays: number;
};

/**
 * Groups outcomes by an arbitrary key, then by goal within each key.
 *
 * The one rule that matters: a `null` actual is a gap, not a zero. It raises
 * `skippedDays` and is left out of `actual` entirely, so an unconfirmed day can
 * never be mistaken for an agent that delivered nothing.
 */
function rollupBy(
  outcomes: readonly Outcome[],
  keyOf: (o: Outcome) => string,
): Map<string, Rollup[]> {
  const groups = new Map<string, Map<GoalType, Accumulator>>();

  for (const o of outcomes) {
    const key = keyOf(o);
    let byGoal = groups.get(key);
    if (byGoal === undefined) {
      byGoal = new Map<GoalType, Accumulator>();
      groups.set(key, byGoal);
    }

    let acc = byGoal.get(o.goal);
    if (acc === undefined) {
      acc = { predicted: 0, actual: 0, confirmedDays: 0, skippedDays: 0 };
      byGoal.set(o.goal, acc);
    }

    acc.predicted += o.predicted;
    if (o.actual === null) {
      acc.skippedDays += 1;
    } else {
      acc.actual += o.actual;
      acc.confirmedDays += 1;
    }
  }

  const result = new Map<string, Rollup[]>();
  for (const [key, byGoal] of groups) {
    const rollups: Rollup[] = [];
    // Iterate GOAL_TYPES so output order is the stable display order.
    for (const goal of GOAL_TYPES) {
      const acc = byGoal.get(goal);
      if (acc !== undefined) {
        rollups.push({ goal, ...acc });
      }
    }
    result.set(key, rollups);
  }
  return result;
}

export function rollupByAgent(outcomes: readonly Outcome[]): Map<string, Rollup[]> {
  return rollupBy(outcomes, (o) => o.agentId);
}

export function rollupByHuman(outcomes: readonly Outcome[]): Map<string, Rollup[]> {
  return rollupBy(outcomes, (o) => o.humanId);
}

export function rollupByCompany(outcomes: readonly Outcome[]): Map<string, Rollup[]> {
  return rollupBy(outcomes, (o) => o.companyId);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/domain/outcomes.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/outcomes.ts src/domain/outcomes.test.ts
git commit -m "feat: outcome rollups that treat skipped days as gaps, not zeros"
```

---

### Task 5: Database schema

**Files:**
- Create: `migrations/0001_initial.sql`
- Test: `src/db/schema.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `migrations/0001_initial.sql`, applied later by `wrangler d1 migrations apply`.

D1 is SQLite-compatible, so the schema is verified against Node 24's built-in
`node:sqlite` — no Cloudflare account and no dependency required.

**Verified on this machine (Node v24.14.1) before writing this plan:** `CHECK`
constraints are enforced, `ON DELETE RESTRICT` is enforced *provided*
`PRAGMA foreign_keys = ON` runs first (SQLite defaults it off — without that line the
orphaned-agent tests silently pass while the constraint does nothing), `NULL` round-trips
as `null`, and `GLOB` date patterns match.

**Expect this on every run:** `ExperimentalWarning: SQLite is an experimental feature and
might change at any time`. It is noise from `node:sqlite`, not a failure. Do not "fix" it.

- [ ] **Step 1: Write the failing tests**

Create `src/db/schema.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

const SCHEMA = readFileSync("migrations/0001_initial.sql", "utf8");

let db: DatabaseSync;

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
});

function seedCompanyAndHuman(): void {
  db.exec(`INSERT INTO company (id, name, global_leaderboard_opt_in)
           VALUES ('co-1', 'Time Rich', 0);`);
  db.exec(`INSERT INTO human (id, company_id, email, name)
           VALUES ('h-1', 'co-1', 'ella@example.com', 'Ella');`);
}

describe("schema", () => {
  it("applies cleanly", () => {
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((r) => r["name"]);
    expect(names).toEqual(["agent", "company", "company_goal", "human", "outcome"]);
  });

  it("defaults a company to opted out of the global leaderboard", () => {
    db.exec(`INSERT INTO company (id, name) VALUES ('co-2', 'Acme');`);
    const row = db
      .prepare("SELECT global_leaderboard_opt_in FROM company WHERE id = 'co-2'")
      .get();
    expect(row?.["global_leaderboard_opt_in"]).toBe(0);
  });

  it("rejects a goal weight above 1", () => {
    seedCompanyAndHuman();
    expect(() =>
      db.exec(`INSERT INTO company_goal (company_id, goal, weight)
               VALUES ('co-1', 'time', 1.5);`),
    ).toThrow();
  });

  it("rejects an unknown goal type", () => {
    seedCompanyAndHuman();
    expect(() =>
      db.exec(`INSERT INTO company_goal (company_id, goal, weight)
               VALUES ('co-1', 'vibes', 0.5);`),
    ).toThrow();
  });

  it("rejects a duplicate goal for one company", () => {
    seedCompanyAndHuman();
    db.exec(`INSERT INTO company_goal (company_id, goal, weight)
             VALUES ('co-1', 'time', 0.5);`);
    expect(() =>
      db.exec(`INSERT INTO company_goal (company_id, goal, weight)
               VALUES ('co-1', 'time', 0.9);`),
    ).toThrow();
  });

  it("rejects an agent with no human owner", () => {
    seedCompanyAndHuman();
    expect(() =>
      db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
               VALUES ('ag-1', 'co-1', NULL, 'Inbox', 'Triage', 2);`),
    ).toThrow();
  });

  it("rejects an agent owned by a human who does not exist", () => {
    seedCompanyAndHuman();
    expect(() =>
      db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
               VALUES ('ag-1', 'co-1', 'nobody', 'Inbox', 'Triage', 2);`),
    ).toThrow();
  });

  it("rejects zero setup effort", () => {
    seedCompanyAndHuman();
    expect(() =>
      db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
               VALUES ('ag-1', 'co-1', 'h-1', 'Inbox', 'Triage', 0);`),
    ).toThrow();
  });

  it("rejects an agent status outside the allowed set", () => {
    seedCompanyAndHuman();
    expect(() =>
      db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort, status)
               VALUES ('ag-1', 'co-1', 'h-1', 'Inbox', 'Triage', 2, 'vibing');`),
    ).toThrow();
  });

  it("stores a NULL actual to mean an unconfirmed day", () => {
    seedCompanyAndHuman();
    db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
             VALUES ('ag-1', 'co-1', 'h-1', 'Inbox', 'Triage', 2);`);
    db.exec(`INSERT INTO outcome (id, agent_id, day, goal, predicted, actual, source)
             VALUES ('o-1', 'ag-1', '2026-08-21', 'time', 60, NULL, 'run_log');`);
    const row = db.prepare("SELECT actual FROM outcome WHERE id = 'o-1'").get();
    expect(row?.["actual"]).toBe(null);
  });

  it("rejects two outcomes for the same agent, goal and day", () => {
    seedCompanyAndHuman();
    db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
             VALUES ('ag-1', 'co-1', 'h-1', 'Inbox', 'Triage', 2);`);
    db.exec(`INSERT INTO outcome (id, agent_id, day, goal, predicted, actual, source)
             VALUES ('o-1', 'ag-1', '2026-08-21', 'time', 60, 45, 'run_log');`);
    expect(() =>
      db.exec(`INSERT INTO outcome (id, agent_id, day, goal, predicted, actual, source)
               VALUES ('o-2', 'ag-1', '2026-08-21', 'time', 60, 30, 'run_log');`),
    ).toThrow();
  });

  it("rejects a malformed day", () => {
    seedCompanyAndHuman();
    db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
             VALUES ('ag-1', 'co-1', 'h-1', 'Inbox', 'Triage', 2);`);
    expect(() =>
      db.exec(`INSERT INTO outcome (id, agent_id, day, goal, predicted, actual, source)
               VALUES ('o-1', 'ag-1', '21/08/2026', 'time', 60, 45, 'run_log');`),
    ).toThrow();
  });

  it("deletes an agent's outcomes when the agent is deleted", () => {
    seedCompanyAndHuman();
    db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
             VALUES ('ag-1', 'co-1', 'h-1', 'Inbox', 'Triage', 2);`);
    db.exec(`INSERT INTO outcome (id, agent_id, day, goal, predicted, actual, source)
             VALUES ('o-1', 'ag-1', '2026-08-21', 'time', 60, 45, 'run_log');`);
    db.exec("DELETE FROM agent WHERE id = 'ag-1';");
    const row = db.prepare("SELECT COUNT(*) AS n FROM outcome").get();
    expect(row?.["n"]).toBe(0);
  });

  it("refuses to delete a human who still owns agents, so none are orphaned", () => {
    seedCompanyAndHuman();
    db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
             VALUES ('ag-1', 'co-1', 'h-1', 'Inbox', 'Triage', 2);`);
    expect(() => db.exec("DELETE FROM human WHERE id = 'h-1';")).toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/db/schema.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, open 'migrations/0001_initial.sql'`

- [ ] **Step 3: Write the schema**

Create `migrations/0001_initial.sql`:

```sql
-- Humanizer initial schema.
-- A "period" is one day. Money is pence (INTEGER), never floats.

CREATE TABLE company (
  id                        TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  -- Global leaderboard is opt-in at COMPANY level so one employee can never
  -- expose their team's numbers.
  global_leaderboard_opt_in INTEGER NOT NULL DEFAULT 0
                              CHECK (global_leaderboard_opt_in IN (0, 1)),
  display_name              TEXT,
  theme                     TEXT NOT NULL DEFAULT 'default',
  created_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE company_goal (
  company_id TEXT NOT NULL REFERENCES company (id) ON DELETE CASCADE,
  goal       TEXT NOT NULL
               CHECK (goal IN ('time', 'revenue', 'capacity', 'headspace')),
  weight     REAL NOT NULL CHECK (weight >= 0 AND weight <= 1),
  PRIMARY KEY (company_id, goal)
);

CREATE TABLE human (
  id               TEXT PRIMARY KEY,
  company_id       TEXT NOT NULL REFERENCES company (id) ON DELETE CASCADE,
  email            TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  role             TEXT,
  -- Pence per hour. Converts time outcomes into money.
  hourly_rate_pence INTEGER CHECK (hourly_rate_pence IS NULL OR hourly_rate_pence >= 0),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agent (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL REFERENCES company (id) ON DELETE CASCADE,
  -- RESTRICT, not SET NULL: an agent without a human owner is invalid, so a
  -- human who still owns agents cannot be deleted until they are reassigned.
  owner_human_id  TEXT NOT NULL REFERENCES human (id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,
  job_description TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'proposed'
                    CHECK (status IN ('proposed', 'building', 'live', 'retired')),
  baseline_minutes INTEGER CHECK (baseline_minutes IS NULL OR baseline_minutes >= 0),
  runs_per_day    INTEGER CHECK (runs_per_day IS NULL OR runs_per_day >= 0),
  setup_effort    REAL NOT NULL CHECK (setup_effort > 0),
  avatar          TEXT,
  prompt          TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE outcome (
  id        TEXT PRIMARY KEY,
  agent_id  TEXT NOT NULL REFERENCES agent (id) ON DELETE CASCADE,
  -- ISO day. A period is one day.
  day       TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  goal      TEXT NOT NULL
              CHECK (goal IN ('time', 'revenue', 'capacity', 'headspace')),
  predicted REAL NOT NULL,
  -- NULL means the owner did not confirm that day. It is NOT a zero outcome.
  actual    REAL,
  source    TEXT NOT NULL
              CHECK (source IN ('run_log', 'draft_feedback', 'platform_metric', 'check_in')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (agent_id, goal, day)
);

CREATE INDEX idx_agent_company ON agent (company_id);
CREATE INDEX idx_agent_owner   ON agent (owner_human_id);
CREATE INDEX idx_human_company ON human (company_id);
CREATE INDEX idx_outcome_agent_day ON outcome (agent_id, day);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/db/schema.test.ts`
Expected: PASS — 14 tests.

- [ ] **Step 5: Run the whole suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: 39 tests pass across 4 files; typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add migrations/0001_initial.sql src/db/schema.test.ts
git commit -m "feat: initial D1 schema with owner and confirmation invariants"
```

---

## Self-Review

**Spec coverage for this sub-project:**

| Spec section | Task |
|---|---|
| §3 Step 2 priority formula | Task 3 |
| §3 "shows its working" | Task 3 (`contributions`) |
| §4.1 Company | Task 5 |
| §4.2 Human, hourly rate | Task 5 |
| §4.3 Agent, owner required | Task 5 (`NOT NULL` + `RESTRICT`) |
| §4.4 Outcome, four signals | Task 4, Task 5 (`source` CHECK) |
| §4.5 Rollup, pure functions | Task 4 |
| §5.1 Global leaderboard opt-in at company level | Task 5 |
| §8 skipped period is null not zero | Task 4, Task 5 |
| §8 setup_effort zero rejected | Task 3, Task 5 |
| §8 all-zero goal weights rejected | Task 2 |
| §8 no orphaned agents | Task 5 (`ON DELETE RESTRICT`) |

Deferred to later plans by design: onboarding UI, agent design flow, daily confirm UI,
dashboards, leaderboard rendering, themes, auth.

**Type consistency:** `GoalType` and `GOAL_TYPES` defined in Task 2 are the only source
of goal names; Tasks 3, 4 and 5 all use them. SQL `CHECK` lists match `GOAL_TYPES`
exactly. `SignalSource` in Task 4 matches the `source` CHECK in Task 5.

**Placeholder scan:** no TBD, no "add error handling", every code step carries complete code.
