import { describe, expect, it } from "vitest";
import { handle } from "./index.js";

const get = (url: string): Response => handle(new Request(url));

describe("handle", () => {
  it("serves the page at the root", async () => {
    const res = get("https://x.dev/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    await expect(res.text()).resolves.toContain("What should I build next");
  });

  it("uses the default weights when no query is given", async () => {
    const body = await get("https://x.dev/").text();
    expect(body).toContain("Chief of Staff");
  });

  it("lets the query change the ranking", async () => {
    const revenue = await get("https://x.dev/?revenue=1").text();
    const impact = revenue.slice(
      revenue.indexOf("Biggest impact"),
      revenue.indexOf("Quickest wins"),
    );
    // Closer is the revenue agent; it should now lead where Chief of Staff did.
    expect(impact.indexOf("Closer")).toBeGreaterThan(-1);
    expect(impact.indexOf("Closer")).toBeLessThan(
      impact.indexOf("Chief of Staff") === -1 ? Infinity : impact.indexOf("Chief of Staff"),
    );
  });

  it("does not fall over on a hand-mangled query", () => {
    expect(get("https://x.dev/?time=banana&revenue=-99").status).toBe(200);
  });

  it("answers a health check", async () => {
    const res = get("https://x.dev/health");
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe("ok");
  });

  it("404s an unknown path", () => {
    expect(get("https://x.dev/nope").status).toBe(404);
  });

  it("405s a non-GET method", () => {
    expect(handle(new Request("https://x.dev/", { method: "POST" })).status).toBe(405);
  });

  it("tells browsers not to cache the ranking", () => {
    expect(get("https://x.dev/").headers.get("cache-control")).toContain("no-store");
  });
});
