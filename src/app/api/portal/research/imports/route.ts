import { randomUUID } from "node:crypto";
import { z } from "zod";
import { researchApi,readBoundedRequestBody } from "@/lib/research/api";
import {
  WorkflowError,
  commissionImportedResearch,
  listResearchSources,
} from "@/lib/db/research-workflow";
import { previewImport } from "@/lib/research/imports/preview";
import { storeResearchImport } from "@/lib/research/evidence";
import { PORTAL_IMPORT_FILE_BYTES, PORTAL_IMPORT_ENVELOPE_BYTES } from "@/lib/research/import-limits";
import { importPartitionSchema, importPartitionSelection } from "@/lib/research/import-partition";
export const maxDuration = 120;
export async function POST(request: Request) {
  return researchApi(async () => {
    if (Number(request.headers.get("content-length") ?? 0) > PORTAL_IMPORT_ENVELOPE_BYTES)
      throw new WorkflowError("import_too_large", 413);
    const boundedBody=await readBoundedRequestBody(request,PORTAL_IMPORT_ENVELOPE_BYTES);
    const form = await new Request(request.url,{method:"POST",headers:{"Content-Type":request.headers.get("Content-Type")??""},body:boundedBody}).formData(),
      file = form.get("file");
    if (!(file instanceof File) || file.size > PORTAL_IMPORT_FILE_BYTES)
      throw new WorkflowError("file_required_maximum_4mib", 413);
    const format = z.enum(["csv", "json"]).parse(form.get("format")),
      sourceId = z.uuid().parse(form.get("sourceId"));
    const partition = importPartitionSchema.parse({
      partCount: form.get("partCount") ?? 1,
      partIndex: form.get("partIndex") ?? 1,
      snapshotHash: form.get("snapshotHash"),
    });
    const source = (await listResearchSources()).find((s) => s.id === sourceId);
    if (
      !source ||
      ![
        "research-import",
        "commercial-import",
        "court-listings",
        "bailii",
      ].includes(source.provider)
    )
      throw new WorkflowError("registered_import_source_required");
    const mapping: Record<string, string> = {};
    for (const field of [
      "id",
      "title",
      "text",
      "companyNumber",
      "eventAt",
      "url",
    ]) {
      const value = form.get(field);
      if (typeof value === "string" && value.trim())
        mapping[field] = value.trim();
    }
    const bytes = new Uint8Array(await file.arrayBuffer()),
      preview = await previewImport(bytes, format, mapping);
    if (form.get("action") === "preview") return preview;
    if (preview.errors.length)
      throw new WorkflowError("correct_import_mapping_errors");
    const object = await storeResearchImport({
      sourceId,
      body: bytes,
      contentType: format === "csv" ? "text/csv" : "application/json",
      signal: request.signal,
    });
    return commissionImportedResearch(
      {
        requestId: form.get("requestId") ?? randomUUID(),
        question: form.get("question"),
        scope: {
          kind: "organisation",
          subject: form.get("subject"),
          entityId: null,
          jurisdiction: "United Kingdom",
          from: null,
          to: null,
          sources: [sourceId],
        },
        budget: { maxRequests: 100, maxTokens: 100000, maxCostPence: 1000 },
      },
      sourceId,
      {
        objectKey: object.objectKey,
        format,
        mapping,
        ...importPartitionSelection(partition, object.sha256),
        ...(source.provider !== "research-import"
          ? { agreementId: source.rightsId }
          : {}),
      },
      object.sha256,
    );
  });
}
