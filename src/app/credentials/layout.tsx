import type { Metadata } from "next";

// The credentials portal is private — keep it out of search indexes.
export const metadata: Metadata = {
  title: "Credentials Portal",
  robots: { index: false, follow: false },
  alternates: { canonical: "/credentials" },
};

export default function CredentialsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
