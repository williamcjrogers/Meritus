"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useOptimistic, useRef, useState } from "react";
import type { Activity, Pursuit, PursuitStage } from "@/lib/db/schema";
import type { DocumentSummary } from "@/lib/portal/files";
import { fullDate, isOverdue, shortDate } from "@/lib/portal/dates";
import type { Director } from "@/lib/portal/director-helpers";
import {
  addNote,
  clearQuestions,
  deletePursuit,
  movePursuit,
  reopenPursuit,
  saveAnswerAsNote,
  setCompanyNumber,
  setNextAction,
  setOwner,
  updatePursuit,
} from "@/lib/portal/actions";
import { isActiveStage, resolveReopenStage, stageLabel } from "@/lib/portal/stages";
import type { ActionResult, PursuitFormInput } from "@/lib/portal/types";
import { ActivityTimeline } from "./ActivityTimeline";
import { AskDrawer, type AskMessage } from "./AskDrawer";
import { BriefPanel, type BriefState, type BriefSubject } from "./BriefPanel";
import { ConfirmDialog } from "./ConfirmDialog";
import { Eyebrow } from "./Eyebrow";
import { FileList } from "./FileList";
import { MoveToMenu } from "./MoveToMenu";
import { NextActionField } from "./NextActionField";
import { NoteBox } from "./NoteBox";
import { OwnerSelect } from "./OwnerSelect";
import { Panel } from "./Panel";
import { PursuitForm } from "./PursuitForm";
import { SlideOver } from "./SlideOver";
import { StagePill } from "./StagePill";
import { Stepper } from "./Stepper";
import type { RelatedRef } from "./desk-types";

const SOURCE_LABELS: Record<Pursuit["source"], string> = {
  site_form: "site form",
  referral: "referral",
  introduction: "introduction",
  existing_client: "existing client",
  other: "other",
};

function toFormInput(p: Pursuit): Partial<PursuitFormInput> {
  return {
    firm: p.firm,
    contactName: p.contactName ?? undefined,
    contactEmail: p.contactEmail ?? undefined,
    contactPhone: p.contactPhone ?? undefined,
    website: p.website ?? undefined,
    companyNumber: p.companyNumber ?? undefined,
    party: p.party ?? undefined,
    partyCompanyNumber: p.partyCompanyNumber ?? undefined,
    counterparty: p.counterparty ?? undefined,
    disputeNature: p.disputeNature ?? undefined,
    approximateValue: p.approximateValue ?? undefined,
    forum: p.forum ?? undefined,
    source: p.source,
    sourceDetail: p.sourceDetail ?? undefined,
    summary: p.summary ?? undefined,
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * The client half of the pursuit page. Owns the optimistic stage and owner,
 * the edit slide-over, the delete confirm and the questions drawer.
 */
export function PursuitShell({
  pursuit: serverPursuit,
  directors,
  userId,
  related,
  latestChange,
  activity,
  documents,
  briefState,
  questions,
  now,
}: {
  pursuit: Pursuit;
  directors: Director[];
  userId: string;
  related: RelatedRef[];
  latestChange: Activity | null;
  activity: Activity[];
  documents: DocumentSummary[];
  briefState: BriefState;
  questions: AskMessage[];
  now: string;
}) {
  const router = useRouter();
  const nowDate = useMemo(() => new Date(now), [now]);
  const [pursuit, patch] = useOptimistic(serverPursuit, (state: Pursuit, changes: Partial<Pursuit>) => ({ ...state, ...changes }));
  const [askOpen, setAskOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreItemsRef = useRef<Array<HTMLButtonElement | null>>([]);

  function run(changes: Partial<Pursuit>, action: () => Promise<ActionResult>): Promise<ActionResult> {
    return new Promise((resolve) => {
      startTransition(async () => {
        patch(changes);
        try {
          resolve(await action());
        } catch (error) {
          resolve({ ok: false, error: error instanceof Error ? error.message : "Something went wrong" });
        }
      });
    });
  }

  const move = (to: PursuitStage, reason?: string, revisitDue?: string) =>
    run({ stage: to, stageChangedAt: nowDate, ...(revisitDue ? { nextActionDue: revisitDue } : {}) }, () => movePursuit(pursuit.id, to, reason, revisitDue));
  const reopenStage = resolveReopenStage(latestChange ? [latestChange] : []);
  const reopen = async () => {
    setReopening(true);
    setHeaderError(null);
    const result = await run({ stage: reopenStage, stageChangedAt: nowDate }, () => reopenPursuit(pursuit.id));
    setReopening(false);
    if (!result.ok) setHeaderError(result.error);
  };
  const changeOwner = async (ownerId: string | null) => {
    setHeaderError(null);
    const result = await run({ ownerId }, () => setOwner(pursuit.id, ownerId));
    if (!result.ok) setHeaderError(result.error);
  };
  const saveNextAction = (text: string, due: string | null) =>
    run({ nextAction: text || null, nextActionDue: due }, () => setNextAction(pursuit.id, text, due));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditableTarget(event.target)) {
        event.preventDefault();
        setAskOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    moreItemsRef.current[0]?.focus();
    function onClick(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [moreOpen]);

  function closeMore(returnFocus = true) {
    setMoreOpen(false);
    if (returnFocus) moreButtonRef.current?.focus();
  }

  function onMoreKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMore();
      return;
    }
    const items = moreItemsRef.current.filter(Boolean) as HTMLButtonElement[];
    const index = items.findIndex((item) => item === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    }
  }

  async function saveEdit(input: PursuitFormInput) {
    const result = await updatePursuit(pursuit.id, input);
    if (result.ok) setEditOpen(false);
    return result;
  }

  async function confirmDelete() {
    setDeleting(true);
    const result = await deletePursuit(pursuit.id);
    setDeleting(false);
    if (result.ok) {
      setDeleteOpen(false);
      router.push("/portal");
    } else {
      setHeaderError(result.error);
      setDeleteOpen(false);
    }
  }

  const subject: BriefSubject = pursuit.party
    ? { name: pursuit.party, number: pursuit.partyCompanyNumber, target: "party" }
    : { name: pursuit.firm, number: pursuit.companyNumber, target: "firm" };

  const active = isActiveStage(pursuit.stage);
  const meta = [
    pursuit.disputeNature,
    pursuit.approximateValue,
    pursuit.forum,
    `from ${SOURCE_LABELS[pursuit.source]}`,
    fullDate(pursuit.createdAt),
  ].filter(Boolean);
  const partyLine = [pursuit.party ? `for ${pursuit.party}` : null, pursuit.counterparty ? `v ${pursuit.counterparty}` : null].filter(Boolean).join(" ");

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/portal" className="btn-quiet">
          <span aria-hidden="true">←</span> Desk
        </Link>
        <div className="flex items-center gap-2">
          <MoveToMenu current={pursuit.stage} onMove={move} />
          <div
            ref={moreRef}
            className="relative"
            onKeyDown={onMoreKeyDown}
            onBlur={(event) => {
              if (moreOpen && !moreRef.current?.contains(event.relatedTarget as Node | null)) closeMore(false);
            }}
          >
            <button
              ref={moreButtonRef}
              type="button"
              className="btn-quiet"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-label="More actions"
              onClick={() => (moreOpen ? closeMore() : setMoreOpen(true))}
            >
              ···
            </button>
            {moreOpen && (
              <div role="menu" aria-label="More actions" className="absolute right-0 z-30 mt-1 min-w-[180px] border border-green/15 bg-parchment p-1 shadow-[0_8px_24px_rgba(11,59,36,0.16)]">
                <button
                  ref={(el) => {
                    moreItemsRef.current[0] = el;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className="block w-full px-3 py-2 text-left text-[13px] text-green hover:bg-stone/60 focus:bg-stone/60 focus:outline-none"
                  onClick={() => {
                    closeMore(false);
                    setEditKey((key) => key + 1);
                    setEditOpen(true);
                  }}
                >
                  Edit details
                </button>
                <button
                  ref={(el) => {
                    moreItemsRef.current[1] = el;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className="block w-full px-3 py-2 text-left text-[13px] text-oxblood hover:bg-stone/60 focus:bg-stone/60 focus:outline-none"
                  onClick={() => {
                    closeMore(false);
                    setDeleteOpen(true);
                  }}
                >
                  Delete pursuit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Eyebrow rule={false}>Pursuit</Eyebrow>
          <h1 className="mt-1 font-serif text-3xl leading-tight text-green sm:text-4xl">{pursuit.firm}</h1>
          {partyLine && <p className="mt-1 font-serif text-xl italic text-green/80">{partyLine}</p>}
          <p className="mt-2 text-[13px] text-ink/70">{meta.join(" · ")}</p>
          {related.length > 0 && (
            <p className="mt-1 text-[12px] text-ink/70">
              Previously:{" "}
              {related.map((ref, index) => (
                <span key={ref.id}>
                  {index > 0 && ", "}
                  <Link href={`/portal/pursuits/${ref.id}`} className="text-green underline decoration-brass/40 underline-offset-2 hover:decoration-brass">
                    {ref.firm}
                  </Link>
                  {` (${stageLabel(ref.stage).toLowerCase()}, ${ref.date})`}
                </span>
              ))}
            </p>
          )}
          {headerError && <p className="mt-2 text-[12px] text-oxblood">{headerError}</p>}
        </div>
        <div className="shrink-0 lg:w-56">
          <OwnerSelect value={pursuit.ownerId} directors={directors} onChange={(ownerId) => void changeOwner(ownerId)} />
        </div>
      </header>

      <div className="panel-brackets mt-6 border border-green/10 bg-parchment px-5 py-4">
        {active || pursuit.stage === "instructed" ? (
          <Stepper current={pursuit.stage} onMove={(to) => move(to)} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <StagePill stage={pursuit.stage} />
              <span className="text-[13px] text-ink/70">
                since {shortDate(pursuit.stageChangedAt)}
                {latestChange?.meta?.reason ? ` · ${latestChange.meta.reason}` : ""}
              </span>
            </div>
            <button type="button" className="btn-secondary" onClick={() => void reopen()} aria-disabled={reopening || undefined}>
              {reopening ? "Reopening…" : `Reopen at ${stageLabel(reopenStage)}`}
            </button>
          </div>
        )}
        <div className="mt-4 border-t border-green/10 pt-3">
          <NextActionField
            text={pursuit.nextAction}
            due={pursuit.nextActionDue}
            overdue={active && isOverdue(pursuit.nextActionDue, nowDate)}
            onSave={saveNextAction}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="order-1 lg:order-none lg:col-span-8">
          <BriefPanel
            pursuitId={pursuit.id}
            subject={subject}
            initial={briefState}
            directors={directors}
            onAsk={() => setAskOpen(true)}
            onPick={(number) => setCompanyNumber(pursuit.id, number, subject.target)}
            onComplete={() => router.refresh()}
          />
        </div>

        <aside className="order-2 space-y-6 lg:order-none lg:col-span-4 lg:row-span-2">
          <Panel eyebrow="Enquiry" title={pursuit.contactName ?? "No contact name"}>
            <dl className="space-y-2 text-[13px]">
              {pursuit.contactEmail && (
                <div>
                  <dt className="portal-label">Email</dt>
                  <dd>
                    <a href={`mailto:${pursuit.contactEmail}`} className="text-green hover:text-brass">{pursuit.contactEmail}</a>
                  </dd>
                </div>
              )}
              {pursuit.contactPhone && (
                <div>
                  <dt className="portal-label">Phone</dt>
                  <dd>
                    <a href={`tel:${pursuit.contactPhone.replace(/\s+/g, "")}`} className="text-green hover:text-brass">{pursuit.contactPhone}</a>
                  </dd>
                </div>
              )}
              {pursuit.website && (
                <div>
                  <dt className="portal-label">Website</dt>
                  <dd>
                    <a href={pursuit.website} target="_blank" rel="noreferrer" className="text-green hover:text-brass">
                      {pursuit.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  </dd>
                </div>
              )}
              {(pursuit.companyNumber || pursuit.partyCompanyNumber) && (
                <div>
                  <dt className="portal-label">Companies House</dt>
                  <dd className="font-mono text-[12px] text-ink">
                    {[pursuit.companyNumber && `${pursuit.firm} ${pursuit.companyNumber}`, pursuit.partyCompanyNumber && `${pursuit.party} ${pursuit.partyCompanyNumber}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </dd>
                </div>
              )}
              {pursuit.sourceDetail && (
                <div>
                  <dt className="portal-label">Source</dt>
                  <dd className="text-ink">{pursuit.sourceDetail}</dd>
                </div>
              )}
            </dl>
            {pursuit.summary ? (
              <blockquote className="mt-4 border-l border-brass/40 pl-4 text-[14px] italic leading-relaxed text-ink/80">
                <p className="whitespace-pre-wrap">“{pursuit.summary}”</p>
              </blockquote>
            ) : (
              <p className="mt-4 text-[13px] text-ink/60">No summary yet.</p>
            )}
          </Panel>
          <Panel eyebrow="Files" title="Documents">
            <FileList documents={documents} uploadUrl={`/api/portal/pursuits/${pursuit.id}/documents`} />
          </Panel>
        </aside>

        <div className="order-3 lg:order-none lg:col-span-8">
          <Panel eyebrow="Activity" title="Timeline">
            <div className="mb-5">
              <NoteBox onSave={(body) => addNote(pursuit.id, body)} />
            </div>
            <ActivityTimeline entries={activity} directors={directors} />
          </Panel>
        </div>
      </div>

      <AskDrawer
        pursuitId={pursuit.id}
        initialMessages={questions}
        open={askOpen}
        onClose={() => setAskOpen(false)}
        onSaveNote={(text) => saveAnswerAsNote(pursuit.id, text)}
        onClear={() => clearQuestions(pursuit.id)}
      />
      <SlideOver open={editOpen} onClose={() => setEditOpen(false)} eyebrow="Pursuit" title="Edit details">
        <PursuitForm key={editKey} mode="edit" initial={toFormInput(serverPursuit)} onSubmit={saveEdit} onCancel={() => setEditOpen(false)} />
      </SlideOver>
      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${pursuit.firm}?`}
        body="The pursuit, its timeline, its brief, its questions and its files are removed. This cannot be undone."
        confirmLabel="Delete"
        danger
        pending={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
      <span className="sr-only">Signed in as {directors.find((d) => d.id === userId)?.name ?? "a director"}</span>
    </div>
  );
}
