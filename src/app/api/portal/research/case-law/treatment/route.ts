import { researchApi, requestJson } from "@/lib/research/api";
import {
  reviewCaseTreatment,
  listCaseTreatments,
} from "@/lib/db/research-entities";
export async function GET(request: Request) {
  return researchApi(async () =>
    listCaseTreatments(
      new URL(request.url).searchParams.get("documentId") ?? "",
    ),
  );
}
export async function POST(request: Request) {
  return researchApi(
    async () => reviewCaseTreatment(await requestJson(request)),
    201,
  );
}
