import { researchApi, requestJson } from "@/lib/research/api";
import {
  listResearchEntities,
  createWorkflowEntity,
} from "@/lib/db/research-workflow";
export const GET = () => researchApi(() => listResearchEntities());
export const POST = (r: Request) =>
  researchApi(
    async () => ({ id: await createWorkflowEntity(await requestJson(r)) }),
    201,
  );
