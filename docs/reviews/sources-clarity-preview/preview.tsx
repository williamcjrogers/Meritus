/// <reference types="vite/client" />
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ResearchWorkspace } from "../../../src/components/portal/research/ResearchWorkspace";
import { RESEARCH_SOURCE_TEMPLATES } from "../../../src/lib/research/source-catalogue";
import type { SourceSettings } from "../../../src/lib/db/research-workflow";
import type { QuickQuestion, ResearchOpportunity } from "../../../src/lib/research/quick-types";
import "../../../src/styles/globals.css";
const sources: SourceSettings[] = RESEARCH_SOURCE_TEMPLATES.map(source => ({
  id: source.id, label: source.label, provider: source.provider, status: source.status, selection: source.selection,
  configurationError: source.configurationError, attribution: source.attribution, termsUrl: source.termsUrl,
  termsVersion: "Reviewed 12 September 2026", rightsId: source.rightsId, credentialConfigured: Boolean(source.credentialRef),
  dailyRequests: 100, dailyTokens: 100000, dailyPence: 1000, nextDueAt: "2026-09-13T04:00:00Z",
  lastSuccessAt: source.provider === "find-case-law" ? "2026-09-12T04:00:00Z" : null,
}));
const rights = [{ id: "51435300-0000-4000-8000-000000000101", holder: "QCS example permission", material: "Sample record for this preview", purpose: "Demonstrate the interface with sample data.", agreement_ref: "Preview only", effective_at: "2026-09-12T00:00:00Z", expires_at: null }];
sources.push({ ...sources[0], id: "sample-import", label: "Example licensed dataset", provider: "research-import", selection: {}, lastSuccessAt: null, attribution: "Sample dataset for preview only" });
const questions: QuickQuestion[] = [];
const opportunities: ResearchOpportunity[] = [{
  documentId: "00000000-0000-4000-8000-000000000001", versionId: "v1", passageId: "p1", title: "Sample: construction payment dispute", source: "Example published judgment", provider: "find-case-law", excerpt: "The parties disputed the final payment due under a construction contract. The judgment considers the payment notices and the sums claimed.", url: "https://example.com", publishedAt: "2026-09-11T00:00:00Z", retrievedAt: "2026-09-12T00:00:00Z", reason: "Construction and dispute context in the published record.", saved: false,
}, {
  documentId: "00000000-0000-4000-8000-000000000002", versionId: "v2", passageId: "p2", title: "Sample: regional infrastructure contract award", source: "Example procurement notice", provider: "find-tender", excerpt: "A contract has been awarded for road improvements and associated civil engineering works, with delivery expected over the next two years.", url: "https://example.com", publishedAt: "2026-09-10T00:00:00Z", retrievedAt: "2026-09-12T00:00:00Z", reason: "Construction and contract award context in the published record.", saved: false,
}];
opportunities.push({
  documentId: "00000000-0000-4000-8000-000000000003", versionId: "v3", passageId: "p3", title: "Sample: supplier payment report", source: "Example payment register", provider: "payment-practices", excerpt: "Company: Example Construction Ltd\nAverage time to pay: 45 days\nInvoices paid late: 70%\nReporting period: 01 January to 30 June 2026", url: "https://example.com", publishedAt: "2026-09-09T00:00:00Z", retrievedAt: "2026-09-12T00:00:00Z", reason: "Construction and reported payment measures. This sample does not describe a real company.", saved: false,
  evidence: [{ passageId: "p3", label: "Company" }, { passageId: "p4", label: "Average time to pay" }, { passageId: "p5", label: "Invoices paid late" }, { passageId: "p6", label: "Reporting period" }],
});
const dismissed = new Set<string>();
window.fetch = async (input, init) => {
  const url = String(input);
  if (!url.startsWith("/api/portal/research/")) throw new Error("This preview only uses local sample data.");
  if (init?.body instanceof FormData) return Response.json({ errors: [], rows: [{ id: "example-1", title: "Example imported record", text: "Sample research text" }] });
  if (init?.body) {
    const body = JSON.parse(String(init.body));
    if (url.endsWith("/quick")) {
      const id = crypto.randomUUID();
      const item: QuickQuestion = { id, question: body.question, monitoring: body.monitoring, status: "queued", createdAt: new Date().toISOString(), lastCheckedAt: null, nextCheckAt: body.monitoring ? "2026-09-13T04:00:00Z" : null, error: null, answer: null, evidence: [] };
      questions.unshift(item);
      setTimeout(() => {
        item.status = "complete"; item.lastCheckedAt = new Date().toISOString();
        item.answer = { findings: [{ text: "This example illustrates a short answer with a direct link to its supporting record.", kind: "observation", quotation: "The parties disputed the final payment due under a construction contract.", evidence: [{ documentId: opportunities[0].documentId, versionId: "v1", passageId: "p1" }] }], limitations: ["This is a sample response for the local preview. No real research or AI request has been made."] };
        item.evidence = [{ documentId: opportunities[0].documentId, versionId: "v1", passageId: "p1", sourceId: "sample", title: opportunities[0].title, text: opportunities[0].excerpt, url: "https://example.com", locator: {}, retrievedAt: "2026-09-12T00:00:00Z", publishedAt: null, eventAt: null, attribution: "Sample preview material" }];
      }, 1800);
      return Response.json({ id, status: "queued" });
    }
    if (url.includes("/quick/")) Object.assign(questions.find(item => url.endsWith(item.id)) ?? {}, { monitoring: body.monitoring });
    else if (url.includes("/opportunities/")) { const item = opportunities.find(item => url.endsWith(item.documentId)); if (item) { item.saved = body.action === "save"; if (body.action === "dismiss") dismissed.add(item.documentId); else dismissed.delete(item.documentId); } }
    else if (url.endsWith("/sources")) sources.push({ ...body, id: crypto.randomUUID(), lastSuccessAt: null, configurationError: null, nextDueAt: "2026-09-13T04:00:00Z", credentialConfigured: false });
    else if (url.includes("/sources/")) Object.assign(sources.find(source => url.endsWith(source.id)) ?? {}, body, { configurationError: null });
    else if (url.endsWith("/rights")) rights.push({ id: crypto.randomUUID(), holder: body.holder, material: body.material, purpose: body.purpose, agreement_ref: body.agreementRef, effective_at: body.effectiveAt, expires_at: body.expiresAt });
    return Response.json({ saved: true });
  }
  if (url.includes("/quick?")) return Response.json({ questions, opportunities: opportunities.filter(item => !dismissed.has(item.documentId) && item.saved === url.endsWith("saved")), collection: { enabledSources: 4, lastCollectedAt: "2026-09-12T04:00:00Z", needsAttention: 1 } });
  return Response.json(url.endsWith("/sources") ? sources : url.endsWith("/rights") ? rights : []);
};
function Preview() {
  const [path, setPath] = useState("/portal/research");
  useEffect(() => { const onNavigate = (event: Event) => { setPath((event as CustomEvent<string>).detail); window.scrollTo(0, 0); }; window.addEventListener("preview-navigate", onNavigate); return () => window.removeEventListener("preview-navigate", onNavigate); }, []);
  return <>
    <div className="border-b border-brass/40 bg-cream px-5 py-2 text-center text-xs font-medium text-green">LOCAL PREVIEW · Sample data · No live changes or AI charges</div>
    <div className="min-h-screen lg:grid lg:grid-cols-[210px_minmax(0,1fr)]">
      <aside className="hidden bg-green px-6 py-9 text-cream lg:block"><div className="font-serif text-2xl tracking-[0.12em]">MERITUS | VIA</div><p className="mt-3 text-xs tracking-widest text-brass">PURSUIT DESK</p><div className="mt-14 space-y-6 text-sm text-cream/75"><p>Home</p><p>Prospects</p><p>Programmes</p><button onClick={() => setPath("/portal/research")} className="font-medium text-white">Research</button><p>Library</p></div></aside>
      <main className="min-w-0 px-5 py-8 md:px-9 lg:py-10"><ResearchWorkspace key={path} mode={path.endsWith("sources") ? "sources" : "investigations"} advanced={path.endsWith("advanced")} /></main>
    </div>
  </>;
}
const previewRoot = import.meta.hot?.data.root ?? createRoot(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.data.root = previewRoot;
previewRoot.render(<React.StrictMode><Preview /></React.StrictMode>);
