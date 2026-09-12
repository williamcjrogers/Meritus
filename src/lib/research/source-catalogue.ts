/** Sources reviewed on 12 September 2026. Commercial agreements are recorded separately. */
export const QCS_CASE_LAW_RIGHTS_ID = "51435300-0000-4000-8000-000000000101";
export const PUBLIC_REGISTER_RIGHTS_ID = "51435300-0000-4000-8000-000000000102";
export const QCS_CASE_LAW_ACKNOWLEDGEMENT = "Crown copyright material reproduced by permission of The National Archives. The contents of the judgment can be used under the Open Justice – Licence.";
export const CASE_LAW_COVERAGE_NOTICE = "The published judgments and decisions only partially represent the activities of the courts and tribunals. Search results are not a complete record of proceedings or judicial treatment.";
export const QCS_CASE_LAW_AGREEMENT = {
  id: QCS_CASE_LAW_RIGHTS_ID,
  holder: "Quantum Commercial Solutions Limited",
  material: "Court Judgments and Tribunal Decisions published by the Keeper of Public Records on The National Archives website",
  purpose: "To publish the current version of the information on a platform (Claims Toolkit) and to provide case summarisation and interpretation facilities that enable legal professionals and claims consultants to find and access judgments.",
  agreementRef: "Find_Case_Law_transactional_licence_Quantum_Commercial_Solutions_Limited.docx.pdf; signed 12 May 2026",
  agreementHash: "b05f5c2943043d07a2952f7722a94b3188367f16efd6581afd0e3016bf5daf6f",
  effectiveAt: "2026-05-12T13:38:00Z",
  expiresAt: "2031-05-12T00:00:00Z",
  transferConditions: { consentRequired: ["assignment", "novation", "sub-licensing"], territory: "World" },
  retentionInstructions: { currentVersionsOnly: true, privateAccess: true, preventThirdPartyCrawling: true, acknowledgement: QCS_CASE_LAW_ACKNOWLEDGEMENT, partialCoverageNotice: CASE_LAW_COVERAGE_NOTICE, presentationApprovalReference: null },
  withdrawalInstructions: { removeReplacedOrWithdrawnMaterial: true, purgeDependantsAndRestoredBackups: true, termination: "Return or erase copies and provide the required certificate." },
  useAssessment: "William Rogers confirmed that QCS owns and operates this software and authorised the research implementation. The supplied signed agreement is recorded as existing computational authority. The purpose and actual terms are preserved without a Meritus ownership restriction. The expiry uses the start of the fifth anniversary conservatively; record any amendment here.",
} as const;

export type ResearchSourceTemplate = {
  id: string; label: string; provider: string; hosts: string[]; rightsId: string;
  termsUrl: string; attribution: string; selection: Record<string, unknown>;
  status: "ready" | "paused" | "unavailable"; configurationError: string | null;
  credentialRef: string | null; cadenceSeconds: number; requestLimit: number; windowSeconds: number;
};
const ogl = "Contains public sector information licensed under the Open Government Licence v3.0. Personal data and third-party rights are subject to separate requirements.";
export const RESEARCH_SOURCE_TEMPLATES: ResearchSourceTemplate[] = [
  { id: "51435300-0000-4000-8000-000000000201", label: "Find Case Law, QCS licensed judgments", provider: "find-case-law", hosts: ["caselaw.nationalarchives.gov.uk"], rightsId: QCS_CASE_LAW_RIGHTS_ID, termsUrl: "https://caselaw.nationalarchives.gov.uk/open-justice-licence/version/2", attribution: QCS_CASE_LAW_ACKNOWLEDGEMENT, selection: { order: "-transformation" }, status: "ready", configurationError: null, credentialRef: null, cadenceSeconds: 86400, requestLimit: 30, windowSeconds: 60 },
  { id: "51435300-0000-4000-8000-000000000202", label: "Companies House", provider: "companies-house", hosts: ["api.company-information.service.gov.uk"], rightsId: PUBLIC_REGISTER_RIGHTS_ID, termsUrl: "https://www.gov.uk/guidance/companies-house-data-products", attribution: ogl, selection: {}, status: "paused", configurationError: "Choose a company and configure the API credential", credentialRef: "RESEARCH_COMPANIES_HOUSE_API_KEY", cadenceSeconds: 86400, requestLimit: 600, windowSeconds: 300 },
  { id: "51435300-0000-4000-8000-000000000203", label: "Find a Tender", provider: "find-a-tender", hosts: ["www.find-tender.service.gov.uk"], rightsId: PUBLIC_REGISTER_RIGHTS_ID, termsUrl: "https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages", attribution: ogl, selection: {}, status: "ready", configurationError: null, credentialRef: null, cadenceSeconds: 86400, requestLimit: 30, windowSeconds: 60 },
  { id: "51435300-0000-4000-8000-000000000204", label: "Contracts Finder", provider: "contracts-finder", hosts: ["www.contractsfinder.service.gov.uk"], rightsId: PUBLIC_REGISTER_RIGHTS_ID, termsUrl: "https://www.contractsfinder.service.gov.uk/apidocumentation/Notices/1/GET-Published-Notice-OCDS-Search", attribution: ogl, selection: {}, status: "ready", configurationError: null, credentialRef: null, cadenceSeconds: 86400, requestLimit: 30, windowSeconds: 60 },
  { id: "51435300-0000-4000-8000-000000000205", label: "Payment Practices official register", provider: "payment-practices", hosts: ["check-payment-practices.service.gov.uk"], rightsId: PUBLIC_REGISTER_RIGHTS_ID, termsUrl: "https://check-payment-practices.service.gov.uk/export/", attribution: ogl, selection: {}, status: "ready", configurationError: null, credentialRef: null, cadenceSeconds: 604800, requestLimit: 10, windowSeconds: 60 },
  { id: "51435300-0000-4000-8000-000000000206", label: "Gazette public insolvency notices", provider: "gazette", hosts: ["www.thegazette.co.uk"], rightsId: PUBLIC_REGISTER_RIGHTS_ID, termsUrl: "https://www.thegazette.co.uk/fair-use-policy", attribution: "Contains information from The Gazette. Non-personal information is reused under the Open Government Licence; public access follows the publisher's fair-use and robots policies.", selection: {}, status: "paused", configurationError: "Choose notice types and configure the crawler contact URL", credentialRef: null, cadenceSeconds: 86400, requestLimit: 1, windowSeconds: 10 },
  { id: "51435300-0000-4000-8000-000000000207", label: "Building Safety Regulator publications", provider: "building-safety", hosts: ["www.gov.uk", "assets.publishing.service.gov.uk"], rightsId: PUBLIC_REGISTER_RIGHTS_ID, termsUrl: "https://www.gov.uk/government/collections/building-safety-regulator-building-control-approval-application-data", attribution: ogl, selection: { publicationUrl: "https://www.gov.uk/government/collections/building-safety-regulator-building-control-approval-application-data" }, status: "ready", configurationError: null, credentialRef: null, cadenceSeconds: 604800, requestLimit: 20, windowSeconds: 60 },
];
