import { researchApi, type IdContext } from "@/lib/research/api";
import {
  getInvestigation,
  researchEvidence,
  listResearchClaims,
  listResearchSignals,
  listResearchRuns,
  listResearchReports,
  listResearchAnswers,
} from "@/lib/db/research-workflow";
export const GET = (_r: Request, c: IdContext) =>
  researchApi(async () => {
    const { id } = await c.params;
    const [investigation, evidence, claims, signals, runs, reports, answers] =
      await Promise.all([
        getInvestigation(id),
        researchEvidence(id),
        listResearchClaims(id),
        listResearchSignals(id),
        listResearchRuns(id),
        listResearchReports(id),
        listResearchAnswers(id),
      ]);
    return { investigation, evidence, claims, signals, runs, reports, answers };
  });
