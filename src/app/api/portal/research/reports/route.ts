import { researchApi } from "@/lib/research/api";
import { listResearchReports } from "@/lib/db/research-workflow";
export const GET = () => researchApi(() => listResearchReports());
