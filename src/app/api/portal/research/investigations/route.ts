import { researchApi, requestJson } from "@/lib/research/api";
import {
  commissionInvestigation,
  listInvestigations,
} from "@/lib/db/research-workflow";
export const GET = (request: Request) =>
  researchApi(() =>
    listInvestigations(
      Number(new URL(request.url).searchParams.get("offset") ?? 0),
    ),
  );
export const POST = (request: Request) =>
  researchApi(
    async () => commissionInvestigation(await requestJson(request)),
    202,
  );
