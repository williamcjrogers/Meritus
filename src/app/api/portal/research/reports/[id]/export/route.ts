import { z } from "zod";
import { researchApi, type IdContext } from "@/lib/research/api";
import { getResearchReport, WorkflowError } from "@/lib/db/research-workflow";
import { renderResearchReport } from "@/lib/research/reports";
export const GET = (r: Request, c: IdContext) =>
  researchApi(async () => {
    const format = z
      .enum(["markdown", "csv", "html"])
      .parse(new URL(r.url).searchParams.get("format") ?? "markdown");
    const { report, evidence } = await getResearchReport((await c.params).id);
    if (report.audience === "external" && report.status !== "reviewed")
      throw new WorkflowError("external_review_required", 409);
    return new Response(renderResearchReport(report, evidence, format), {
      headers: {
        "Content-Type":
          format === "html"
            ? "text/html; charset=utf-8"
            : format === "csv"
              ? "text/csv; charset=utf-8"
              : "text/markdown; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="qcs-research.' +
          (format === "markdown" ? "md" : format) +
          '"',
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  });
