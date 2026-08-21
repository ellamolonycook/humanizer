import { GOAL_TYPES, type GoalType, type GoalWeight } from "../domain/goals.js";

/**
 * What a first-time visitor sees before touching a slider.
 *
 * Time-led with headspace behind it, because that is the founder this product
 * is for: the one whose day is gone and does not know where.
 */
export const DEFAULT_WEIGHTS: readonly GoalWeight[] = [
  { goal: "time", weight: 1 },
  { goal: "headspace", weight: 0.6 },
];

function parseWeight(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1, Math.max(0, n));
}

/**
 * Reads goal weights out of the URL.
 *
 * Never throws and never returns something the engine would reject. The query
 * string is user-editable, and a hand-typed URL must not produce a 500 — the
 * worst outcome allowed here is falling back to the default.
 */
export function goalsFromQuery(params: URLSearchParams): GoalWeight[] {
  const found: GoalWeight[] = [];

  // Iterate GOAL_TYPES rather than the params so output order is always the
  // canonical display order, whatever order the query happened to be in.
  for (const goal of GOAL_TYPES satisfies readonly GoalType[]) {
    const weight = parseWeight(params.get(goal));
    if (weight !== undefined) {
      found.push({ goal, weight });
    }
  }

  const total = found.reduce((sum, w) => sum + w.weight, 0);
  return found.length > 0 && total > 0 ? found : [...DEFAULT_WEIGHTS];
}
