import { researchApi } from "@/lib/research/api";
import { listResearchRuns } from "@/lib/db/research-workflow";
export const GET = () => researchApi(() => listResearchRuns());
