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
