export function isClerkPublishable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

export function isClerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isAiConfigured(): boolean {
  return Boolean(
    process.env.VERCEL_OIDC_TOKEN ||
      process.env.AI_GATEWAY_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.VERCEL
  );
}

export function isCompaniesHouseConfigured(): boolean {
  return Boolean(process.env.COMPANIES_HOUSE_API_KEY);
}

/** Enquiry alerts go out through Resend; without a key they are skipped and recorded as such. */
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type SetupFlag = {
  key: string;
  ready: boolean;
  required: boolean;
};

export function getSetupFlags(): SetupFlag[] {
  return [
    { key: "Clerk", ready: isClerkConfigured(), required: true },
    { key: "Postgres (DATABASE_URL)", ready: isDatabaseConfigured(), required: true },
    { key: "Vercel Blob", ready: isBlobConfigured(), required: true },
    { key: "Vercel AI Gateway", ready: isAiConfigured(), required: true },
    { key: "Companies House", ready: isCompaniesHouseConfigured(), required: false },
    { key: "Resend", ready: isResendConfigured(), required: false },
  ];
}

export function missingRequiredSetup(): boolean {
  return getSetupFlags().some((flag) => flag.required && !flag.ready);
}
