import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let cached: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!cached) {
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}

export function requireDb(): NeonHttpDatabase<typeof schema> {
  const db = getDb();
  if (!db) {
    throw new Error("DATABASE_URL is not configured");
  }
  return db;
}
