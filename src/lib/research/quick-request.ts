import { z } from "zod";
export const quickQuestionSchema = z.object({
  requestId: z.uuid(),
  question: z.string().trim().min(5, "Enter a question with a little more detail.").max(2000),
  monitoring: z.boolean(),
}).strict();
export const quickMonitoringSchema = z.object({ monitoring: z.boolean() }).strict();
export const opportunityReviewSchema = z.object({ action: z.enum(["save", "dismiss", "reopen"]) }).strict();
