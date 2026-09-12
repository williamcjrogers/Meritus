import { sql } from "drizzle-orm";
import { workflowRows } from "@/lib/db/research-workflow";
import { deleteResearchObject } from "./evidence";
/** Internal worker hook. Availability reads deny immediately; purge retries retain object references. */
export async function invalidateResearchDependants(
  versionId: string,
): Promise<void> {
  await workflowRows(
    sql`select research_invalidate_workflow(${versionId}::uuid)`,
  );
  const reports = await workflowRows<{ id: string; objectKey: string }>(
    sql`select distinct r.id,r.object_key as "objectKey" from research_reports r join research_report_evidence e on e.report_id=r.id where e.version_id=${versionId}::uuid and r.object_key is not null limit 3`,
  );
  for (const report of reports) {
    await deleteResearchObject(report.objectKey);
    await workflowRows(
      sql`update research_reports set object_key=null where id=${report.id}::uuid and object_key=${report.objectKey}`,
    );
  }
  const remaining = await workflowRows(
    sql`select r.id from research_reports r join research_report_evidence e on e.report_id=r.id where e.version_id=${versionId}::uuid and r.object_key is not null limit 1`,
  );
  if (remaining.length) throw new Error("invalidation_remaining");
}
