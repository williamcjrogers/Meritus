import { researchApi, requestJson } from "@/lib/research/api";
import {
  listResearchIndexes,
  saveResearchIndex,
} from "@/lib/db/research-intelligence";
export const GET = () => researchApi(listResearchIndexes);
export const POST = (request: Request) =>
  researchApi(async () => saveResearchIndex(await requestJson(request)), 201);
