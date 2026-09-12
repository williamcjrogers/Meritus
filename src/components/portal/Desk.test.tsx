import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { pursuitFixture } from "@/lib/portal/live-lead-fixtures.test-support";
import { movePursuit, declinePursuit, reopenPursuit } from "@/lib/portal/actions";
import { Desk } from "./Desk";
vi.mock("@/lib/portal/actions", () => ({ movePursuit:vi.fn(), declinePursuit:vi.fn(), reopenPursuit:vi.fn(), takePursuit:vi.fn() }));
vi.mock("./MineAllToggle", () => ({ MineAllToggle: () => null }));
vi.mock("./Board", () => ({ Board: ({onMove}: {onMove:(id:string,to:string)=>void}) => <button onClick={() => onMove("p1","instructed")}>Move lead</button> }));
vi.mock("./InboxRow", () => ({ InboxRow: ({onDecline}: {onDecline:(id:string,reason:string)=>void}) => <button onClick={() => onDecline("p1","No capacity")}>Decline lead</button> }));
vi.mock("./RevisitRow", () => ({ RevisitRow: ({onReopen}: {onReopen:(id:string)=>void}) => <button onClick={() => onReopen("p1")}>Reopen lead</button> }));
beforeEach(() => { vi.mocked(movePursuit).mockResolvedValue({ok:true,remainingActions:2}); vi.mocked(declinePursuit).mockResolvedValue({ok:true,remainingActions:2}); vi.mocked(reopenPursuit).mockResolvedValue({ok:true,remainingActions:2}); });
it.each(["Move lead", "Decline lead", "Reopen lead"])("shows the shared remaining-action review after %s", async label => {
 const pursuit = pursuitFixture(label === "Reopen lead" ? {stage:"dormant",reviewDue:"2026-09-01"} : {});
 render(<Desk pursuits={[{pursuit,nextAction:null,reviewDue:pursuit.reviewDue}]} extras={{related:{},alerts:{},reopenStages:{}}} directors={[]} userId="director" scope="all" now="2026-09-12T10:00:00Z" />);
 await userEvent.click(screen.getByRole("button",{name:label}));
 expect(await screen.findByRole("status")).toHaveTextContent("Stage updated. Review the 2 open actions linked to this lead.");
 expect(screen.getByRole("link",{name:"Actions"})).toHaveAttribute("href","/portal/pursuits/p1#actions");
});
