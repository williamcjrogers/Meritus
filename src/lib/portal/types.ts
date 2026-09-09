export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

export type PursuitFormInput = {
  firm: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  companyNumber?: string;
  party?: string;
  partyCompanyNumber?: string;
  counterparty?: string;
  disputeNature: string;
  approximateValue?: string;
  forum?: string;
  source: "referral" | "introduction" | "existing_client" | "other";
  sourceDetail?: string;
  summary?: string;
};
