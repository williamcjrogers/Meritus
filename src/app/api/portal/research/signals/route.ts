import { researchApi } from "@/lib/research/api";
import { listResearchSignals } from "@/lib/db/research-workflow";
export const GET = () => researchApi(() => listResearchSignals());
