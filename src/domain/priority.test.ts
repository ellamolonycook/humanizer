import { describe, expect, it } from "vitest";
import type { GoalWeight } from "./goals.js";
import {
  InvalidCandidateError,
  rankByImpact,
  rankByQuickWin,
  recommend,
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

describe("rankByQuickWin", () => {
  it("returns highest score first", () => {
    const cheap = candidate({ id: "cheap", expectedImpact: { time: 8 }, setupEffort: 1 });
    const dear = candidate({ id: "dear", expectedImpact: { time: 8 }, setupEffort: 4 });
    const ranked = rankByQuickWin([dear, cheap], timeOnly);
    expect(ranked.map((r) => r.candidate.id)).toEqual(["cheap", "dear"]);
  });

  it("breaks ties by name so the order is stable across reloads", () => {
    const b = candidate({ id: "b", name: "Beta" });
    const a = candidate({ id: "a", name: "Alpha" });
    const ranked = rankByQuickWin([b, a], timeOnly);
    expect(ranked.map((r) => r.candidate.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const input = [candidate({ id: "x", setupEffort: 4 }), candidate({ id: "y", setupEffort: 1 })];
    rankByQuickWin(input, timeOnly);
    expect(input.map((c) => c.id)).toEqual(["x", "y"]);
  });

  it("returns an empty list for no candidates", () => {
    expect(rankByQuickWin([], timeOnly)).toEqual([]);
  });
});

describe("rankByImpact", () => {
  it("ranks on weighted impact alone, ignoring effort", () => {
    const big = candidate({ id: "big", expectedImpact: { time: 9 }, setupEffort: 5 });
    const cheap = candidate({ id: "cheap", expectedImpact: { time: 6 }, setupEffort: 1 });
    // The exact regression that made Caption Writer beat Chief of Staff.
    expect(rankByImpact([cheap, big], timeOnly).map((r) => r.candidate.id)).toEqual([
      "big",
      "cheap",
    ]);
  });

  it("still divides by effort on the quick-win list", () => {
    const big = candidate({ id: "big", expectedImpact: { time: 9 }, setupEffort: 5 });
    const cheap = candidate({ id: "cheap", expectedImpact: { time: 6 }, setupEffort: 1 });
    expect(rankByQuickWin([big, cheap], timeOnly).map((r) => r.candidate.id)).toEqual([
      "cheap",
      "big",
    ]);
  });

  it("exposes impact and score separately on every result", () => {
    const c = candidate({ expectedImpact: { time: 8 }, setupEffort: 2 });
    const [r] = rankByImpact([c], timeOnly);
    expect(r?.impact).toBe(8);
    expect(r?.score).toBe(4);
  });

  it("breaks ties by name so the order is stable", () => {
    const b = candidate({ id: "b", name: "Beta" });
    const a = candidate({ id: "a", name: "Alpha" });
    expect(rankByImpact([b, a], timeOnly).map((r) => r.candidate.id)).toEqual(["a", "b"]);
  });
});

describe("recommend", () => {
  it("returns both lists", () => {
    const big = candidate({ id: "big", expectedImpact: { time: 9 }, setupEffort: 5 });
    const cheap = candidate({ id: "cheap", expectedImpact: { time: 6 }, setupEffort: 1 });
    const out = recommend([big, cheap], timeOnly);
    expect(out.biggestImpact[0]?.candidate.id).toBe("big");
    expect(out.quickestWins[0]?.candidate.id).toBe("cheap");
  });

  it("puts the same agents in both lists, only ordered differently", () => {
    const cs = [candidate({ id: "a" }), candidate({ id: "b", setupEffort: 9 })];
    const out = recommend(cs, timeOnly);
    const ids = (l: typeof out.biggestImpact): string[] =>
      l.map((r) => r.candidate.id).sort();
    expect(ids(out.biggestImpact)).toEqual(ids(out.quickestWins));
  });

  it("handles an empty library", () => {
    const out = recommend([], timeOnly);
    expect(out.biggestImpact).toEqual([]);
    expect(out.quickestWins).toEqual([]);
  });
});
