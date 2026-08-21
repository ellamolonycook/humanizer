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
