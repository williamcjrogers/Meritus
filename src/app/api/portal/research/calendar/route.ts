import { researchApi, requestJson } from "@/lib/research/api";
import {
  listCalendarEntries,
  createCalendarEntry,
} from "@/lib/db/research-workflow";
export const GET = () => researchApi(() => listCalendarEntries());
export const POST = (r: Request) =>
  researchApi(
    async () => ({ id: await createCalendarEntry(await requestJson(r)) }),
    201,
  );
