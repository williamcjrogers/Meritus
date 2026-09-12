import type { Activity, EnquirySubmission } from "@/lib/db/schema";
import { dateTime } from "@/lib/portal/dates";
import { directorInitials, directorName, type Director } from "@/lib/portal/director-helpers";
import { OwnerAvatar } from "./OwnerAvatar";

function actorLabel(directors: Director[], actorId: string): { initials: string; name: string } {
  if (actorId === "site") return { initials: "Site", name: "Site form" };
  if (actorId === "system") return { initials: "Sys", name: "System" };
  return { initials: directorInitials(directors, actorId), name: directorName(directors, actorId) };
}

function Submission({ submission }: { submission: EnquirySubmission }) {
  const rows: Array<[string, string | null | undefined]> = [
    ["Name", submission.name],
    ["Firm", submission.firm],
    ["Email", submission.email],
    ["Nature", submission.disputeNature],
    ["Value", submission.approximateValue],
    ["Forum", submission.forum],
  ];
  return (
    <div className="mt-3 space-y-2 border-l border-primary/30 pl-4 text-[13px]">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows
          .filter((row): row is [string, string] => Boolean(row[1]))
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-sans text-[13px]   text-muted pt-[2px]">{label}</dt>
              <dd className="text-text">{value}</dd>
            </div>
          ))}
      </dl>
      {submission.description && <p className="whitespace-pre-wrap leading-relaxed text-muted">{submission.description}</p>}
    </div>
  );
}

function Body({ entry }: { entry: Activity }) {
  const meta = entry.meta ?? {};
  switch (entry.kind) {
    case "enquiry_received":
      return (
        <details className="group">
          <summary className="cursor-pointer list-none text-[15px] text-primary">
            Enquiry received
            <span className="ml-2 font-sans text-[13px]   text-muted group-open:hidden">show</span>
            <span className="ml-2 hidden font-sans text-[13px]   text-muted group-open:inline">hide</span>
          </summary>
          {meta.submission && <Submission submission={meta.submission} />}
          {meta.alert && "error" in meta.alert && (
            <p className="mt-2 font-sans text-[13px]   text-muted">Alert not sent</p>
          )}
        </details>
      );
    case "note":
      return <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-text">{entry.body}</p>;
    case "stage_changed":
      return (
        <div>
          <p className="text-[15px] text-primary">{entry.body ?? "Stage changed"}</p>
          {meta.reason && <p className="mt-1 text-[13px] text-muted">{meta.reason}</p>}
        </div>
      );
    case "file_added":
      return (
        <p className="text-[15px] text-primary">
          Added{" "}
          {meta.documentId ? (
            <a href={`/api/portal/documents/${meta.documentId}`} className="underline decoration-primary/40 underline-offset-2 hover:decoration-primary">
              {meta.title ?? "a file"}
            </a>
          ) : (
            meta.title ?? "a file"
          )}
        </p>
      );
    case "file_removed":
      return <p className="text-[15px] text-muted">Removed {meta.title ?? "a file"}</p>;
    case "brief_generated":
      return <p className="text-[15px] text-primary">Brief generated</p>;
    default:
      return <p className="text-[15px] text-muted">{entry.body ?? entry.kind.replace(/_/g, " ")}</p>;
  }
}

/** Reverse-chronological log of everything that happened to a pursuit. Server-safe. */
export function ActivityTimeline({ entries, directors }: { entries: Activity[]; directors: Director[] }) {
  if (entries.length === 0) {
    return <p className="text-[13px] text-muted">Nothing yet. The enquiry will appear here.</p>;
  }
  return (
    <ol className="divide-y divide-line">
      {entries.map((entry) => {
        const actor = actorLabel(directors, entry.actorId);
        return (
          <li key={entry.id} className="flex gap-4 py-3">
            <div className="w-24 shrink-0 pt-[3px] font-sans text-[13px]  text-muted">{dateTime(entry.createdAt)}</div>
            <div className="shrink-0 pt-[1px]">
              {entry.actorId === "site" || entry.actorId === "system" ? (
                <span className="inline-flex h-6 items-center rounded-full border border-line px-2 font-sans text-[13px]   text-muted">
                  {actor.initials}
                </span>
              ) : (
                <OwnerAvatar initials={actor.initials} name={actor.name} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Body entry={entry} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
