import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

const SCHEMA = readFileSync("migrations/0001_initial.sql", "utf8");

let db: DatabaseSync;

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
});

function seedCompanyAndHuman(): void {
  db.exec(`INSERT INTO company (id, name, global_leaderboard_opt_in)
           VALUES ('co-1', 'Time Rich', 0);`);
  db.exec(`INSERT INTO human (id, company_id, email, name)
           VALUES ('h-1', 'co-1', 'ella@example.com', 'Ella');`);
}

describe("schema", () => {
  it("applies cleanly", () => {
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((r) => r["name"]);
    expect(names).toEqual(["agent", "company", "company_goal", "human", "outcome"]);
  });

  it("defaults a company to opted out of the global leaderboard", () => {
    db.exec(`INSERT INTO company (id, name) VALUES ('co-2', 'Acme');`);
    const row = db
      .prepare("SELECT global_leaderboard_opt_in FROM company WHERE id = 'co-2'")
      .get();
    expect(row?.["global_leaderboard_opt_in"]).toBe(0);
  });

  it("rejects a goal weight above 1", () => {
    seedCompanyAndHuman();
    expect(() =>
      db.exec(`INSERT INTO company_goal (company_id, goal, weight)
               VALUES ('co-1', 'time', 1.5);`),
    ).toThrow();
  });

  it("rejects an unknown goal type", () => {
    seedCompanyAndHuman();
    expect(() =>
      db.exec(`INSERT INTO company_goal (company_id, goal, weight)
               VALUES ('co-1', 'vibes', 0.5);`),
    ).toThrow();
  });

  it("rejects a duplicate goal for one company", () => {
    seedCompanyAndHuman();
    db.exec(`INSERT INTO company_goal (company_id, goal, weight)
             VALUES ('co-1', 'time', 0.5);`);
    expect(() =>
      db.exec(`INSERT INTO company_goal (company_id, goal, weight)
               VALUES ('co-1', 'time', 0.9);`),
    ).toThrow();
  });

  it("rejects an agent with no human owner", () => {
    seedCompanyAndHuman();
    expect(() =>
      db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
               VALUES ('ag-1', 'co-1', NULL, 'Inbox', 'Triage', 2);`),
    ).toThrow();
  });

  it("rejects an agent owned by a human who does not exist", () => {
    seedCompanyAndHuman();
    expect(() =>
      db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
               VALUES ('ag-1', 'co-1', 'nobody', 'Inbox', 'Triage', 2);`),
    ).toThrow();
  });

  it("rejects zero setup effort", () => {
    seedCompanyAndHuman();
    expect(() =>
      db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
               VALUES ('ag-1', 'co-1', 'h-1', 'Inbox', 'Triage', 0);`),
    ).toThrow();
  });

  it("rejects an agent status outside the allowed set", () => {
    seedCompanyAndHuman();
    expect(() =>
      db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort, status)
               VALUES ('ag-1', 'co-1', 'h-1', 'Inbox', 'Triage', 2, 'vibing');`),
    ).toThrow();
  });

  it("stores a NULL actual to mean an unconfirmed day", () => {
    seedCompanyAndHuman();
    db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
             VALUES ('ag-1', 'co-1', 'h-1', 'Inbox', 'Triage', 2);`);
    db.exec(`INSERT INTO outcome (id, agent_id, day, goal, predicted, actual, source)
             VALUES ('o-1', 'ag-1', '2026-08-21', 'time', 60, NULL, 'run_log');`);
    const row = db.prepare("SELECT actual FROM outcome WHERE id = 'o-1'").get();
    expect(row?.["actual"]).toBe(null);
  });

  it("rejects two outcomes for the same agent, goal and day", () => {
    seedCompanyAndHuman();
    db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
             VALUES ('ag-1', 'co-1', 'h-1', 'Inbox', 'Triage', 2);`);
    db.exec(`INSERT INTO outcome (id, agent_id, day, goal, predicted, actual, source)
             VALUES ('o-1', 'ag-1', '2026-08-21', 'time', 60, 45, 'run_log');`);
    expect(() =>
      db.exec(`INSERT INTO outcome (id, agent_id, day, goal, predicted, actual, source)
               VALUES ('o-2', 'ag-1', '2026-08-21', 'time', 60, 30, 'run_log');`),
    ).toThrow();
  });

  it("rejects a malformed day", () => {
    seedCompanyAndHuman();
    db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
             VALUES ('ag-1', 'co-1', 'h-1', 'Inbox', 'Triage', 2);`);
    expect(() =>
      db.exec(`INSERT INTO outcome (id, agent_id, day, goal, predicted, actual, source)
               VALUES ('o-1', 'ag-1', '21/08/2026', 'time', 60, 45, 'run_log');`),
    ).toThrow();
  });

  it("deletes an agent's outcomes when the agent is deleted", () => {
    seedCompanyAndHuman();
    db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
             VALUES ('ag-1', 'co-1', 'h-1', 'Inbox', 'Triage', 2);`);
    db.exec(`INSERT INTO outcome (id, agent_id, day, goal, predicted, actual, source)
             VALUES ('o-1', 'ag-1', '2026-08-21', 'time', 60, 45, 'run_log');`);
    db.exec("DELETE FROM agent WHERE id = 'ag-1';");
    const row = db.prepare("SELECT COUNT(*) AS n FROM outcome").get();
    expect(row?.["n"]).toBe(0);
  });

  it("refuses to delete a human who still owns agents, so none are orphaned", () => {
    seedCompanyAndHuman();
    db.exec(`INSERT INTO agent (id, company_id, owner_human_id, name, job_description, setup_effort)
             VALUES ('ag-1', 'co-1', 'h-1', 'Inbox', 'Triage', 2);`);
    expect(() => db.exec("DELETE FROM human WHERE id = 'h-1';")).toThrow();
  });
});
