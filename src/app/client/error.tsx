"use client";
export default function ClientError({ reset }: { reset: () => void }) {
  return <section className="client-section"><h1>We could not load your documents</h1><p className="app-status" role="alert">Please try again. Your received documents remain available when the connection is restored.</p><button type="button" className="app-button" onClick={reset}>Retry</button></section>;
}
