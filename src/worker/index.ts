import { goalsFromQuery } from "./query.js";
import { renderPage } from "./render.js";

const HTML = "text/html; charset=utf-8";
const TEXT = "text/plain; charset=utf-8";

/**
 * The whole app: a pure function from Request to Response.
 *
 * Pure on purpose. No bindings, no globals, no I/O — so it is fully testable
 * with plain vitest and needs no Workers test pool. State lives in the query
 * string, which also makes every ranking shareable and bookmarkable.
 */
export function handle(request: Request): Response {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { "content-type": TEXT, allow: "GET, HEAD" },
    });
  }

  const url = new URL(request.url);

  if (url.pathname === "/health") {
    return new Response("ok", { status: 200, headers: { "content-type": TEXT } });
  }

  if (url.pathname !== "/") {
    return new Response("Not found", { status: 404, headers: { "content-type": TEXT } });
  }

  const html = renderPage(goalsFromQuery(url.searchParams));
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": HTML,
      // The ranking is a function of the query; never serve a stale one.
      "cache-control": "no-store",
    },
  });
}

export default {
  fetch(request: Request): Response {
    return handle(request);
  },
};
