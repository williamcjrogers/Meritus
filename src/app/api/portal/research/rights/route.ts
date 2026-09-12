import { researchApi, requestJson } from "@/lib/research/api";
import {
  listResearchRights,
  createResearchRights,
} from "@/lib/db/research-workflow";
export const GET = () => researchApi(() => listResearchRights());
export const POST = (r: Request) =>
  researchApi(
    async () => ({ id: await createResearchRights(await requestJson(r)) }),
    201,
  );
