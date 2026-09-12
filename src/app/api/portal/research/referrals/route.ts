import { researchApi, requestJson } from "@/lib/research/api";
import { listReferrals, createReferral } from "@/lib/db/research-workflow";
export const GET = () => researchApi(() => listReferrals());
export const POST = (r: Request) =>
  researchApi(
    async () => ({ id: await createReferral(await requestJson(r)) }),
    201,
  );
