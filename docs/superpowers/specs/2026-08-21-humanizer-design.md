# Humanizer — Design Spec

**Date:** 2026-08-21
**Status:** Approved for planning
**Repo:** `ellamolonycook/humanizer`

---

## 1. What this is

A team workspace where a company maps its AI workforce — **named agents with job
descriptions, each attached to a human owner** — decides *which agents to build first*
based on what that company is actually optimising for, and then measures whether those
agents delivered what they promised.

The name is literal: it humanizes the AI workforce. Agents have names, job
descriptions, and a human they report to.

### Why this exists

Reviewed against Paperclip, Mycelium, Launch Lemonade and Super Agent, three things
are missing from every one of them:

1. A humanized agent org chart — named agents with job descriptions, attached to humans
2. A coaching layer that guides a non-technical founder through the decision
3. Gamification tied to a real outcome, not vanity activity

Launch Lemonade is closest in spirit and has the cleanest UX. The rest read as built
for engineers. The gap is the coaching methodology, and that methodology is the
product's core IP — not the infrastructure.

### Who it is for

Non-technical founders and their teams. The primary user is a founder who knows she
should be delegating to AI, does not know which agent to build first, and cannot tell
afterwards whether it worked.

---

## 2. Scope of this MVP

### In

- Goals-first onboarding (what are you optimising for?)
- Explainable agent prioritisation (what should you build first, and why?)
- Agent org chart — agents grouped under the humans who own them
- Agent design flow that outputs a take-away prompt
- Outcome tracking — predicted vs actual, per goal, per human, per company
- Leaderboard and gold stars, scored on outcomes
- Team workspace with real logins
- Themeable persona UI

### Out (deliberately)

| Deferred | Why |
|---|---|
| Agents executing in-product | Months of runtime engineering. Ship the map first; execution is v2. |
| Gmail / Slack / platform integrations | Google *restricted* scopes require OAuth verification plus a third-party CASA security assessment — a multi-week-to-months process with real cost. It cannot gate an MVP. |
| Billing | Prove people want the map before charging for it. |
| Draft-feedback, platform-metric and check-in signals | Interface defined in MVP, implementations in v2. See §4.4. |

An earlier version of this design had 2–3 flagship agents actually executing. That was
dropped: the runtime work (API keys, job queues, tool access, per-user cost control,
sandboxing) is the expensive part, and it is the part where this product would compete
with well-funded engineering teams rather than on its actual advantage.

---

## 3. The core loop

Three steps. This *is* the coaching methodology, expressed as software.

### Step 1 — What matters to you?

The founder picks and ranks what she is optimising for. Multiple goals allowed, each
carrying a weight.

| Goal | Unit | Notes |
|---|---|---|
| Time back | hours per day, rolled up | The Time Rich thesis, made literal |
| Revenue | £ generated or pipelined | Justifies price, hardest to attribute honestly |
| Capacity | volume handled without hiring | Good proxy when revenue attribution is murky |
| Headspace | stress / context-switching load | Self-rated; the one founders name first and measure last |

Goals are per-company, set during onboarding, editable later. Changing weights
re-ranks the agent backlog — which is a coaching moment, not a bug.

> **"Period" means one day** throughout this spec — the confirmation cadence and the
> finest rollup granularity. Confirmed by Ella on 2026-08-21, over a weekly default and
> an explicit warning that daily check-ins are the first thing users abandon.
>
> That choice sets a hard design constraint: **the daily confirm must be genuinely one
> tap.** Anything that asks a founder to type at the end of her day will not get done,
> and an empty dashboard is worse than no dashboard. Dashboards roll daily outcomes up
> to weekly and monthly views; nobody reads a daily number.

### Step 2 — Which agents first?

Every candidate agent declares an **expected impact** against each goal, plus a
**setup effort**. That yields a score:

```
impact   = Σ (expected_impact[goal] × goal_weight[goal])
quickWin = impact ÷ setup_effort
```

Deliberately simple arithmetic. The requirement is not that it is optimal — it is that
Ella can defend the ranking out loud on a coaching call. A black-box recommender fails
that test even if it ranks better.

**Two lists, not one.** Revised 2026-08-21 after running the engine on the real agent
library. Ranking on `quickWin` alone let Caption Writer (effort 1) beat Chief of Staff
(effort 3) in two of three founder profiles, despite Chief of Staff scoring nearly double
on impact — so the product would have told a founder drowning in admin to build a caption
writer. That is not a calibration problem, it is the formula. The engine therefore returns:

| List | Ranked on | Answers |
|---|---|---|
| **Biggest impact** | `impact` | What matters most, whatever it costs |
| **Quickest wins** | `quickWin` | What to do first to get moving |

Neither is the whole truth alone, so both are shown and the founder chooses. This is also
the more coachable output — it is the conversation you would actually have on a call.

Output: *"This is what will change your business. This is what you could ship today."*

### Step 3 — Did it deliver?

Each live agent logs actuals against the goals it was chosen for. The dashboard shows
**predicted vs actual**, rolled up three ways: per agent, per human, per company.

This is what makes the system self-correcting. When predictions consistently miss in
one direction, the prioritisation model is wrong and can be corrected. That is the
honest version of "an agent that improves the system daily" — and it needs no external
APIs to work.

### Why measurement is credible

Pure self-report is vanity. API-measured is impossible at MVP. The middle path is about
*when* you ask:

| When | What's captured | Cost to user |
|---|---|---|
| Agent created | Baseline: how long this took manually, how often it runs, expected impact | A few minutes, during coaching, when she is being honest about where her time goes |
| Each day | Confirm: did it run, how long did you still spend on it | One tap |

The baseline is captured at design time — the moment the coaching conversation is
already making her quantify her workload. The ongoing ask is a single confirmation, so
people actually do it. Recurring input that takes more than a few seconds does not get
filled in, and an unfilled dashboard is worse than no dashboard.

---

## 4. Units

Each unit has one clear purpose, a defined interface, and can be understood and tested
without reading the others.

### 4.1 Company

The workspace. Owns goals, humans, agents, and all rollups.

- `id`, `name`, `created_at`
- `goals`: ranked list of `{ goal_type, weight }`
- `theme`: which persona theme pack is active

### 4.2 Human

A real account. Belongs to exactly one company in MVP.

- `id`, `company_id`, `email`, `name`, `role`
- `hourly_rate` (optional) — converts time outcomes into money
- Auth is email magic-link. No passwords, no OAuth.

**Multi-company membership is out of MVP.** One human, one company. Revisit when
someone actually asks.

### 4.3 Agent

The central object. An agent is a job, not a running process.

- `id`, `company_id`, `owner_human_id`
- `name` — agents are named, this is not optional
- `job_description` — what this agent is responsible for
- `status`: `proposed` | `building` | `live` | `retired`
- `baseline_minutes`, `runs_per_period`, `cadence`
- `setup_effort` — feeds the priority score
- `expected_impact`: `{ goal_type → value }`
- `avatar` — resolved by the active theme pack
- `prompt` — the take-away artefact the user runs elsewhere

An agent with no `owner_human_id` is invalid. Every agent reports to a human; that is
the whole premise.

### 4.4 Outcome

A typed measure with a unit. **This is the extension point.**

- `id`, `agent_id`, `period`, `goal_type`, `predicted`, `actual`, `source`

`source` names which signal produced it. MVP ships exactly one:

| Signal | Status | Needs |
|---|---|---|
| `run_log` — owner confirms runs and residual time | **MVP** | Nothing external |
| `draft_feedback` — kept/edited/binned, edit-diff as signal | v2 | Agents executing |
| `platform_metric` — real views/saves/replies | v2 | Per-user platform API access |
| `check_in` — daily coaching ritual, self-reported | v2 | Notification infrastructure |

All four write `Outcome` rows through the same interface. Adding one later does not
touch the schema, the rollups, or the dashboard. That is how "all of the above"
gets built without building all of it now.

### 4.5 Rollup

Pure functions over `Outcome`. No state of its own.

- `by_agent`, `by_human`, `by_company`
- Optional money conversion via `hourly_rate`
- Feeds both the dashboard and the leaderboard

Kept separate from storage so the scoring logic is unit-testable without a database.

---

## 5. Surfaces

| Surface | Job |
|---|---|
| **Onboarding** | Set goals and weights. The coaching moment. |
| **Backlog** | Ranked agent candidates with the reasoning shown, not hidden |
| **Org chart** | The map — agents grouped under the humans who own them |
| **Agent detail** | Job description, baseline, predicted vs actual, take-away prompt |
| **Dashboard** | Rollups: mine and ours, per goal |
| **Leaderboard** | Gold stars, scored on outcomes delivered |

### 5.1 Leaderboard scope

Two boards, confirmed 2026-08-21:

- **Company board** — always on. Teammates ranked on outcomes delivered. This is where
  the behaviour change actually comes from; social pressure works when you know the people.
- **Global board** — opt-in per company. More motivating and far more shareable, but it
  publishes one company's productivity beside another's.

The global board must be **opt-in at the company level, not per human** — a single
employee cannot expose her company's numbers. Companies that opt in appear under a
display name they choose, never their legal entity.

### UI direction

Light, animated, cartoonish, persona-driven. The user picks a theme (Friends, Mario,
Powerpuff). Themes are **CSS custom-property packs plus an avatar set** — swapping a
token file, not a rebuild. Theme choice must never affect layout or data.

---

## 6. Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Cloudflare Workers | Already deploys timerich.ai; one pipeline to understand |
| Data | Cloudflare D1 (SQLite) | Relational fits this model; cheap at low scale |
| Language | TypeScript | Workers-native |
| Auth | Email magic-link | No passwords, no OAuth verification process |
| UI | Server-rendered + light JS | Fast, indexable, no SPA weight for six screens |

Verified locally: node v24.14.1, npm 11.11.0, wrangler 4.125.0 available via `npx`.

### Known risk: iCloud

This repo lives under iCloud Drive, which evicts files silently. `node_modules` in
iCloud is a known source of corruption and slow installs. Mitigations, in order of
preference:

1. Move the working clone outside iCloud (`~/dev/humanizer`) — cleanest
2. Keep it here, but treat **origin as the only durable copy** and never trust local
   disk state without re-checking

**Resolved 2026-08-21:** the working clone lives at `~/dev/humanizer`, outside iCloud.
Origin remains the only durable copy.

---

## 7. Data flow

```
Onboarding ──> Company.goals (ranked, weighted)
                    │
                    ▼
          Agent candidates declare expected_impact + setup_effort
                    │
                    ▼
             priority score ──> ranked Backlog
                    │
              (founder builds one)
                    ▼
          Agent status: proposed ──> building ──> live
                    │
              each period: owner confirms run_log
                    ▼
              Outcome rows (predicted vs actual)
                    │
                    ▼
        Rollup ──> Dashboard (mine / ours) + Leaderboard
                    │
                    ▼
        prediction error ──> corrects future priority scoring
```

---

## 8. Error handling

| Case | Behaviour |
|---|---|
| Owner skips a period's confirmation | Outcome is `null`, not zero. Gaps must never read as failure. |
| Agent has no baseline | Cannot go `live`. Blocked with an explanation, not a silent default. |
| Goal weights all zero | Rejected at onboarding — priority would be undefined |
| `setup_effort` is zero | Rejected — division by zero |
| Human deleted with live agents | Agents are reassigned or retired. No orphans. |
| Predicted vastly exceeds actual, repeatedly | Surfaced as a coaching prompt, never as a penalty |

The last one is a product decision, not a technical one: a founder whose predictions
miss is the exact person who needs coaching, and punishing her for logging honestly
would destroy the data quality the whole system depends on.

---

## 9. Testing

| Layer | Approach |
|---|---|
| Rollup + priority scoring | Pure unit tests. No database. Highest-value tests in the codebase. |
| Outcome interface | Contract test that any signal implementation must pass |
| Schema | Migration tests against D1 local |
| Auth | Magic-link issue, expiry, single-use, replay rejection |
| Surfaces | Smoke tests per screen |

Priority scoring and rollups are pure functions by design specifically so they can be
tested exhaustively without infrastructure.

---

## 10. Open questions

Answered before implementation begins:

1. **Who seeds the agent candidate library?** The backlog needs candidates to rank, or
   step 2 has nothing to work with. `OS - Time Rich /Build-ARCHIVE-businessOS/Agent
   Packs/` in Ella's vault is the obvious seed source — awaiting the go-ahead to mine it.
2. **Email provider for magic links** — Resend is the fastest path. Needs an API key and
   a verified sending domain. Nobody can log in until this exists.
3. **Domain** — `humanizer.timerich.ai` or its own?
4. **Cloudflare API token** — `Workers Scripts:Edit` + `D1:Edit`. Blocks deploy, not
   local development.

### Resolved

- ~~iCloud vs local clone~~ → moved to `~/dev/humanizer` on 2026-08-21
- ~~Period length~~ → **daily** (§3)
- ~~Leaderboard scope~~ → **both** (§5.1)

---

## 11. Decisions already made

Recorded so they are not relitigated:

| Decision | Rationale |
|---|---|
| Not a text de-AI tool | "Humanizer" refers to humanizing the AI workforce |
| Agents do not execute in MVP | Runtime engineering is where this loses to funded teams |
| Team logins, not solo | The leaderboard has to be social to matter |
| Goals are chosen, not assumed | Founders optimise for different things; assuming time was wrong |
| Priority scoring stays simple arithmetic | Must be defensible out loud on a coaching call |
| Two ranked lists, not one | Dividing by effort alone recommends trivial agents over transformative ones |
| One signal in MVP, four in the interface | Ships now, extends without schema change |
| Daily confirmation cadence | Ella's call over a weekly default; forces the one-tap constraint |
| Two leaderboards, global opt-in at company level | Social pressure needs people you know; sharing needs consent |
| Working clone outside iCloud | iCloud evicts files silently and corrupts `node_modules` |
