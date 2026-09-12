/** Server runtime configuration; never pass either value to a client component. */
export type IntelligenceServiceConfig = { origin: string; secret: string };

export function intelligenceServiceConfig(): IntelligenceServiceConfig | null {
  const value = process.env.INTELLIGENCE_SERVICE_URL;
  const secret = process.env.INTELLIGENCE_BRIDGE_SECRET;
  if (!value || !secret || [...secret].length < 32 || !secret.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    return { origin: url.origin, secret };
  } catch {
    return null;
  }
}
