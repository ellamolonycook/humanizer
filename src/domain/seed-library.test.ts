import { describe, expect, it } from "vitest";
import { GOAL_TYPES, type GoalWeight } from "./goals.js";
import { rankByQuickWin } from "./priority.js";
import { SEED_LIBRARY, seedById } from "./seed-library.js";

describe("SEED_LIBRARY", () => {
  it("ships a usable starter set", () => {
    expect(SEED_LIBRARY.length).toBeGreaterThanOrEqual(10);
  });

  it("gives every agent a unique id", () => {
    const ids = SEED_LIBRARY.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every agent a name and a job description", () => {
    for (const a of SEED_LIBRARY) {
      expect(a.name.length, a.id).toBeGreaterThan(0);
      expect(a.jobDescription.length, a.id).toBeGreaterThan(20);
    }
  });

  it("gives every agent a setup effort above zero", () => {
    for (const a of SEED_LIBRARY) {
      expect(a.setupEffort, a.id).toBeGreaterThan(0);
    }
  });

  it("keeps every expected impact within 0..10", () => {
    for (const a of SEED_LIBRARY) {
      for (const goal of GOAL_TYPES) {
        const impact = a.expectedImpact[goal];
        if (impact !== undefined) {
          expect(impact, `${a.id}.${goal}`).toBeGreaterThanOrEqual(0);
          expect(impact, `${a.id}.${goal}`).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it("only hands off to agents that exist", () => {
    const ids = new Set(SEED_LIBRARY.map((a) => a.id));
    for (const a of SEED_LIBRARY) {
      for (const target of a.handsOffTo) {
        expect(ids.has(target), `${a.id} -> ${target}`).toBe(true);
      }
    }
  });

  it("never hands off to itself", () => {
    for (const a of SEED_LIBRARY) {
      expect(a.handsOffTo, a.id).not.toContain(a.id);
    }
  });

  it("marks every agent's provenance", () => {
    for (const a of SEED_LIBRARY) {
      expect(["timerich-archive", "timerich-current"]).toContain(a.source);
    }
  });
});

describe("seedById", () => {
  it("finds an agent by id", () => {
    expect(seedById("chief-of-staff")?.name).toBe("Chief of Staff");
  });

  it("returns undefined for an unknown id", () => {
    expect(seedById("nope")).toBeUndefined();
  });
});

describe("the library against the scoring engine", () => {
  const only = (goal: (typeof GOAL_TYPES)[number]): GoalWeight[] => [
    { goal, weight: 1 },
  ];

  it("ranks without throwing under any single goal", () => {
    for (const goal of GOAL_TYPES) {
      expect(() => rankByQuickWin(SEED_LIBRARY, only(goal))).not.toThrow();
    }
  });

  it("returns every agent, ranked", () => {
    const ranked = rankByQuickWin(SEED_LIBRARY, only("time"));
    expect(ranked).toHaveLength(SEED_LIBRARY.length);
  });

  it("produces a different winner for revenue than for time", () => {
    const topFor = (goal: (typeof GOAL_TYPES)[number]): string =>
      rankByQuickWin(SEED_LIBRARY, only(goal))[0]!.candidate.id;
    // If these matched, the library would be degenerate: goals would not
    // actually change what the product recommends.
    expect(topFor("revenue")).not.toBe(topFor("time"));
  });

  it("gives every agent a non-zero score on at least one goal", () => {
    for (const a of SEED_LIBRARY) {
      const best = GOAL_TYPES.map(
        (g) => rankByQuickWin([a], only(g))[0]!.score,
      ).reduce((m, s) => Math.max(m, s), 0);
      expect(best, `${a.id} is worthless on every goal`).toBeGreaterThan(0);
    }
  });
});
