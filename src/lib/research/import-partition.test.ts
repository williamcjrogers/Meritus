import { it, expect } from "vitest";
import { importPartitionSchema, importPartitionSelection } from "./import-partition";
import { semanticImportSelection } from "./selection";
import { requestHash } from "./commission";
const original = "a".repeat(64), partHash = "b".repeat(64);
it("rejects a missing or malformed original hash for split parts", () => {
  expect(importPartitionSchema.safeParse({ partCount: 2, partIndex: 1, snapshotHash: "" }).success).toBe(false);
  expect(importPartitionSchema.safeParse({ partCount: 2, partIndex: 1, snapshotHash: "xyz" }).success).toBe(false);
});
it("rejects an out-of-range part number", () => {
  expect(importPartitionSchema.safeParse({ partCount: 2, partIndex: 3, snapshotHash: original }).success).toBe(false);
  expect(importPartitionSchema.safeParse({ partCount: 2, partIndex: 0, snapshotHash: original }).success).toBe(false);
});
it("maps the director's part number to a zero-based source payload", () => {
  const partition = importPartitionSchema.parse({ partCount: "3", partIndex: "2", snapshotHash: original });
  expect(importPartitionSelection(partition, partHash)).toEqual({ snapshotId: original, partIndex: 1, partCount: 3 });
});
it("uses the uploaded hash for a single file without a supplied manifest hash", () => {
  expect(importPartitionSelection(importPartitionSchema.parse({}), partHash)).toEqual({ snapshotId: partHash, partIndex: 0, partCount: 1 });
});
it("keeps retry identity stable across new object keys but changes it for a different part or changed bytes", () => {
  const selection = { objectKey: "research/first", snapshotId: original, partIndex: 0, partCount: 3 };
  const identity = (s: Record<string, unknown>, contentHash = partHash) => requestHash({ selection: semanticImportSelection(s), contentHash });
  expect(identity(selection)).toBe(identity({ ...selection, objectKey: "research/retry" }));
  expect(identity(selection)).not.toBe(identity({ ...selection, partIndex: 1 }));
  expect(identity(selection)).not.toBe(identity(selection, "c".repeat(64)));
});
