import {safeFetchCompaniesHouse} from "./safe-fetch";
import { isCompaniesHouseConfigured } from "@/lib/env";
import type { BriefOfficer, CompanyCandidate } from "@/lib/db/schema";

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
  resigned_on?: string;
};

export type CompaniesHouseSnapshot = {
  company: Record<string, unknown> | null;
  officers: CompaniesHouseOfficer[];
  searchHits: CompaniesHouseCompany[];
};

/** Every request uses the shared Companies House transport and account quota. */
const REQUEST_TIMEOUT_MS = 10_000;
async function chGet<T>(path: string): Promise<T | null> {
  const res=await safeFetchCompaniesHouse(`https://api.company-information.service.gov.uk${path}`,{signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS),maxBytes:10*1024*1024});
  if(res.status===404)return null;
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(res.body)) as T;
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


  return {
    company,
    officers,
    searchHits: search?.items ?? [],
  };
}

/* ------------------------------------------------------------------------- */
/* The brief's view of the register: typed records with a ten-second timeout */
/* on every request. The snapshot above is kept for the older research path. */
/* ------------------------------------------------------------------------- */

/** The fields of a company profile the brief reads, as the API names them. */
export type CompaniesHouseProfile = {
  company_number?: string;
  company_name?: string;
  company_status?: string;
  date_of_creation?: string;
  registered_office_address?: {
    premises?: string;
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  sic_codes?: string[];
  has_charges?: boolean;
  accounts?: { overdue?: boolean };
};

export type CompanyRecord = {
  companyNumber: string;
  title: string;
  status: string | null;
  incorporatedOn: string | null;
  address: string | null;
  sicCodes: string[];
  hasCharges: boolean | null;
  /** Total charges on the register when known; null when the count could not be read. */
  chargesCount: number | null;
  accountsOverdue: boolean | null;
};

const REGISTER_BASE = "https://find-and-update.company-information.service.gov.uk/company/";

/** Companies House numbers are eight characters; spaces are dropped and letters upper-cased. */
export function normaliseCompanyNumber(number: string): string {
  return number.replace(/\s+/g, "").toUpperCase();
}

export function registerUrl(number: string): string {
  return `${REGISTER_BASE}${encodeURIComponent(normaliseCompanyNumber(number))}`;
}

function addressLine(address: CompaniesHouseProfile["registered_office_address"]): string | null {
  if (!address) return null;
  const parts = [
    address.premises,
    address.address_line_1,
    address.address_line_2,
    address.locality,
    address.region,
    address.postal_code,
    address.country,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}

export function toCompanyRecord(profile: CompaniesHouseProfile): CompanyRecord {
  return {
    companyNumber: profile.company_number ?? "",
    title: profile.company_name ?? "",
    status: profile.company_status ?? null,
    incorporatedOn: profile.date_of_creation ?? null,
    address: addressLine(profile.registered_office_address),
    sicCodes: profile.sic_codes ?? [],
    hasCharges: typeof profile.has_charges === "boolean" ? profile.has_charges : null,
    chargesCount: null,
    accountsOverdue: typeof profile.accounts?.overdue === "boolean" ? profile.accounts.overdue : null,
  };
}

export function toOfficer(officer: CompaniesHouseOfficer): BriefOfficer {
  return {
    name: officer.name ?? "",
    role: officer.officer_role ?? null,
    appointedOn: officer.appointed_on ?? null,
  };
}

export function toCandidate(hit: CompaniesHouseCompany): CompanyCandidate {
  return {
    number: hit.company_number ?? "",
    title: hit.title ?? "",
    status: hit.company_status ?? null,
    address: hit.address_snippet ?? null,
  };
}

/** The company profile, with the charges count when the register says charges exist. */
export async function fetchCompany(number: string): Promise<CompanyRecord | null> {
  const id = encodeURIComponent(normaliseCompanyNumber(number));
  const profile = await chGet<CompaniesHouseProfile>(`/company/${id}`);
  if (!profile) return null;
  const record = toCompanyRecord(profile);
  if (record.hasCharges) {
    try {
      const charges = await chGet<{ total_count?: number }>(`/company/${id}/charges?items_per_page=1`);
      if (typeof charges?.total_count === "number") record.chargesCount = charges.total_count;
    } catch (error) {
      console.warn("Companies House charges unavailable", id, error);
    }
  }
  return record;
}

export async function fetchOfficers(number: string): Promise<BriefOfficer[]> {
  const id = encodeURIComponent(normaliseCompanyNumber(number));
  const items:CompaniesHouseOfficer[]=[];
  let start=0;
  for(let pages=0;pages<10000;pages++){
    const page=await chGet<{items?:CompaniesHouseOfficer[];total_results?:number}>(`/company/${id}/officers?items_per_page=100&start_index=${start}`);
    if(!page)break;
    if(!Array.isArray(page.items)||!Number.isSafeInteger(page.total_results)||page.total_results!<0)throw new Error('Incomplete Companies House officer page');
    items.push(...page.items);start+=page.items.length;
    if(start>=page.total_results!)break;
    if(!page.items.length||pages===9999)throw new Error('Incomplete Companies House officer page');
  }
  // Current appointments only, once each: the register keeps resigned and re-appointed entries side by side.
  const seen = new Set<string>();
  return items
    .filter((officer) => !officer.resigned_on)
    .map(toOfficer)
    .filter((officer) => {
      if (!officer.name) return false;
      const key = `${officer.name}|${officer.role ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function searchCompanies(name: string, limit = 5): Promise<CompanyCandidate[]> {
  const query = name.trim();
  if (!query) return [];
  const page = await chGet<{ items?: CompaniesHouseCompany[] }>(
    `/search/companies?q=${encodeURIComponent(query)}&items_per_page=${limit}`
  );
  return (page?.items ?? [])
    .map(toCandidate)
    .filter((candidate) => candidate.number && candidate.title)
    .slice(0, limit);
}
