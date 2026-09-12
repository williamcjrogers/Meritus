import { proxyIntelligenceRequest } from "@/lib/intelligence/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const GET = proxyIntelligenceRequest;
export const HEAD = proxyIntelligenceRequest;
export const POST = proxyIntelligenceRequest;
export const PUT = proxyIntelligenceRequest;
export const PATCH = proxyIntelligenceRequest;
export const DELETE = proxyIntelligenceRequest;
