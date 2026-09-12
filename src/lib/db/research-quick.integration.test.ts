import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { parse as parseCsv } from "csv-parse/sync";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { EvidencePassage } from "@/lib/research/workflow-types";
import type { QuickJob } from "@/lib/research/quick-types";
import { extractEnvelope } from "@/lib/research/extract/pipeline";
import { paymentEvidence } from "@/lib/research/sources/payment-practices";

const auth = vi.hoisted(() => ({ actor: "director" }));
vi.mock("./index", () => ({ requireDb: () => ({ execute: async (statement: SQL) => {
  const compiled = new PgDialect().sqlToQuery(statement);
  const body = compiled.sql.replace(/\$(\d+)/g, (_match, n) => {
    const value = compiled.params[Number(n) - 1];
    return value === null ? "NULL" : typeof value === "number" || typeof value === "boolean" ? String(value) : "'" + String(value).replaceAll("'", "''") + "'";
  });
  return { rows: query(body) };
} }) }));
vi.mock("@/lib/research/roles", () => ({ requireResearchDirector: async () => auth.actor, readResearchActor: async () => ({ role: "director" }) }));
import { attachQuickEvidence, enqueueQuickQuestion, failQuickQuestion, findQuickEvidence, finishQuickQuestion, finishQuickUnchanged, leaseQuickQuestion, listResearchDesk, reviewOpportunity, setQuickMonitoring } from "./research-quick";

const container = process.env.RESEARCH_AUTOMATIC_TEST_CONTAINER;
const psqlArgs = ["exec", "-i", container ?? "", "psql", "-U", "research_test", "-d", "research_automatic_test", "-v", "ON_ERROR_STOP=1"];
function query(statement: string): Record<string, unknown>[] {
  if (!container || !/^qcs-research-test(?:-[a-z0-9]+)?$/.test(container)) throw new Error("Isolated automatic research test container required");
  const output = execFileSync("docker", [...psqlArgs, "-q", "--csv", "--pset", "null=__QCS_SQL_NULL__"], {
    input: "set client_min_messages=warning;" + statement + ";", encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  }).trim();
  if (!output) return [];
  return parseCsv(output, { columns: true, skip_empty_lines: true, cast: (value: string, context: { header: boolean; column: string | number }) => {
    if (context.header) return value;
    if (value === "__QCS_SQL_NULL__") return null;
    if (value === "t" || value === "f") return value === "t";
    if (["count", "enabledSources", "needsAttention", "n"].includes(String(context.column)) && /^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
    if (value.startsWith("{") || value.startsWith("[")) { try { return JSON.parse(value); } catch { return value; } }
    return value;
  } }) as Record<string, unknown>[];
}
function concurrent(statement: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn("docker", [...psqlArgs, "-qAt"]);
    let out = "", error = "";
    process.stdout.on("data", chunk => out += chunk); process.stderr.on("data", chunk => error += chunk);
    process.on("close", code => code ? reject(new Error(error)) : resolve(out.trim()));
    process.stdin.end(statement + ";");
  });
}
const json = (value: unknown) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const ids = { source: "10000000-0000-4000-8000-000000000001", rights: "10000000-0000-4000-8000-000000000002" };
function addDocument(text: string, options: { age?: number; source?: string; title?: string; passages?: string[]; future?: boolean } = {}) {
  const documentId = randomUUID(), versionId = randomUUID(), passageId = randomUUID();
  query(`insert into research_documents(id,source_id,provider_id,canonical_url,status,availability_checked_at) values('${documentId}','${options.source ?? ids.source}','${documentId}','https://example.com/${documentId}','available',now());
    insert into research_versions(id,document_id,hash,retrieved_at,published_at,content_type,parser_version,metadata) values('${versionId}','${documentId}','${versionId}',now(),now()-interval '${options.future ? -2 : options.age ?? 1} days','text/plain','1',${json({ title: options.title ?? "Synthetic construction record" })});
    update research_documents set current_version_id='${versionId}' where id='${documentId}';
    insert into research_passages(id,version_id,locator,text,hash) values('${passageId}','${versionId}','{"kind":"paragraph","value":"1"}',${json(text)}#>>'{}','${passageId}');`);
  for (const passage of options.passages ?? []) query(`insert into research_passages(version_id,locator,text,hash) values('${versionId}','{}',${json(passage)}#>>'{}','${randomUUID()}')`);
  return { documentId, versionId, passageId };
}
async function addExtractedRecord(data: Record<string, unknown>, provider: string, source = ids.source) {
  const record = addDocument("placeholder", { title: "1001", source });
  const extracted = await extractEnvelope({ sourceId: source, providerId: "1001", url: "https://example.com/1001", retrievedAt: new Date().toISOString(), publishedAt: null, updatedAt: null, eventAt: null, contentType: "application/json", body: new TextEncoder().encode(JSON.stringify(data)), metadata: { provider } });
  query(`delete from research_passages where version_id='${record.versionId}'`);
  for (const passage of extracted.passages) query(`insert into research_passages(version_id,locator,text,hash) values('${record.versionId}',${json(passage.locator)},${json(passage.text)}#>>'{}','${randomUUID()}')`);
  return { ...record, extracted };
}
function fixture() {
  auth.actor = "director";
  query("truncate research_rights,research_runs,research_entities,research_investigations,research_reviews,research_suppressions cascade");
  query(`insert into research_rights(id,holder,material,purpose,agreement_ref,agreement_hash,effective_at,transfer_conditions,retention_instructions,withdrawal_instructions,use_assessment)
    values('${ids.rights}','QCS','synthetic','test','test','test',now()-interval '1 day','{}','{}','{}','test');
    insert into research_sources(id,label,provider,hosts,access_method,terms_url,terms_version,terms_reviewed_at,attribution,operator,purpose,rights_id,status,selection,backfill_start,cadence_seconds,freshness_seconds,request_limit,window_seconds,daily_requests,daily_tokens,daily_pence,last_success_at)
    values('${ids.source}','Synthetic source','find-a-tender','["example.com"]','public','https://example.com','1',now(),'Synthetic attribution','QCS','test','${ids.rights}','ready','{}','2026-01-01',86400,172800,10,60,100,100000,1000,now());`);
}
async function question(monitoring = false) {
  const queued = await enqueueQuickQuestion("director", { requestId: randomUUID(), question: "Which construction payment records are available?", monitoring });
  const job = await leaseQuickQuestion();
  expect(job?.id).toBe(queued.id);
  return job!;
}
async function answer(job: QuickJob, evidence: EvidencePassage[], hash = "hash") {
  await attachQuickEvidence(job, evidence);
  return finishQuickQuestion(job, { answer: { findings: evidence.length ? [{ text: evidence[0].text, kind: "observation", evidence: [evidence[0]].map(({ documentId, versionId, passageId }) => ({ documentId, versionId, passageId })) }] : [], limitations: [] }, evidence, evidenceHash: hash, modelId: "synthetic-test", promptVersion: "test-v1" });
}
function makeDue(id: string) { query(`update research_quick_questions set next_check_at=now()-interval '1 second' where id='${id}'`); }
function expireLease(id: string) { query(`update research_quick_questions set lease_expires_at=now()-interval '1 second' where id='${id}'`); }

describe.skipIf(!container)("isolated automatic research repository", () => {
  beforeEach(fixture);
  it("creates an idempotent owner-specific queue item without starting source fetches", async () => {
    const request = { requestId: randomUUID(), question: "Look for construction payment disputes", monitoring: false };
    const first = await enqueueQuickQuestion("director", request);
    expect(await enqueueQuickQuestion("director", request)).toEqual(first);
    await expect(enqueueQuickQuestion("director", { ...request, monitoring: true })).rejects.toThrow("idempotency_conflict");
    expect(query("select count(*)::int as count from research_jobs")[0].count).toBe(0);
    expect(query("select budget from research_investigations")[0].budget).toEqual({ maxRequests: 0, maxTokens: 30000, maxCostPence: 200 });
    auth.actor = "another-director";
    expect((await enqueueQuickQuestion(auth.actor, request)).id).not.toBe(first.id);
    expect((await listResearchDesk(auth.actor)).questions).toHaveLength(1);
    await expect(setQuickMonitoring(auth.actor, first.id, true)).rejects.toThrow("question_not_found");
    await expect(listResearchDesk("director")).rejects.toThrow("forbidden");
  });
  it("bounds monitor count and serialises pending quota checks under concurrent creation", async () => {
    query("do $$ begin for i in 1..20 loop perform research_quick_enqueue('director',gen_random_uuid(),'hash','Construction payment research '||i,true); end loop; end $$");
    await expect(enqueueQuickQuestion("director", { requestId: randomUUID(), question: "Another daily construction question", monitoring: true })).rejects.toThrow("research_monitor_limit");
    query("do $$ begin for i in 1..29 loop perform research_quick_enqueue('director',gen_random_uuid(),'hash','Construction payment research '||i,false); end loop; end $$");
    const enqueueSql = "select research_quick_enqueue('director',gen_random_uuid(),'hash','A final construction payment question',false)";
    const results = await Promise.allSettled([concurrent(enqueueSql), concurrent(enqueueSql)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(query("select count(*)::int as count from research_quick_questions")[0].count).toBe(50);
  });
  it("leases exclusively, preserves the run and reserved cost after a crash, and fences stale completion", async () => {
    const job = await question();
    expect(await leaseQuickQuestion()).toBeNull();
    const reservation = query(`select research_reserve_model('${ids.source}','${job.runId}',30000,200) as id`)[0].id;
    query(`select research_settle_model('${reservation}',null,null)`);
    expireLease(job.id);
    const leased = await Promise.all([concurrent("select research_quick_lease()"), concurrent("select research_quick_lease()")]);
    const next = JSON.parse(leased.find(value => value !== "")!) as QuickJob;
    expect(next.runId).toBe(job.runId); expect(next.leaseToken).toBe(job.leaseToken + 1);
    expect(leased.filter(value => value !== "")).toHaveLength(1);
    expect(() => query(`select research_reserve_model('${ids.source}','${next.runId}',30000,200)`)).toThrow();
    expect(await answer(job, [])).toBe(false);
    expect(await answer(next, [])).toBe(true);
    expect(await answer(next, [])).toBe(false);
    expect(query("select count(*)::int as count from research_conversations")[0].count).toBe(1);
  });
  it("stops crash recovery after three attempts without generating fresh uncapped runs", async () => {
    let job = await question(true);
    for (let i = 0; i < 2; i++) { expireLease(job.id); job = (await leaseQuickQuestion())!; }
    expireLease(job.id);
    expect(await leaseQuickQuestion()).toBeNull();
    const desk = await listResearchDesk("director");
    expect(desk.questions[0].status).toBe("failed");
    expect(new Date(desk.questions[0].nextCheckAt!).getTime() - Date.now()).toBeGreaterThan(23 * 3600000);
    expect(query("select count(*)::int as count from research_runs")[0].count).toBe(1);
  });
  it("OR-searches useful terms, diversifies documents and never substitutes unrelated records", async () => {
    addDocument("The contractor has delayed payment.", { passages: ["Construction payment record two", "Construction payment record three"] });
    addDocument("The contractor entered adjudication.");
    addDocument("Banana farmers harvested apples.", { title: "Agriculture" });
    expect(await findQuickEvidence("Tell us about zebras")).toEqual([]);
    expect(await findQuickEvidence("What can you tell me?")).toEqual([]);
    const evidence = await findQuickEvidence("payment or adjudication");
    expect(evidence).toHaveLength(4); expect(new Set(evidence.map(p => p.documentId)).size).toBe(2);
    query(`update research_sources set status='paused' where id='${ids.source}'`);
    expect(await findQuickEvidence("payment or adjudication")).toEqual([]);
  });
  it("rechecks reference tuples, attachment, current versions, rights and withdrawal at completion and read", async () => {
    const record = addDocument("Construction payment was late.");
    const job = await question(), evidence = await findQuickEvidence("payment");
    await expect(attachQuickEvidence(job, [{ ...evidence[0], documentId: ids.source }])).rejects.toThrow("evidence_unavailable");
    expect(await answer(job, evidence)).toBe(true);
    expect((await listResearchDesk("director")).questions[0].answer?.findings).toHaveLength(1);
    query(`update research_rights set expires_at=now() where id='${ids.rights}'`);
    expect((await listResearchDesk("director")).questions[0].answer).toBeNull();
    expect((await listResearchDesk("director")).questions[0].evidence).toEqual([]);
    query(`update research_rights set expires_at=null where id='${ids.rights}'`);
    query(`update research_versions set availability='withdrawn' where id='${record.versionId}'; select research_invalidate_workflow('${record.versionId}')`);
    expect((await listResearchDesk("director")).questions[0].answer).toBeNull();
    const stored = query("select answer,status from research_conversations")[0];
    expect(stored.status).toBe("stale"); expect(JSON.stringify(stored.answer)).not.toContain("payment was late");
    const nextJob = await question();
    await expect(answer(nextJob, evidence)).rejects.toThrow("evidence_unavailable");
  });
  it("creates one run per daily cycle, avoids unchanged answers and fences a stopped daily update", async () => {
    addDocument("Construction payment was late.");
    const job = await question(true), evidence = await findQuickEvidence("payment");
    await answer(job, evidence);
    expect(await leaseQuickQuestion()).toBeNull();
    makeDue(job.id);
    const daily = (await leaseQuickQuestion())!;
    expect(daily.runId).not.toBe(job.runId); expect(daily.hasCurrentAnswer).toBe(true);
    expect(await finishQuickUnchanged(daily, "hash")).toBe(true);
    expect(query("select count(*)::int as count from research_conversations")[0].count).toBe(1);
    makeDue(job.id);
    const stopped = (await leaseQuickQuestion())!;
    await setQuickMonitoring("director", job.id, false);
    expect(await finishQuickUnchanged(stopped, "hash")).toBe(false);
    expect(await answer(stopped, evidence)).toBe(false);
    const retained = (await listResearchDesk("director")).questions[0];
    expect(retained.monitoring).toBe(false); expect(retained.nextCheckAt).toBeNull(); expect(retained.answer?.findings).toHaveLength(1);
    expect(query(`select status from research_runs where id='${stopped.runId}'`)[0].status).toBe("cancelled");
  });
  it("does not reuse an unchanged hash when permissions or the current version changed", async () => {
    const record = addDocument("Construction payment was late.");
    const job = await question(true), evidence = await findQuickEvidence("payment"); await answer(job, evidence);
    makeDue(job.id); const daily = (await leaseQuickQuestion())!;
    const newVersion = randomUUID();
    query(`insert into research_versions(id,document_id,hash,retrieved_at,content_type,parser_version,metadata) values('${newVersion}','${record.documentId}','changed',now(),'text/plain','1','{}'); update research_documents set current_version_id='${newVersion}' where id='${record.documentId}'`);
    expect(await finishQuickUnchanged(daily, "hash")).toBe(false);
    expect((await listResearchDesk("director")).questions[0].answer).toBeNull();
  });
  it("surfaces current recent construction trigger records and keeps save/dismiss choices actor-specific", async () => {
    const eligible = addDocument("The construction contractor reported delayed payment.", { passages: ["Construction payment was discussed again."] });
    addDocument("The payment was late.", { title: "Retail record" });
    addDocument("Construction progress continued.");
    addDocument("The construction contractor reported delayed payment.", { age: 100 });
    addDocument("The construction contractor reported delayed payment.", { future: true });
    let desk = await listResearchDesk("director");
    expect(desk.opportunities).toHaveLength(1);
    expect(desk.opportunities[0].reason).toBe("Published record matching construction context and payment wording. Review the original record.");
    expect(desk.collection).toMatchObject({ enabledSources: 1, needsAttention: 0 });
    await reviewOpportunity("director", eligible.documentId, "save");
    await reviewOpportunity("director", eligible.documentId, "save");
    expect(query("select count(*)::int as count from research_reviews where action='desk_save'")[0].count).toBe(1);
    expect((await listResearchDesk("director")).opportunities).toHaveLength(0);
    expect((await listResearchDesk("director", "saved")).opportunities[0].saved).toBe(true);
    auth.actor = "another-director";
    expect((await listResearchDesk(auth.actor)).opportunities).toHaveLength(1);
    auth.actor = "director";
    await reviewOpportunity("director", eligible.documentId, "dismiss");
    expect((await listResearchDesk("director", "saved")).opportunities).toHaveLength(0);
    await reviewOpportunity("director", eligible.documentId, "reopen");
    desk = await listResearchDesk("director"); expect(desk.opportunities).toHaveLength(1);
    query(`insert into research_suppressions(target,scope,reason,actor) values('${eligible.documentId}','all','Test suppression','director')`);
    expect((await listResearchDesk("director")).opportunities).toHaveLength(0);
    expect(await findQuickEvidence("delayed payment")).not.toContainEqual(expect.objectContaining({ documentId: eligible.documentId }));
  });
  it("does not let a stale failure overwrite a successful answer", async () => {
    const job = await question(); expireLease(job.id); const newer = (await leaseQuickQuestion())!;
    await answer(newer, []); await failQuickQuestion(job, "Old error");
    expect((await listResearchDesk("director")).questions[0].status).toBe("complete");
  });
  it("finds extracted payment fields across siblings and retains company, measures and reporting periods", async () => {
    const data = { "Report Id": "1001", Company: "Acme Construction Ltd", "Average time to pay": "45", "Percentage of invoices not paid within agreed terms": "70", "Start date": "01/01/2026", "End date": "30/06/2026" };
    const record = await addExtractedRecord(data, "payment-practices");
    expect(record.extracted).toEqual(paymentEvidence(data));
    const evidence = await findQuickEvidence("What do Acme payment practices show?");
    const fields = Object.fromEntries(evidence.map(p => [(p.locator as { value: string }).value, p.text]));
    expect(fields).toMatchObject({ Company: "Acme Construction Ltd", "Average time to pay": "45", "Percentage of invoices not paid within agreed terms": "70", "Start date": "01/01/2026", "End date": "30/06/2026" });
    const desk = await listResearchDesk("director");
    expect(desk.opportunities).toHaveLength(1);
    expect(desk.opportunities[0].title).toBe("Acme Construction Ltd");
    expect(desk.opportunities[0].excerpt).toContain("Average time to pay: 45");
    expect(desk.opportunities[0]).toMatchObject({ evidence: expect.arrayContaining([expect.objectContaining({ passageId: evidence.find(p => (p.locator as { value: string }).value === "Average time to pay")!.passageId, label: "Average time to pay" })]) });
    expect(desk.opportunities[0].excerpt).toContain("Start date: 01/01/2026");
    expect(desk.opportunities[0].reason).toContain("payment wording");
    const tender = await addExtractedRecord({ tender: { title: "Construction project", procurementMethod: "open", description: "Bridge works" } }, "find-a-tender");
    expect((await listResearchDesk("director")).opportunities).toContainEqual(expect.objectContaining({ documentId: tender.documentId, title: "Construction project" }));
    expect((await findQuickEvidence("Bridge works"))).toContainEqual(expect.objectContaining({ documentId: tender.documentId, locator: { kind: "field", value: "/tender/description" }, text: "Bridge works" }));
  });
  it("shares twelve passages fairly between three documents and keeps membership stable when budgets change", async () => {
    const otherSource = randomUUID();
    query(`insert into research_sources select (jsonb_populate_record(null::research_sources,to_jsonb(s)||${json({ id: otherSource, label: "Second source" })})).* from research_sources s where s.id='${ids.source}'`);
    for (let index = 0; index < 4; index++) await addExtractedRecord({ Company: `Construction Example ${index}`, "Average time to pay": "45", "Percentage of invoices not paid within agreed terms": "70", "Start date": "01/01/2026", "End date": "30/06/2026", "Policy Regime": "A", "Report Id": String(index) }, "payment-practices", index % 2 ? otherSource : ids.source);
    const before = await findQuickEvidence("construction payment practices");
    expect(before).toHaveLength(12); expect(new Set(before.map(p => p.documentId)).size).toBe(3);
    for (const documentId of new Set(before.map(p => p.documentId))) {
      const fields = before.filter(p => p.documentId === documentId).map(p => (p.locator as { value: string }).value);
      expect(fields).toContain("Company"); expect(fields).toContain("Start date"); expect(fields).toContain("End date");
    }
    query(`insert into research_budget_days(source_id,day,tokens,pence) values('${before[0].sourceId}',(now() at time zone 'UTC')::date,100000,1000)`);
    const after = await findQuickEvidence("construction payment practices");
    expect(after.map(p => p.passageId).sort()).toEqual(before.map(p => p.passageId).sort());
    expect(after[0].sourceId).not.toBe(before[0].sourceId);
  });
  it("honours existing cancellation for queued and leased runs immediately and permits an explicit later restart", async () => {
    const pending = await enqueueQuickQuestion("director", { requestId: randomUUID(), question: "Construction payment question", monitoring: true });
    const queuedRun = query(`select run_id from research_quick_questions where id='${pending.id}'`)[0].run_id;
    query(`select research_cancel_run('${queuedRun}')`);
    expect(await leaseQuickQuestion()).toBeNull();
    expect((await listResearchDesk("director")).questions[0]).toMatchObject({ monitoring: false, status: "failed", nextCheckAt: null });
    const running = await question(true);
    query(`select research_cancel_run('${running.runId}')`);
    expect(await attachQuickEvidence(running, [])).toBe(false);
    expect(await answer(running, [])).toBe(false);
    expect(await finishQuickUnchanged(running, "hash")).toBe(false);
    await failQuickQuestion(running, "stale error");
    expect(query(`select status from research_runs where id='${running.runId}'`)[0].status).toBe("cancelled");
    await setQuickMonitoring("director", running.id, true); makeDue(running.id);
    const restarted = (await leaseQuickQuestion())!;
    expect(restarted.id).toBe(running.id); expect(restarted.runId).not.toBe(running.runId);
  });
  it("releases a revoked owner's monitor slot without disabling daily retries for transient failures", async () => {
    const revoked = await question(true);
    await failQuickQuestion(revoked, "Research access is no longer available for this question.", true);
    expect((await listResearchDesk("director")).questions[0]).toMatchObject({ monitoring: false, nextCheckAt: null });
    const transient = await question(true); await failQuickQuestion(transient, "Temporary access check problem");
    expect((await listResearchDesk("director")).questions.find(q => q.id === transient.id)).toMatchObject({ monitoring: true, status: "failed" });
    expect(query("select count(*)::int as count from research_quick_questions where monitoring")[0].count).toBe(1);
  });

  it("never matches a document through a suppressed passage while returning unrelated siblings", async () => {
    const record = addDocument("Unique payment construction record", { title: "Record", passages: ["Remaining unrelated material"] });
    query(`insert into research_suppressions(target,scope,reason,actor) values('${record.passageId}','all','Suppressed passage','director')`);
    expect(await findQuickEvidence("Unique")).toEqual([]);
    expect((await listResearchDesk("director")).opportunities).toEqual([]);
  });

  it("keeps a named company ahead of unrelated records with many repeated payment labels", async () => {
    const named = await addExtractedRecord({ Company: "NamedAcme Construction Ltd", "Average time to pay": "45", "Percentage of invoices not paid within agreed terms": "70" }, "payment-practices");
    for (let index = 0; index < 3; index++) {
      await addExtractedRecord({ Company: `Other Construction ${index}`, "Payment measure one": "1", "Payment measure two": "2", "Payment measure three": "3", "Payment measure four": "4", "Payment measure five": "5", "Payment measure six": "6", "Payment measure seven": "7", "Payment measure eight": "8" }, "payment-practices");
    }
    const evidence = await findQuickEvidence("NamedAcme payment practices");
    expect(evidence[0].documentId).toBe(named.documentId);
    expect(evidence).toContainEqual(expect.objectContaining({ documentId: named.documentId, text: "NamedAcme Construction Ltd", locator: { kind: "field", value: "Company" } }));
    expect(new Set(evidence.map(p => p.documentId)).size).toBe(3);
  });

});
