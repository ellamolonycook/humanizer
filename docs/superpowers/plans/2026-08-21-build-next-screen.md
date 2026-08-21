# "What Should I Build Next" Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A working screen Ella can open tomorrow morning: set her goal weights, see her
agents ranked two ways — biggest impact and quickest wins — with the arithmetic shown.

**Architecture:** A Cloudflare Worker that server-renders one page. State lives in the
query string, so there is **no database, no auth, and no Cloudflare account needed** to
run it — `wrangler dev` serves it locally. The request handler is a pure
`(Request) => Response` function, so it is fully testable with plain vitest and needs no
Workers test pool.

**Tech Stack:** TypeScript, Cloudflare Workers, vitest. No runtime dependencies.

## Why this shape

Single-tenant changes the calculus. Ella is the only user, so the expensive parts —
magic-link auth, multi-tenancy, invites, the global leaderboard — are all deleted rather
than deferred. What remains is small enough to finish in one sitting.

Query-string state is a deliberate first move, not laziness: it makes the whole app a
pure function of the URL, which means every ranking is shareable and bookmarkable, and it
defers D1 until there is something worth persisting (the daily confirms, not the sliders).

## Global Constraints

- No runtime dependencies. Workers ship small.
- The request handler stays pure: `handle(request: Request): Response`. No globals, no I/O.
- **Every ranked row must show its arithmetic.** Same rule as the engine — the order has
  to be defensible out loud.
- Brand: pastel green `#CCEEA0` is the hero colour, violet `#7C3AED` carries interaction.
- Page must work with JavaScript disabled — sliders submit a plain form.
- Both light and dark themes.

---

### Task 1: Parse goal weights from the query string

**Files:**
- Create: `src/worker/query.ts`
- Test: `src/worker/query.test.ts`

**Interfaces:**
- Consumes: `GOAL_TYPES`, `GoalWeight` from `../domain/goals.js`
- Produces: `function goalsFromQuery(params: URLSearchParams): GoalWeight[]`

Returns a sensible default when the query is empty or unusable, because the first visit
has no query string and an error page is a terrible front door.

- [ ] **Step 1: Write the failing tests** — cover: empty params returns a non-empty
  default; a single goal parses; several goals parse; out-of-range clamps to 0..1;
  non-numeric is dropped; an unknown goal name is ignored; all-zero falls back to the
  default rather than throwing (the engine rejects all-zero weights, and the page must
  not 500 on a hand-edited URL).

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/worker/query.test.ts`

- [ ] **Step 3: Implement `goalsFromQuery`.**

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit.** `feat: parse goal weights from the query string`

---

### Task 2: Render the page

**Files:**
- Create: `src/worker/render.ts`
- Test: `src/worker/render.test.ts`

**Interfaces:**
- Consumes: `recommend`, `ScoredCandidate` from `../domain/priority.js`; `SEED_LIBRARY`
- Produces: `function renderPage(weights: readonly GoalWeight[]): string`

- [ ] **Step 1: Write the failing tests** — cover: output contains both list headings;
  every seeded agent appears; the top biggest-impact agent for a time-weighted profile is
  Chief of Staff; each row shows its contribution arithmetic; slider values reflect the
  current weights; HTML special characters in agent names are escaped.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement `renderPage`** with an `escapeHtml` helper.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit.** `feat: render the build-next page`

---

### Task 3: The request handler

**Files:**
- Create: `src/worker/index.ts`
- Test: `src/worker/index.test.ts`

**Interfaces:**
- Produces: `function handle(request: Request): Response` and a default export
  `{ fetch }` for Workers.

- [ ] **Step 1: Write the failing tests** — cover: `GET /` returns 200 with
  `text/html; charset=utf-8`; query params flow through to the ranking; an unknown path
  returns 404; `POST` returns 405; `/health` returns 200 `ok`.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement the handler.**

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit.** `feat: worker request handler`

---

### Task 4: Wrangler config and a real local run

**Files:**
- Create: `wrangler.toml`
- Modify: `package.json` (add `dev` and `deploy` scripts)

- [ ] **Step 1: Write `wrangler.toml`.** No D1 binding yet — nothing is persisted.

- [ ] **Step 2: Add scripts** — `"dev": "wrangler dev"`, `"deploy": "wrangler deploy"`.

- [ ] **Step 3: Start `wrangler dev` and curl it.** This is the step that proves it
  actually serves rather than merely typechecking. Expected: HTTP 200, body contains
  "Chief of Staff".

- [ ] **Step 4: Commit.** `feat: wrangler config and dev server`

---

## Deliberately not in this plan

- D1 persistence — arrives with the daily confirm, which is the first thing worth storing
- Auth — one user
- Editing agents in the UI — the seeded library is the starting point
- Deployment — needs a Cloudflare token; `wrangler dev` works without one
