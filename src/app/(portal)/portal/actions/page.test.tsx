import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ActionsPage from "./page";
import { directoryFixture, viewFixture } from "@/lib/actions/view-fixture.test-support";
import type { ActionView } from "@/lib/actions/types";
const mocks = vi.hoisted(() => ({ authorise: vi.fn(), list: vi.fn(), direct: vi.fn(), directory: vi.fn() }));
vi.mock("@/lib/portal/auth", () => ({ requireWorkspacePage: mocks.authorise }));
vi.mock("@/lib/db/desk-actions", () => ({ readActionViews: mocks.list, readActionView: mocks.direct }));
vi.mock("@/lib/portal/directors", () => ({ readDirectorDirectory: mocks.directory }));
vi.mock("@/components/portal/actions/ActionRegister", () => ({ ActionRegister: ({ initialAction, initialActionError }: { initialAction: ActionView | null; initialActionError: string | null }) => <div>{initialAction?.title}{initialActionError && <p role="alert">{initialActionError}</p>}</div> }));
beforeEach(() => { vi.resetAllMocks(); mocks.authorise.mockResolvedValue("director-1"); mocks.list.mockResolvedValue({ rows: [], total: 0 }); mocks.directory.mockResolvedValue(directoryFixture); mocks.direct.mockResolvedValue(null); });
afterEach(cleanup);
it("loads a closed action independently of the default page query", async () => {
  const action = viewFixture({ state: "completed", title: "Previously completed action" });
  mocks.direct.mockResolvedValue(action);
  render(await ActionsPage({ searchParams: Promise.resolve({ edit: action.id }) }));
  expect(mocks.direct).toHaveBeenCalledWith(action.id);
  expect(mocks.list.mock.calls[0][0]).toMatchObject({ filter: "open", page: 1 });
  expect(screen.getByText(action.title)).toBeVisible();
});
it("authorises before any direct action or register lookup", async () => {
  mocks.authorise.mockRejectedValue(new Error("forbidden"));
  await expect(ActionsPage({ searchParams: Promise.resolve({ edit: viewFixture().id }) })).rejects.toThrow("forbidden");
  expect(mocks.direct).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled();
});
it.each(["not-a-uuid", viewFixture().id])("shows the same unavailable message for invalid or inaccessible action %s", async edit => {
  render(await ActionsPage({ searchParams: Promise.resolve({ edit }) }));
  expect(screen.getByRole("alert")).toHaveTextContent("Could not open this action. It may be unavailable or you may not have access.");
  if (edit === "not-a-uuid") expect(mocks.direct).not.toHaveBeenCalled();
});

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-meritus-page-path": "/portal/actions?scope=mine&edit=selected" }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
import { ResearchAccessError } from "@/lib/research/roles";

it.each([
  ["list", 503], ["list", 401], ["list", 403],
  ["direct", 503], ["direct", 401], ["direct", 403],
] as const)("does not swallow the %s reader's typed %s access error after entry", async (reader, status) => {
  mocks[reader].mockRejectedValueOnce(new ResearchAccessError(status === 503 ? "actor_unavailable" : status === 401 ? "unauthenticated" : "forbidden", status));
  const destination = status === 503 ? "/access/unavailable?returnTo=%2Fportal%2Factions%3Fscope%3Dmine%26edit%3Dselected" : status === 401 ? "/sign-in?returnTo=%2Fportal%2Factions%3Fscope%3Dmine%26edit%3Dselected" : "/access/denied";
  await expect(ActionsPage({ searchParams: Promise.resolve({ edit: viewFixture().id }) })).rejects.toThrow(`redirect:${destination}`);
  expect(mocks.authorise).toHaveBeenCalledTimes(1);
});
