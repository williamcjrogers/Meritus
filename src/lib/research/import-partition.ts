import { z } from "zod";

/** The portal numbers parts from one; durable source jobs use zero-based indices. */
export const importPartitionSchema = z
  .object({
    partCount: z.coerce.number().int().min(1).max(10000).default(1),
    partIndex: z.coerce.number().int().min(1).max(10000).default(1),
    snapshotHash: z.preprocess(
      (value) => typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null,
      z.string().regex(/^[a-f0-9]{64}$/, "The original snapshot hash must contain 64 hexadecimal characters").nullable(),
    ),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.partIndex > value.partCount) {
      context.addIssue({ code: "custom", path: ["partIndex"], message: "The part number must not exceed the total number of parts" });
    }
    if (value.partCount > 1 && !value.snapshotHash) {
      context.addIssue({ code: "custom", path: ["snapshotHash"], message: "Split parts require the original snapshot hash from the manifest" });
    }
  })
  .transform((value) => ({ ...value, partIndex: value.partIndex - 1 }));

export type ImportPartition = z.infer<typeof importPartitionSchema>;
export function importPartitionSelection(partition: ImportPartition, uploadedHash: string) {
  return {
    snapshotId: partition.snapshotHash ?? uploadedHash,
    partIndex: partition.partIndex,
    partCount: partition.partCount,
  };
}
