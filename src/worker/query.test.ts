import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, goalsFromQuery } from "./query.js";

const q = (s: string): URLSearchParams => new URLSearchParams(s);

describe("goalsFromQuery", () => {
  it("returns the default when there is no query at all", () => {
    expect(goalsFromQuery(q(""))).toEqual(DEFAULT_WEIGHTS);
  });

  it("parses a single goal", () => {
    expect(goalsFromQuery(q("time=1"))).toEqual([{ goal: "time", weight: 1 }]);
  });

  it("parses several goals in GOAL_TYPES order", () => {
    expect(goalsFromQuery(q("revenue=0.4&time=0.9"))).toEqual([
      { goal: "time", weight: 0.9 },
      { goal: "revenue", weight: 0.4 },
    ]);
  });

  it("clamps a weight above 1", () => {
    expect(goalsFromQuery(q("time=5"))).toEqual([{ goal: "time", weight: 1 }]);
  });

  it("clamps a negative weight to zero and falls back when nothing is left", () => {
    expect(goalsFromQuery(q("time=-3"))).toEqual(DEFAULT_WEIGHTS);
  });

  it("drops a non-numeric weight", () => {
    expect(goalsFromQuery(q("time=lots&revenue=0.5"))).toEqual([
      { goal: "revenue", weight: 0.5 },
    ]);
  });

  it("ignores query keys that are not goals", () => {
    expect(goalsFromQuery(q("time=1&utm_source=twitter"))).toEqual([
      { goal: "time", weight: 1 },
    ]);
  });

  it("falls back to the default when every weight is zero", () => {
    // The engine rejects all-zero weights. A hand-edited URL must not 500.
    expect(goalsFromQuery(q("time=0&revenue=0"))).toEqual(DEFAULT_WEIGHTS);
  });

  it("keeps a zero weight when another goal carries weight", () => {
    expect(goalsFromQuery(q("time=0&revenue=1"))).toEqual([
      { goal: "time", weight: 0 },
      { goal: "revenue", weight: 1 },
    ]);
  });

  it("always returns weights the engine will accept", () => {
    for (const s of ["", "time=0", "nonsense=1", "time=abc", "time=-1&revenue=-1"]) {
      const w = goalsFromQuery(q(s));
      expect(w.length, s).toBeGreaterThan(0);
      expect(w.reduce((t, x) => t + x.weight, 0), s).toBeGreaterThan(0);
    }
  });
});
