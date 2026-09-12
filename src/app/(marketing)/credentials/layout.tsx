import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Credentials",
  robots: { index: false, follow: false },
  alternates: { canonical: "/credentials" },
};
export default function CredentialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
