export type ActionState = "todo" | "in_progress" | "waiting" | "completed" | "cancelled";

export type LinkKind =
  | "general"
  | "pursuit"
  | "prospect"
  | "programme"
  | "investigation"
  | "calendar";

export type WorkLink =
  | { kind: "general" }
  | { kind: Exclude<LinkKind, "general">; id: string };

export type DeskAction = {
  id: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  suggestedOwnerId: string | null;
  dueDate: string | null;
  originalDueDate: string | null;
  state: ActionState;
  stateReason: string | null;
  completedAt: string | null;
  completedBy: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  legacyKey: string | null;
  link: WorkLink;
  retainedContext: string | null;
};

export type ActionView = DeskAction & {
  relatedLabel: string;
  relatedHref: string | null;
  ownerName: string;
  isPrimary: boolean;
  linkAvailable: boolean;
};

export type ActionDraft = {
  title: string;
  description: string;
  ownerId: string | null;
  dueDate: string | null;
  state: ActionState;
  stateReason: string;
  changeReason: string;
  saveUnassigned: boolean;
};

export type SaveActionInput = {
  id: string;
  requestId: string;
  expectedVersion: number;
  link: WorkLink;
  draft: ActionDraft;
};

export type ActionEvent = {
  id: string;
  actionId: string;
  actorId: string;
  actorName: string;
  kind:
    | "imported"
    | "created"
    | "updated"
    | "completed"
    | "reopened"
    | "cancelled"
    | "detached"
    | "primary_selected";
  before: DeskAction | null;
  after: DeskAction;
  reason: string | null;
  createdAt: string;
};

export type ActionSaveResult =
  | { ok: true; action: ActionView }
  | { ok: false; code: "conflict"; error: string; current: ActionView }
  | {
      ok: false;
      code: "validation" | "unavailable" | "forbidden" | "not_found";
      error: string;
    };

export type ActionFilter =
  | "open"
  | "overdue"
  | "today"
  | "upcoming"
  | "unassigned"
  | "undated"
  | "completed_recent"
  | "all";

export type ActionQuery = {
  scope: "team" | "mine";
  filter: ActionFilter;
  ownerId?: string | null;
  link?: WorkLink;
  state?: ActionState;
  page: number;
  pageSize: number;
};

export type DateWindow = {
  today: string;
  upcomingEnd: string;
  agendaEnd: string;
  recentStart: string;
};
