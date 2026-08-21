import type { AgentCandidate } from "./priority.js";

/**
 * A starter agent in the candidate library.
 *
 * `handsOffTo` is what makes this an org chart rather than a list: the source
 * packs already define who passes work to whom, so the map has edges from day
 * one instead of waiting for a user to draw them.
 */
export interface SeedAgent extends AgentCandidate {
  readonly jobDescription: string;
  readonly handsOffTo: readonly string[];
  readonly source: "timerich-archive" | "timerich-current";
}

/**
 * Seeded from Ella's Time Rich agent packs.
 *
 * ⚠️ CALIBRATION NOT CONFIRMED. The `expectedImpact` and `setupEffort` numbers
 * below are a first-pass estimate made while building the library, NOT values
 * Ella supplied. They decide what the product tells a founder to build first,
 * so they need her review before this ships to anyone. The names, job
 * descriptions and handoffs all come from the source packs and are faithful.
 */
export const SEED_LIBRARY: readonly SeedAgent[] = [
  {
    id: "chief-of-staff",
    name: "Chief of Staff",
    jobDescription:
      "Triages your inbox into reply-now, reply-this-week, FYI and delete — and drafts the first bucket so you are approving rather than writing.",
    expectedImpact: { time: 9, revenue: 2, capacity: 7, headspace: 9 },
    setupEffort: 3,
    handsOffTo: ["closer"],
    source: "timerich-archive",
  },
  {
    id: "strategist",
    name: "Strategist",
    jobDescription:
      "Decides what you should be talking about this week and hands the angle to the writers. Owns the what, never the words.",
    expectedImpact: { time: 5, revenue: 5, capacity: 5, headspace: 7 },
    setupEffort: 2,
    handsOffTo: ["hook-writer", "ghostwriter"],
    source: "timerich-archive",
  },
  {
    id: "hook-writer",
    name: "Hook Writer",
    jobDescription:
      "Takes an angle and returns ten ranked opening lines with a note on why each works. Flags any hook the body cannot pay off.",
    expectedImpact: { time: 3, revenue: 5, capacity: 4, headspace: 2 },
    setupEffort: 1,
    handsOffTo: ["ghostwriter", "video-editor", "carousel-designer"],
    source: "timerich-archive",
  },
  {
    id: "ghostwriter",
    name: "Ghostwriter",
    jobDescription:
      "Writes the body of the post in your voice, serving the hook that won. Never picks the topic and never writes the opener.",
    expectedImpact: { time: 8, revenue: 4, capacity: 8, headspace: 5 },
    setupEffort: 3,
    handsOffTo: ["substack-copywriter"],
    source: "timerich-archive",
  },
  {
    id: "closer",
    name: "Closer",
    jobDescription:
      "Stops leads dying in your inbox. Picks up every 'send me more info' and follows through before the moment goes cold.",
    expectedImpact: { time: 4, revenue: 9, capacity: 5, headspace: 4 },
    setupEffort: 2,
    handsOffTo: [],
    source: "timerich-archive",
  },
  {
    id: "outbound-hunter",
    name: "Outbound Hunter",
    jobDescription:
      "Finds the people who should be buying from you, opens the conversation in your voice, and sends the follow-up nobody sends.",
    expectedImpact: { time: 5, revenue: 8, capacity: 7, headspace: 3 },
    setupEffort: 4,
    handsOffTo: ["closer"],
    source: "timerich-archive",
  },
  {
    id: "video-editor",
    name: "Video Editor",
    jobDescription:
      "Cuts raw footage to the spoken hook and ships the edit, so recording is the only part that still needs you.",
    expectedImpact: { time: 9, revenue: 3, capacity: 7, headspace: 4 },
    setupEffort: 5,
    handsOffTo: [],
    source: "timerich-archive",
  },
  {
    id: "substack-copywriter",
    name: "Substack Copywriter",
    jobDescription:
      "Turns the week's published material into the newsletter, including subject line and preview text.",
    expectedImpact: { time: 7, revenue: 4, capacity: 6, headspace: 4 },
    setupEffort: 3,
    handsOffTo: [],
    source: "timerich-archive",
  },
  {
    id: "researcher",
    name: "Researcher",
    jobDescription:
      "Gathers the evidence, sources and competitor material a post or pitch needs, so nobody writes from memory.",
    expectedImpact: { time: 6, revenue: 3, capacity: 6, headspace: 5 },
    setupEffort: 2,
    handsOffTo: ["strategist"],
    source: "timerich-current",
  },
  {
    id: "carousel-designer",
    name: "Carousel Designer",
    jobDescription:
      "Turns a winning hook into a full Instagram carousel, cover slide through call to action.",
    expectedImpact: { time: 7, revenue: 3, capacity: 7, headspace: 3 },
    setupEffort: 3,
    handsOffTo: [],
    source: "timerich-current",
  },
  {
    id: "caption-writer",
    name: "Caption Writer",
    jobDescription:
      "Writes the caption under the asset — the part everyone rushes and then wonders why the post underperformed.",
    expectedImpact: { time: 6, revenue: 3, capacity: 6, headspace: 3 },
    setupEffort: 1,
    handsOffTo: [],
    source: "timerich-current",
  },
] as const;

const BY_ID = new Map(SEED_LIBRARY.map((a) => [a.id, a]));

export function seedById(id: string): SeedAgent | undefined {
  return BY_ID.get(id);
}
