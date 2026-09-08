import { isCompaniesHouseConfigured } from "@/lib/env";

export type CompaniesHouseCompany = {
  company_number?: string;
  title?: string;
  company_status?: string;
  date_of_creation?: string;
  address_snippet?: string;
  snippet?: string;
};

export type CompaniesHouseOfficer = {
  name?: string;
  officer_role?: string;
  appointed_on?: string;
};

export type CompaniesHouseSnapshot = {
  company: Record<string, unknown> | null;
  officers: CompaniesHouseOfficer[];
  searchHits: CompaniesHouseCompany[];
};

function chHeaders(): HeadersInit {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) throw new Error("COMPANIES_HOUSE_API_KEY is not configured");
  const token = Buffer.from(`${key}:`).toString("base64");
  return { Authorization: `Basic ${token}`, Accept: "application/json" };
}

async function chGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`https://api.company-information.service.gov.uk${path}`, {
    headers: chHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Companies House ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchCompaniesHouseSnapshot(input: {
  companyName: string;
  companyNumber?: string | null;
}): Promise<CompaniesHouseSnapshot | null> {
  if (!isCompaniesHouseConfigured()) return null;

  const number = input.companyNumber?.replace(/\s+/g, "").toUpperCase();
  let company: Record<string, unknown> | null = null;
  let officers: CompaniesHouseOfficer[] = [];

  if (number) {
    company = await chGet<Record<string, unknown>>(`/company/${encodeURIComponent(number)}`);
    const officerPage = await chGet<{ items?: CompaniesHouseOfficer[] }>(
      `/company/${encodeURIComponent(number)}/officers?items_per_page=12`
    );
    officers = officerPage?.items ?? [];
  }

  const search = await chGet<{ items?: CompaniesHouseCompany[] }>(
    `/search/companies?q=${encodeURIComponent(number || input.companyName)}&items_per_page=5`
  );

  if (!company && search?.items?.[0]?.company_number) {
    const first = search.items[0].company_number;
    company = await chGet<Record<string, unknown>>(`/company/${encodeURIComponent(first)}`);
    const officerPage = await chGet<{ items?: CompaniesHouseOfficer[] }>(
      `/company/${encodeURIComponent(first)}/officers?items_per_page=12`
    );
    officers = officerPage?.items ?? [];
  }

  return {
    company,
    officers,
    searchHits: search?.items ?? [],
  };
}
