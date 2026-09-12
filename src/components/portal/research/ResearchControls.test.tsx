import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { ActionForm } from "./ResearchControls";
import { SourceHealth } from "./SourceHealth";
import type { SourceSettings } from "@/lib/db/research-workflow";
it("submits visible director choices and exposes server errors without losing the form", async () => {
  const submit = vi
    .fn()
    .mockRejectedValue(new Error("current review required"));
  render(
    <ActionForm
      title="Review"
      fields={[
        { name: "reason", label: "Reason", required: true },
        {
          name: "evidence",
          label: "Evidence",
          type: "checks",
          options: [
            { value: "first", label: "First record" },
            { value: "second", label: "Second record" },
          ],
        },
      ]}
      submit={submit}
    />,
  );
  fireEvent.change(screen.getByLabelText("Reason"), {
    target: { value: "A reviewed reason" },
  });
  fireEvent.click(screen.getByRole("checkbox", {name:"First record"}));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith({
      reason: "A reviewed reason",
      evidence: ["first"],
    }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "current review required",
  );
  expect(screen.getByLabelText("Reason")).toHaveValue("A reviewed reason");
});
it("shows missing configuration and never claims an untested source succeeded", () => {
  const source = {
    status: "paused",
    configurationError: "API credential is missing",
    lastSuccessAt: null,
  } as SourceSettings;
  render(<SourceHealth source={source} />);
  expect(screen.getByText("Paused")).toBeInTheDocument();
  expect(screen.getByText("API credential is missing")).toBeInTheDocument();
  expect(
    screen.getByText(/Last successful retrieval: Not recorded/),
  ).toBeInTheDocument();
});
