import { eq } from "drizzle-orm";
import { requireDb } from "./index";
import { questions, type Question, type QuestionSource } from "./schema";

export async function listQuestions(pursuitId: string): Promise<Question[]> {
  const db = requireDb();
  return db
    .select()
    .from(questions)
    .where(eq(questions.pursuitId, pursuitId))
    .orderBy(questions.createdAt);
}

export async function addQuestion(values: {
  pursuitId: string;
  role: "user" | "assistant";
  content: string;
  sources?: QuestionSource[] | null;
}): Promise<Question> {
  const db = requireDb();
  const [row] = await db
    .insert(questions)
    .values({
      id: crypto.randomUUID(),
      pursuitId: values.pursuitId,
      role: values.role,
      content: values.content,
      sources: values.sources ?? null,
    })
    .returning();
  return row;
}

export async function clearQuestions(pursuitId: string): Promise<void> {
  const db = requireDb();
  await db.delete(questions).where(eq(questions.pursuitId, pursuitId));
}
