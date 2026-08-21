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
