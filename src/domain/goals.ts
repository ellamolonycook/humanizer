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
