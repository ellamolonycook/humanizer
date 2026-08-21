import { describe, expect, it } from "vitest";
import type { GoalWeight } from "../domain/goals.js";
import { escapeHtml, renderPage } from "./render.js";
import { SEED_LIBRARY } from "../domain/seed-library.js";

const timeLed: GoalWeight[] = [
  { goal: "time", weight: 1 },
  { goal: "headspace", weight: 0.8 },
];

describe("escapeHtml", () => {
  it("escapes the characters that break out of markup", () => {
    expect(escapeHtml(`<script>&"'`)).toBe("&lt;script&gt;&amp;&quot;&#39;");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeHtml("Chief of Staff")).toBe("Chief of Staff");
  });
});

describe("renderPage", () => {
  const html = renderPage(timeLed);

  it("is a complete document", () => {
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("</html>");
  });

  it("shows both lists", () => {
    expect(html).toContain("Biggest impact");
    expect(html).toContain("Quickest wins");
  });

  it("shows at most five per list, because a ranked eleven is a spreadsheet", () => {
    const count = (section: string): number =>
      (section.match(/class="row"/g) ?? []).length;
    const impact = html.slice(html.indexOf("Biggest impact"), html.indexOf("Quickest wins"));
    const wins = html.slice(html.indexOf("Quickest wins"));
    expect(count(impact)).toBeLessThanOrEqual(5);
    expect(count(impact)).toBeGreaterThan(0);
    expect(count(wins)).toBeLessThanOrEqual(5);
    expect(count(wins)).toBeGreaterThan(0);
  });

  it("surfaces genuinely different agents across the two lists", () => {
    // If both lists named the same five, showing two lists would be theatre.
    const shown = SEED_LIBRARY.filter((a) => html.includes(escapeHtml(a.name)));
    expect(shown.length).toBeGreaterThan(5);
  });

  it("leads biggest impact with Chief of Staff for a time-led founder", () => {
    const section = html.slice(
      html.indexOf("Biggest impact"),
      html.indexOf("Quickest wins"),
    );
    const first = section.indexOf("Chief of Staff");
    const others = SEED_LIBRARY.filter((a) => a.name !== "Chief of Staff")
      .map((a) => section.indexOf(a.name))
      .filter((i) => i >= 0);
    expect(first).toBeGreaterThan(-1);
    for (const o of others) expect(first).toBeLessThan(o);
  });

  it("shows the arithmetic behind every ranking", () => {
    // The product promises the order survives being said out loud.
    expect(html).toContain("time 9");
    expect(html).toMatch(/effort/i);
  });

  it("reflects the current weights in the slider values", () => {
    expect(html).toContain('name="time"');
    expect(html).toContain('value="1"');
    expect(html).toContain('value="0.8"');
  });

  it("works without JavaScript by submitting a plain form", () => {
    expect(html).toContain("<form");
    expect(html).toMatch(/method="get"/i);
  });

  it("carries the brand green", () => {
    expect(html.toUpperCase()).toContain("#CCEEA0");
  });

  it("defines colours for both themes", () => {
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain('[data-theme="dark"]');
  });

  it("escapes agent names rather than trusting them", () => {
    const nasty = [
      {
        id: "x",
        name: '<img src=x onerror="alert(1)">',
        jobDescription: "Tries to break out of the markup.",
        expectedImpact: { time: 5 },
        setupEffort: 1,
        handsOffTo: [],
        source: "timerich-current" as const,
      },
    ];
    const out = renderPage(timeLed, nasty);
    expect(out).not.toContain("<img src=x");
    expect(out).toContain("&lt;img src=x");
  });
});
