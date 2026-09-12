const scenario = new URL(window.location.href).searchParams.get('scenario') ?? 'busy';
const originalFetch = window.fetch.bind(window);
const now = '2026-09-12T10:00:00.000Z';
const result = data => Promise.resolve(new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } }));
const failed = message => Promise.resolve(new Response(JSON.stringify({ error: message }), { status: 503, headers: { 'content-type': 'application/json' } }));
const questions = scenario === 'empty' ? [] : [{
  id: 'question-example', question: 'What further records would help explain the programme changes?', monitoring: false,
  status: 'complete', createdAt: now, lastCheckedAt: now, nextCheckAt: null, error: null,
  answer: { findings: [], limitations: ['Illustrative fixture. No live research has been performed.'] }, evidence: [],
}];
const opportunities = scenario === 'empty' ? [] : [{
  documentId: 'doc-example', versionId: 'version-example', passageId: 'passage-example', title: 'Example construction award notice',
  source: 'Illustrative source', provider: 'Local fixture', excerpt: 'Example record used to verify the evidence and action layout.',
  url: 'https://example.test/notice', publishedAt: now, retrievedAt: now,
  reason: 'Read the source and assess its relevance before taking action.', saved: false,
}];
window.fetch = (input, options) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url === '/api/access') return scenario === 'error' ? failed('Please try again in a moment.') : result({ ok: true });
  if (url.startsWith('/api/portal/research/quick')) {
    if (scenario === 'loading') return new Promise(() => {});
    if (scenario === 'error') return failed('Research is temporarily unavailable.');
    if (options?.method === 'POST') {
      const data = JSON.parse(options.body);
      questions.unshift({ id: data.requestId, question: data.question, monitoring: data.monitoring, status: 'queued', createdAt: now, lastCheckedAt: null, nextCheckAt: null, error: null, answer: null, evidence: [] });
      return result({ ok: true });
    }
    return result({ questions, opportunities, collection: { enabledSources: 5, lastCollectedAt: now, needsAttention: 0 } });
  }
  if (url.startsWith('/api/')) return failed('This operation is not connected in the local fixture.');
  return originalFetch(input, options);
};
