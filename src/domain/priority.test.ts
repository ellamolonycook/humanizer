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
    expect(scoreCandidate(candidate(), timeOnly).score).toBe(4);
  });

  it("sums contributions across several goals", () => {
    const weights: GoalWeight[] = [
      { goal: "time", weight: 0.5 },
      { goal: "revenue", weight: 1 },
    ];
    const c = candidate({ expectedImpact: { time: 8, revenue: 6 }, setupEffort: 2 });
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
