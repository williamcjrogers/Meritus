import type { ReactNode } from "react";
import { ClientUploadDesk } from "./ClientUploadDesk";
import { formatBytes } from "@/lib/portal/files";

export type ClientReceipt = { id: string; title: string; size: number; createdAt: string | Date; uploaderEmail: string | null };
export function ClientDocumentsView({ organisation, email, receipts, accountControl }: { organisation: string; email: string | null; receipts: ClientReceipt[]; accountControl?: ReactNode }) {
  return <>
    <div className="client-page-header">
      <div><h1>Client documents</h1><h2>{organisation}</h2><p>{email ? <>Signed in as <strong>{email}</strong></> : "Your organisation’s document area"}</p></div>
      {accountControl}
    </div>
    <p className="app-status">Meritus and colleagues with access for your organisation can see the submission details below. Documents are sent to Meritus.</p>
    <section className="client-section" aria-labelledby="send-documents"><h2 id="send-documents">Send documents</h2><ClientUploadDesk /></section>
    <section className="client-section" aria-labelledby="recent-submissions"><h2 id="recent-submissions">Recent submissions</h2>
      {receipts.length === 0 ? <p className="app-status">Your organisation has not sent any documents yet. Choose files above to begin.</p> : <ul className="client-file-list">{receipts.map(file => <li className="client-file" key={file.id}>
        <div><strong className="client-file-name">{file.title}</strong><p className="client-file-meta">{formatBytes(file.size)}. {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/London" }).format(new Date(file.createdAt))}{file.uploaderEmail ? `, sent by ${file.uploaderEmail}` : ""}.</p></div>
        <span className="app-status app-status--success">Received</span>
      </li>)}</ul>}
    </section>
  </>;
}
