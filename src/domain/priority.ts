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
