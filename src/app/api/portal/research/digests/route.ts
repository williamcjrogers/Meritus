import { researchApi } from "@/lib/research/api";
import { listResearchDigests } from "@/lib/db/research-intelligence";
export const GET = () => researchApi(listResearchDigests);
