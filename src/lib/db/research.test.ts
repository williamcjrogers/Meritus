import { describe, it, expect, vi, afterEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { ResearchFetchError } from "@/lib/research/errors";
import { createResearchRepository, withResearchRun } from "./research";
vi.mock("@/lib/research/roles", () => ({ requireResearchDirector: vi.fn().mockResolvedValue("director") }));
const dialect = new PgDialect();
function repository() {
  const execute = vi.fn().mockResolvedValue({ rows: [] });
  return { execute, repo: createResearchRepository({ execute } as never) };
}
afterEach(() => vi.unstubAllEnvs());
describe("research repository boundaries", () => {
  it("requires an explicit run context before reserving network calls", async () => {
    const { repo, execute } = repository();
    await expect(repo.reserveSourceRequest("source")).rejects.toThrow("research_run_context_required");
    expect(execute).not.toHaveBeenCalled();
  });
  it("uses AsyncLocalStorage isolation across simultaneous runs", async () => {
    const { repo, execute } = repository();
    await Promise.all([withResearchRun("run-a", () => repo.reserveSourceRequest("source")), withResearchRun("run-b", () => repo.reserveSourceRequest("source"))]);
    expect(execute.mock.calls.map(([query]) => dialect.sqlToQuery(query).params)).toEqual([["source", "run-a"], ["source", "run-b"]]);
  });
  it("retains rolling window retry delay while redacting database errors", async () => {
    const { repo, execute } = repository();
    execute.mockRejectedValue({ cause: { message: "source_rate_limit", detail: "4321" } });
    await expect(withResearchRun("run", () => repo.reserveSourceRequest("source"))).rejects.toMatchObject({ code: "source_rate_limit", status: 429, retryAfterMs: 4321 });
  });
  it("refuses fractional and negative model accounting before SQL", async () => {
    const { repo, execute } = repository();
    await expect(repo.reserveResearchModel({ sourceId: "source", runId: "run", tokens: -1, pence: 1 })).rejects.toThrow("invalid_budget");
    await expect(repo.settleResearchModel("id", { tokens: 1.1, pence: 1 })).rejects.toThrow("invalid_budget");
    expect(execute).not.toHaveBeenCalled();
  });
  it("passes unknown usage as SQL nulls rather than zero charges", async () => {
    const { repo, execute } = repository();
    await repo.settleResearchModel("reservation", null);
    expect(dialect.sqlToQuery(execute.mock.calls[0][0]).params).toEqual(["reservation", null, null]);
  });
  it("rejects oversized search input and uses bound parameters for valid text", async () => {
    const { repo, execute } = repository();
    await expect(repo.searchResearchPassages("a".repeat(501))).rejects.toThrow("invalid_search_query");
    expect(execute).not.toHaveBeenCalled();
    await repo.searchResearchPassages("claim'); drop table research_sources; --");
    const parsed = dialect.sqlToQuery(execute.mock.calls[0][0]);
    expect(parsed.sql).not.toContain("drop table"); expect(parsed.params).toContain("claim'); drop table research_sources; --");
  });
  it("does not disable a provider when one run exhausts its budget, and retries Contracts Finder throttling", async () => {
    const { repo, execute } = repository();
    const job = { id: "job", sourceId: "source", scopeKey: "test", runId: "run", payload: {}, cursor: null, leaseToken: 1, revision: 0, attempts: 1 };
    await repo.failResearchJob(job, new ResearchFetchError("run_request_budget", 403));
    let query = dialect.sqlToQuery(execute.mock.calls[0][0]);
    expect(query.params.filter(value => typeof value === "boolean")).toEqual([false, false, false]);
    execute.mockClear();
    await repo.failResearchJob(job, new ResearchFetchError("source_rate_limit", 403, 300000));
    query = dialect.sqlToQuery(execute.mock.calls[0][0]);
    expect(query.params).toContain("retry"); expect(query.params).toContain(300000);
    expect(query.params.filter(value => typeof value === "boolean")).toEqual([true, false, false]);
  });
  it("maps HTTP database lease fields explicitly without importing credentials", async () => {
    const { repo, execute } = repository();
    execute.mockResolvedValue({ rows: [{ job: { id: "job", source_id: "source", scope_key: "scope", run_id: "run", payload: {}, cursor: null, lease_token: "2", revision: "3", attempts: 1 } }] });
    expect(await repo.leaseResearchJob("worker")).toEqual({ id: "job", sourceId: "source", scopeKey: "scope", runId: "run", payload: {}, cursor: null, leaseToken: 2, revision: 3, attempts: 1 });

  });
});
