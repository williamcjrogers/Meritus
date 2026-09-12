import { researchApi, requestJson } from "@/lib/research/api";
import { listResearchSources } from "@/lib/db/research-workflow";
import { registerSource } from "@/lib/db/research";
import { sourceRegistration } from "@/lib/research/source-registration";
export const GET = () => researchApi(() => listResearchSources());
export const POST = (r: Request) =>
  researchApi(
    async () => registerSource(sourceRegistration.parse(await requestJson(r))),
    201,
  );
