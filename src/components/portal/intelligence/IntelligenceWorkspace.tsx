"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import styles from "./IntelligenceWorkspace.module.css";

const DESK_PATH = "/api/portal/intelligence/desk/";

export function IntelligenceWorkspace({ configured }: { configured: boolean }) {
  const [revision, setRevision] = useState(0);
  return <section className={styles.workspace} aria-labelledby="intelligence-title">
    <PageHeader title="Intelligence" id="intelligence-title" description="Review construction signals, trace the evidence and develop opportunities." />
    {configured ? <>
      <div className={styles.toolbar}>
        <p id="intelligence-coverage">Collection is partial. Check source coverage and supporting evidence before acting on a signal.</p>
        <div className={styles.actions}>
          <button type="button" className="app-button app-button--secondary" onClick={() => setRevision(value => value + 1)}>Refresh desk</button>
          <a className="app-button app-button--ghost" href={DESK_PATH} target="_blank" rel="noopener noreferrer" aria-label="Open full screen in a new tab">Open full screen</a>
        </div>
      </div>
      <iframe key={revision} className={styles.desk} title="Meritus Intelligence analyst desk" src={DESK_PATH} aria-describedby="intelligence-coverage" referrerPolicy="no-referrer" />
    </> : <div className={styles.unavailable} role="status">
      <h2>The analyst desk is not connected yet</h2>
      <p>The service connection must be configured before Intelligence can load its watchlist, evidence and source controls here.</p>
    </div>}
  </section>;
}
