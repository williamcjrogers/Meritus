import { NextResponse } from "next/server";
import { isCompaniesHouseConfigured } from "@/lib/env";
import { requirePortalUser, setupResponse } from "@/lib/portal/auth";
import { searchCompanies } from "@/lib/research/companies-house";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 200;
const MAX_HITS = 5;

/** Search the register by name for the company picker: `?q=` gives up to five candidates. */
export async function GET(request: Request) {
  const gate = await requirePortalUser();
  if (gate.error) return gate.error;
  if (!isCompaniesHouseConfigured()) {
    return setupResponse("COMPANIES_HOUSE_API_KEY is not configured");
  }

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (!q) return NextResponse.json({ candidates: [] });

  try {
    const candidates = await searchCompanies(q, MAX_HITS);
    return NextResponse.json({ candidates });
  } catch (error) {
    console.warn("Companies House search failed", error);
    return NextResponse.json({ error: "Companies House is not responding" }, { status: 502 });
  }
}
