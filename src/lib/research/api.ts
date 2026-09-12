import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isDatabaseConfigured } from "@/lib/env";
import { requireResearchDirector, ResearchAccessError } from "./roles";
import { WorkflowError } from "@/lib/db/research-workflow";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
export async function researchApi(
  handler: (actor: string) => Promise<unknown>,
  status = 200,
): Promise<Response> {
  try {
    const actor = await requireResearchDirector();
    if (!isDatabaseConfigured())
      return NextResponse.json(
        { error: "Research database is not configured" },
        { status: 503, headers },
      );
    const result = await handler(actor);
    if (result instanceof Response) {
      const nextHeaders = new Headers(result.headers);
      for (const [key, value] of Object.entries(headers))
        nextHeaders.set(key, value);
      return new Response(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers: nextHeaders,
      });
    }
    return NextResponse.json(result, { status, headers });
  } catch (error) {
    if (error instanceof ResearchAccessError)
      return NextResponse.json(
        { error: error.code },
        { status: error.status, headers },
      );
    if (error instanceof WorkflowError)
      return NextResponse.json(
        { error: error.code },
        { status: error.status, headers },
      );
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400, headers },
      );
    let current: unknown = error;
    for (let n = 0; n < 5 && current && typeof current === "object"; n++) {
      const e = current as { message?: string; cause?: unknown };
      const code = e.message?.match(
        /\b(idempotency_conflict|revision_conflict|evidence_unavailable|subject_suppressed|current_review_required|single_event_reason_required|confirmed_entity_required|source_not_found|verified_claim_required|rights_unavailable|run_budget|daily_model_budget|model_capacity)\b/,
      )?.[1];
      if (code)
        return NextResponse.json({ error: code }, { status: 409, headers });
      current = e.cause;
    }
    return NextResponse.json(
      {
        error:
          "Research request could not be completed. The saved state is unchanged or available on refresh.",
      },
      { status: 503, headers },
    );
  }
}
export async function readBoundedRequestBody(request:Request,limit:number):Promise<Uint8Array<ArrayBuffer>>{
 if(Number(request.headers.get('content-length')??0)>limit)throw new WorkflowError('request_too_large',413);
 const reader=request.body?.getReader();if(!reader)throw new WorkflowError('invalid_body');const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new WorkflowError('request_too_large',413);}chunks.push(value);}const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}return body;}finally{reader.releaseLock();}
}
export async function requestJson(request:Request):Promise<unknown>{try{return JSON.parse(new TextDecoder().decode(await readBoundedRequestBody(request,1024*1024)));}catch(error){if(error instanceof WorkflowError)throw error;throw new WorkflowError('invalid_json');}}
export type IdContext = { params: Promise<{ id: string }> };
