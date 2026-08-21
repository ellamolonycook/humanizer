import { describe, expect, it } from "vitest";
import { VERSION } from "./index.js";

describe("package", () => {
  it("exposes a version string", () => {
    expect(VERSION).toBe("0.0.1");
  });
});
