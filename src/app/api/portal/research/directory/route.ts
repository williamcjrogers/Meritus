import { researchApi } from "@/lib/research/api";
import { listDirectors } from "@/lib/portal/directors";
export const GET = () =>
  researchApi(async () =>
    (await listDirectors()).map((d) => ({ id: d.id, name: d.name })),
  );
