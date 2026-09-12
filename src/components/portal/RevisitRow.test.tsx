import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { pursuitFixture } from "@/lib/portal/live-lead-fixtures.test-support";
import { viewFixture } from "@/lib/actions/view-fixture.test-support";
import { RevisitRow } from "./RevisitRow";
it("labels the dormant review date separately from the action date and assignee", () => {
 const pursuit = pursuitFixture({ stage: "dormant", ownerId: "lead-owner", reviewDue: "2026-09-20" });
 render(<RevisitRow lead={{ pursuit, reviewDue: pursuit.reviewDue, nextAction: viewFixture({ dueDate: "2026-09-14", ownerId: "action-owner", state: "waiting", stateReason: "Client records" }) }} reopenStage="proposal" directors={[]} onReopen={vi.fn()} />);
 expect(screen.getByText("Review due Sun 20 Sep")).toBeInTheDocument();
 expect(screen.getByText(/Action due Mon 14 Sep. Action assignee: Mateo Diaz/)).toBeInTheDocument();
 expect(screen.getByText(/Waiting · Action due/)).toBeInTheDocument();
});
