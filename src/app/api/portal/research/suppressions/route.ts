import { researchApi, requestJson } from "@/lib/research/api";
import { suppressResearchSubject } from "@/lib/db/research-workflow";
export const POST = (r: Request) =>
  researchApi(
    async () => ({ id: await suppressResearchSubject(await requestJson(r)) }),
    201,
  );
