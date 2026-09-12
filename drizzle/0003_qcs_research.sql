CREATE TABLE "research_budget_days" (
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"source_id" uuid NOT NULL,
	"day" date NOT NULL,
	"requests" bigint DEFAULT 0 NOT NULL,
	"tokens" bigint DEFAULT 0 NOT NULL,
	"pence" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "research_budget_days_source_id_day_pk" PRIMARY KEY("source_id","day"),
	CONSTRAINT "research_budget_nonnegative" CHECK ("research_budget_days"."requests">=0 and "research_budget_days"."tokens">=0 and "research_budget_days"."pence">=0)
);

CREATE TABLE "research_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_id" uuid NOT NULL,
	"scope_key" text NOT NULL,
	"cursor" text,
	"watermark_at" timestamp with time zone,
	"revision" bigint DEFAULT 0 NOT NULL
);

CREATE TABLE "research_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"current_version_id" uuid,
	"canonical_url" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"availability_checked_at" timestamp with time zone NOT NULL
);

CREATE TABLE "research_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"display_name" text NOT NULL,
	"jurisdiction" text,
	"confirmed" boolean DEFAULT false NOT NULL
);

CREATE TABLE "research_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entity_id" uuid NOT NULL,
	"scheme" text NOT NULL,
	"value" text NOT NULL,
	"source_id" uuid NOT NULL,
	"verified" boolean DEFAULT false NOT NULL
);

CREATE TABLE "research_invalidations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"document_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "research_investigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"question" text NOT NULL,
	"scope" jsonb NOT NULL,
	"owner" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"budget" jsonb NOT NULL,
	"latest_completed_run_id" uuid
);

CREATE TABLE "research_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"scope_key" text NOT NULL,
	"run_id" uuid NOT NULL,
	"dedupe_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"cursor" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_owner" text,
	"lease_token" bigint DEFAULT 0 NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"error_code" text,
	CONSTRAINT "research_jobs_dedupe_key_unique" UNIQUE("dedupe_key"),
	CONSTRAINT "research_lease_nonnegative" CHECK ("research_jobs"."lease_token">=0)
);

CREATE TABLE "research_model_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"day" date NOT NULL,
	"tokens" bigint NOT NULL,
	"pence" bigint NOT NULL,
	"actual_tokens" bigint,
	"actual_pence" bigint,
	"status" text DEFAULT 'reserved' NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now()+interval '120 seconds' NOT NULL,
	CONSTRAINT "research_model_units" CHECK ("research_model_reservations"."tokens">=0 and "research_model_reservations"."pence">=0 and ("research_model_reservations"."actual_tokens" is null or "research_model_reservations"."actual_tokens">=0) and ("research_model_reservations"."actual_pence" is null or "research_model_reservations"."actual_pence">=0))
);

CREATE TABLE "research_passages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version_id" uuid NOT NULL,
	"locator" jsonb NOT NULL,
	"text" text NOT NULL,
	"hash" text NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);

CREATE TABLE "research_request_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "research_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" uuid NOT NULL,
	"reason" text NOT NULL,
	"references" jsonb NOT NULL
);

CREATE TABLE "research_rights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"holder" text NOT NULL,
	"material" text NOT NULL,
	"purpose" text NOT NULL,
	"agreement_ref" text NOT NULL,
	"agreement_hash" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"transfer_conditions" jsonb NOT NULL,
	"retention_instructions" jsonb NOT NULL,
	"withdrawal_instructions" jsonb NOT NULL,
	"use_assessment" text NOT NULL
);

CREATE TABLE "research_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"investigation_id" uuid,
	"source_selection" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"versions" jsonb NOT NULL,
	"reserved_pence" integer DEFAULT 0 NOT NULL,
	"actual_pence" integer DEFAULT 0 NOT NULL,
	"actual_tokens" bigint DEFAULT 0 NOT NULL,
	"coverage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_summary" text
);

CREATE TABLE "research_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"label" text NOT NULL,
	"provider" text NOT NULL,
	"hosts" jsonb NOT NULL,
	"access_method" text NOT NULL,
	"terms_url" text NOT NULL,
	"terms_version" text NOT NULL,
	"terms_reviewed_at" timestamp with time zone NOT NULL,
	"attribution" text NOT NULL,
	"operator" text NOT NULL,
	"purpose" text NOT NULL,
	"selection" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"backfill_start" timestamp with time zone NOT NULL,
	"configuration_error" text,
	"rights_id" uuid NOT NULL,
	"credential_ref" text,
	"status" text DEFAULT 'unavailable' NOT NULL,
	"cadence_seconds" integer NOT NULL,
	"freshness_seconds" integer NOT NULL,
	"last_success_at" timestamp with time zone,
	"next_due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_limit" integer NOT NULL,
	"window_seconds" integer NOT NULL,
	"daily_requests" integer NOT NULL,
	"daily_tokens" bigint NOT NULL,
	"daily_pence" integer NOT NULL,
	CONSTRAINT "research_source_status" CHECK ("research_sources"."status" in ('ready','unavailable','paused')),
	CONSTRAINT "research_source_limits" CHECK ("research_sources"."cadence_seconds">0 and "research_sources"."freshness_seconds">0 and "research_sources"."request_limit">0 and "research_sources"."window_seconds">0 and "research_sources"."daily_requests">=0 and "research_sources"."daily_tokens">=0 and "research_sources"."daily_pence">=0)
);

CREATE TABLE "research_staged_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"object_key" text NOT NULL,
	"source_id" uuid NOT NULL,
	"size" bigint NOT NULL,
	"sha256" text NOT NULL,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "research_staged_objects_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "research_object_size" CHECK ("research_staged_objects"."size">=0)
);

CREATE TABLE "research_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid DEFAULT '51435300-0000-4000-8000-000000000001' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"document_id" uuid NOT NULL,
	"hash" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone NOT NULL,
	"event_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"object_key" text,
	"content_type" text NOT NULL,
	"availability" text DEFAULT 'available' NOT NULL,
	"parser_version" text NOT NULL,
	"metadata" jsonb NOT NULL
);

ALTER TABLE "research_budget_days" ADD CONSTRAINT "research_budget_days_source_id_research_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."research_sources"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_checkpoints" ADD CONSTRAINT "research_checkpoints_source_id_research_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."research_sources"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_documents" ADD CONSTRAINT "research_documents_source_id_research_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."research_sources"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_identifiers" ADD CONSTRAINT "research_identifiers_entity_id_research_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."research_entities"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_identifiers" ADD CONSTRAINT "research_identifiers_source_id_research_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."research_sources"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_invalidations" ADD CONSTRAINT "research_invalidations_document_id_research_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."research_documents"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_invalidations" ADD CONSTRAINT "research_invalidations_version_id_research_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."research_versions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_source_id_research_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."research_sources"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_run_id_research_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."research_runs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_model_reservations" ADD CONSTRAINT "research_model_reservations_source_id_research_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."research_sources"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_model_reservations" ADD CONSTRAINT "research_model_reservations_run_id_research_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."research_runs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_passages" ADD CONSTRAINT "research_passages_version_id_research_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."research_versions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_request_reservations" ADD CONSTRAINT "research_request_reservations_source_id_research_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."research_sources"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_request_reservations" ADD CONSTRAINT "research_request_reservations_run_id_research_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."research_runs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_investigation_id_research_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."research_investigations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_sources" ADD CONSTRAINT "research_sources_rights_id_research_rights_id_fk" FOREIGN KEY ("rights_id") REFERENCES "public"."research_rights"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_staged_objects" ADD CONSTRAINT "research_staged_objects_source_id_research_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."research_sources"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "research_versions" ADD CONSTRAINT "research_versions_document_id_research_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."research_documents"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "research_checkpoint_scope" ON "research_checkpoints" USING btree ("workspace_id","source_id","scope_key");
CREATE UNIQUE INDEX "research_document_identity" ON "research_documents" USING btree ("workspace_id","source_id","provider_id");
CREATE INDEX "research_documents_updated" ON "research_documents" USING btree ("updated_at");
CREATE INDEX "research_entities_updated" ON "research_entities" USING btree ("updated_at");
CREATE UNIQUE INDEX "research_verified_identifier" ON "research_identifiers" USING btree ("workspace_id","scheme","value") WHERE verified and scheme in ('uk-company-number','lei','ocid');
CREATE UNIQUE INDEX "research_invalidation_version" ON "research_invalidations" USING btree ("version_id");
CREATE INDEX "research_investigations_updated" ON "research_investigations" USING btree ("updated_at");
CREATE UNIQUE INDEX "research_one_active_scope" ON "research_jobs" USING btree ("workspace_id","source_id","scope_key") WHERE status in ('queued','running','retry');
CREATE INDEX "research_jobs_due" ON "research_jobs" USING btree ("status","next_attempt_at");
CREATE INDEX "research_model_active" ON "research_model_reservations" USING btree ("status","expires_at");
CREATE INDEX "research_passage_search" ON "research_passages" USING gin ("search");
CREATE UNIQUE INDEX "research_passage_identity" ON "research_passages" USING btree ("version_id","hash");
CREATE INDEX "research_request_window" ON "research_request_reservations" USING btree ("source_id","reserved_at");
CREATE INDEX "research_sources_updated" ON "research_sources" USING btree ("updated_at");
CREATE INDEX "research_staged_cleanup" ON "research_staged_objects" USING btree ("claimed_at","created_at");
CREATE INDEX "research_version_hash" ON "research_versions" USING btree ("document_id","hash");

CREATE TABLE research_legacy_ch_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), reserved_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_legacy_ch_window ON research_legacy_ch_requests(reserved_at);

CREATE TABLE research_run_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 run_id uuid NOT NULL REFERENCES research_runs(id), document_id uuid NOT NULL REFERENCES research_documents(id), version_id uuid NOT NULL REFERENCES research_versions(id), metadata jsonb NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX research_run_version ON research_run_documents(run_id,version_id);
CREATE INDEX research_run_document_lookup ON research_run_documents(workspace_id,run_id,document_id);

-- Circular references are added only after both sides exist.
ALTER TABLE research_documents ADD CONSTRAINT research_current_version_fk FOREIGN KEY(current_version_id) REFERENCES research_versions(id);
ALTER TABLE research_investigations ADD CONSTRAINT research_latest_run_fk FOREIGN KEY(latest_completed_run_id) REFERENCES research_runs(id);
ALTER TABLE research_rights ADD CONSTRAINT research_rights_window CHECK(expires_at IS NULL OR expires_at>=effective_at);
ALTER TABLE research_runs ADD CONSTRAINT research_run_units CHECK(reserved_pence>=0 AND actual_pence>=0 AND actual_tokens>=0);

-- Every function is a complete transaction under Neon HTTP. No lock spans HTTP calls.
CREATE FUNCTION research_lease_job(p_owner text) RETURNS SETOF jsonb LANGUAGE plpgsql AS $$
DECLARE j research_jobs; c research_checkpoints;
BEGIN
 UPDATE research_jobs SET status='failed',error_code='attempts_exhausted',updated_at=now()
 WHERE workspace_id='51435300-0000-4000-8000-000000000001' AND attempts>=5
 AND status='running' AND lease_expires_at<=now();
 UPDATE research_runs run SET status='incomplete',finished_at=now(),updated_at=now()
 WHERE run.workspace_id='51435300-0000-4000-8000-000000000001' AND run.status IN ('queued','running')
 AND EXISTS(SELECT 1 FROM research_jobs job WHERE job.run_id=run.id AND job.status='failed' AND job.error_code='attempts_exhausted')
 AND NOT EXISTS(SELECT 1 FROM research_jobs job WHERE job.run_id=run.id AND job.status IN ('queued','running','retry'));
 SELECT q.* INTO j FROM research_jobs q
 JOIN research_sources s ON s.id=q.source_id AND s.workspace_id=q.workspace_id
 JOIN research_rights r ON r.id=s.rights_id AND r.workspace_id=s.workspace_id
 JOIN research_runs run ON run.id=q.run_id AND run.workspace_id=q.workspace_id
 WHERE q.workspace_id='51435300-0000-4000-8000-000000000001' AND q.cancelled_at IS NULL AND q.attempts<5
 AND s.status='ready' AND r.effective_at<=now() AND (r.expires_at IS NULL OR r.expires_at>now())
 AND run.status IN ('queued','running')
 AND ((q.status IN ('queued','retry') AND q.next_attempt_at<=now()) OR (q.status='running' AND q.lease_expires_at<=now()))
 ORDER BY (run.investigation_id IS NULL),CASE WHEN q.scope_key='scheduled-metadata' THEN 2 WHEN q.scope_key='scheduled-reconcile' THEN 1 ELSE 0 END,q.next_attempt_at,q.id FOR UPDATE OF q SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE research_jobs SET status='running',lease_owner=p_owner,lease_token=lease_token+1,
 lease_expires_at=now()+interval '120 seconds',attempts=attempts+1,updated_at=now() WHERE id=j.id RETURNING * INTO j;
 SELECT * INTO c FROM research_checkpoints WHERE workspace_id=j.workspace_id AND source_id=j.source_id AND scope_key=j.scope_key;
 IF NOT FOUND THEN RAISE EXCEPTION 'checkpoint_missing'; END IF;
 RETURN NEXT to_jsonb(j)||jsonb_build_object('revision',c.revision);
END $$;

CREATE FUNCTION research_commit_page(p_job uuid,p_token bigint,p_revision bigint,p_records jsonb,p_cursor text,p_coverage jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE j research_jobs; c research_checkpoints; src research_sources; r jsonb; p jsonb; doc research_documents; v uuid; old_v uuid; old_time timestamptz; prior jsonb; cov jsonb; terminal boolean; coverage_notes jsonb; coverage_note_count bigint; canonical_metadata jsonb; acquisition_metadata jsonb; scopes_coverage jsonb; source_coverage jsonb;
BEGIN
 SELECT * INTO j FROM research_jobs WHERE id=p_job AND workspace_id='51435300-0000-4000-8000-000000000001';
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO src FROM research_sources WHERE id=j.source_id AND workspace_id=j.workspace_id FOR UPDATE;
 IF src.status<>'ready' OR NOT EXISTS(SELECT 1 FROM research_rights WHERE id=src.rights_id AND workspace_id=j.workspace_id AND effective_at<=now() AND (expires_at IS NULL OR expires_at>now())) THEN RETURN false; END IF;
 PERFORM 1 FROM research_runs WHERE id=j.run_id AND workspace_id=j.workspace_id AND status IN ('queued','running') FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO j FROM research_jobs WHERE id=p_job FOR UPDATE;
 IF j.status<>'running' OR j.cancelled_at IS NOT NULL OR j.lease_token<>p_token OR j.lease_expires_at IS NULL OR j.lease_expires_at<=now() THEN RETURN false; END IF;
 SELECT * INTO c FROM research_checkpoints WHERE workspace_id=j.workspace_id AND source_id=j.source_id AND scope_key=j.scope_key FOR UPDATE;
 IF NOT FOUND OR c.revision<>p_revision THEN RETURN false; END IF;
 IF jsonb_typeof(p_records) IS DISTINCT FROM 'array' OR jsonb_typeof(p_coverage->'complete') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_coverage->'notes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_page'; END IF;
 SELECT coverage->j.source_id::text->'scopes'->j.scope_key INTO prior FROM research_runs WHERE id=j.run_id;
 SELECT count(*) INTO coverage_note_count FROM(SELECT DISTINCT value FROM jsonb_array_elements_text(coalesce(prior->'notes','[]'::jsonb)||(p_coverage->'notes'))) notes;
 SELECT coalesce(jsonb_agg(note ORDER BY note),'[]'::jsonb) INTO coverage_notes FROM(SELECT DISTINCT left(value,1000) AS note FROM jsonb_array_elements_text(coalesce(prior->'notes','[]'::jsonb)||(p_coverage->'notes')) ORDER BY note LIMIT 50) notes;
 cov:=jsonb_build_object('complete',coalesce((prior->>'complete')::boolean,true) AND (p_coverage->>'complete')::boolean,'notes',coverage_notes,'notesTruncated',coalesce((prior->>'notesTruncated')::boolean,false) OR coverage_note_count>50);
 terminal:=p_cursor IS NULL AND (cov->>'complete')::boolean;
 FOR r IN SELECT value FROM jsonb_array_elements(p_records) LOOP
  IF (r->>'sourceId')::uuid IS DISTINCT FROM j.source_id THEN RAISE EXCEPTION 'source_mismatch'; END IF;
  IF nullif(r->>'providerId','') IS NULL OR nullif(r->>'parserVersion','') IS NULL OR (r->>'url' NOT LIKE 'https://%' AND NOT (r->'metadata'->>'import'='true' AND r->>'url'='research-object:'||(r->'metadata'->>'sourceObjectKey') AND EXISTS(SELECT 1 FROM research_staged_objects original WHERE original.object_key=r->'metadata'->>'sourceObjectKey' AND original.source_id=j.source_id AND original.workspace_id=j.workspace_id))) OR jsonb_typeof(r->'metadata') IS DISTINCT FROM 'object' OR jsonb_typeof(r->'passages') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_record'; END IF;
  PERFORM 1 FROM research_staged_objects WHERE object_key=r->>'objectKey' AND workspace_id=j.workspace_id AND source_id=j.source_id AND sha256=r->>'hash' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unregistered_object'; END IF;
  INSERT INTO research_documents(workspace_id,source_id,provider_id,canonical_url,availability_checked_at)
  VALUES(j.workspace_id,j.source_id,r->>'providerId',r->>'url',now()) ON CONFLICT(workspace_id,source_id,provider_id) DO NOTHING;
  SELECT * INTO doc FROM research_documents WHERE workspace_id=j.workspace_id AND source_id=j.source_id AND provider_id=r->>'providerId' FOR UPDATE;
  UPDATE research_documents SET availability_checked_at=now() WHERE id=doc.id;
  IF r->'metadata'->>'withdrawn'='true' OR r->'metadata'->>'availability'='withdrawn' THEN
   PERFORM research_withdraw(doc.id,CASE WHEN r->'metadata'->>'httpStatus'='404' THEN 'publisher_absent_pending_reconciliation' ELSE 'publisher_gone' END);
   IF r->'metadata'->>'httpStatus'='404' THEN UPDATE research_documents SET status='unavailable' WHERE id=doc.id; END IF;
   CONTINUE;
  END IF;
  IF doc.status IN ('withdrawn','unavailable') THEN
   IF NOT EXISTS(SELECT 1 FROM research_reviews WHERE workspace_id=j.workspace_id AND target=doc.id AND action='reinstate' AND created_at>doc.updated_at) THEN
    INSERT INTO research_reviews(workspace_id,actor,action,target,reason,"references")
    SELECT j.workspace_id,'research-worker','restoration_pending',doc.id,'Publisher record returned; director reinstatement review required',jsonb_build_object('hash',r->>'hash','sourceUrl',r->>'url')
    WHERE NOT EXISTS(SELECT 1 FROM research_reviews WHERE workspace_id=j.workspace_id AND target=doc.id AND action='restoration_pending' AND "references"->>'hash'=r->>'hash' AND created_at>doc.updated_at);
    cov:=jsonb_set(cov,'{complete}','false'::jsonb);terminal:=false;
    CONTINUE;
   END IF;
   r:=jsonb_set(r,'{metadata}',(r->'metadata')-'requiresRestorationReview'-'availability');
  END IF;
  canonical_metadata:=(r->'metadata')-ARRAY['provider','snapshotHash','sourceObjectKey','rowNumber','partIndex','partCount','snapshotId','row','import','scanOrder','reconciliation','httpStatus','absenceReason','publicationUrl','entryId','parserVersion','performanceSchemaValidated','withdrawn','availability','requiresRestorationReview']::text[];
  SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb)||jsonb_build_object('retrievedAt',r->>'retrievedAt') INTO acquisition_metadata FROM jsonb_each(r->'metadata') WHERE key=ANY(ARRAY['provider','snapshotHash','sourceObjectKey','rowNumber','partIndex','partCount','snapshotId','row','import','scanOrder','reconciliation','httpStatus','absenceReason','publicationUrl','entryId','parserVersion','performanceSchemaValidated','withdrawn','availability','requiresRestorationReview']::text[]);
  old_v:=doc.current_version_id;
  SELECT source_updated_at INTO old_time FROM research_versions WHERE id=old_v;
  IF old_time IS NOT NULL AND (r->>'updatedAt')::timestamptz<old_time THEN CONTINUE; END IF;
  IF (old_time IS NULL OR (r->>'updatedAt')::timestamptz IS NULL OR old_time=(r->>'updatedAt')::timestamptz)
   AND EXISTS(SELECT 1 FROM research_versions WHERE id=old_v AND retrieved_at>(r->>'retrievedAt')::timestamptz) THEN CONTINUE; END IF;
  IF src.provider='payment-practices' AND EXISTS(SELECT 1 FROM research_versions previous JOIN research_run_documents observed ON observed.version_id=previous.id WHERE previous.document_id=doc.id AND observed.metadata->>'snapshotHash' IS NOT NULL AND observed.metadata->>'snapshotHash'=r->'metadata'->>'snapshotHash' AND previous.hash<>r->>'hash') THEN RAISE EXCEPTION 'duplicate_report_in_snapshot'; END IF;
  v:=NULL;
  SELECT id INTO v FROM research_versions WHERE id=old_v AND availability='available'
   AND hash=r->>'hash' AND parser_version=r->>'parserVersion' AND metadata=canonical_metadata
   AND source_updated_at IS NOT DISTINCT FROM (r->>'updatedAt')::timestamptz
   AND published_at IS NOT DISTINCT FROM (r->>'publishedAt')::timestamptz
   AND event_at IS NOT DISTINCT FROM (r->>'eventAt')::timestamptz AND content_type=r->>'contentType'
   AND doc.canonical_url=r->>'url';
  IF v IS NULL THEN
   INSERT INTO research_versions(workspace_id,document_id,hash,source_updated_at,retrieved_at,event_at,published_at,object_key,content_type,parser_version,metadata)
   VALUES(j.workspace_id,doc.id,r->>'hash',(r->>'updatedAt')::timestamptz,(r->>'retrievedAt')::timestamptz,(r->>'eventAt')::timestamptz,(r->>'publishedAt')::timestamptz,r->>'objectKey',r->>'contentType',r->>'parserVersion',canonical_metadata) RETURNING id INTO v;
   UPDATE research_staged_objects SET claimed_at=now(),updated_at=now() WHERE object_key=r->>'objectKey';
  ELSE
   UPDATE research_versions SET retrieved_at=greatest(retrieved_at,(r->>'retrievedAt')::timestamptz),updated_at=now() WHERE id=v;
  END IF;
  IF old_v IS DISTINCT FROM v AND old_v IS NOT NULL THEN
   UPDATE research_versions SET availability='superseded',metadata='{}',updated_at=now() WHERE id=old_v;
   UPDATE research_passages SET text='',updated_at=now() WHERE version_id=old_v;
   INSERT INTO research_invalidations(workspace_id,document_id,version_id,reason) VALUES(j.workspace_id,doc.id,old_v,'replaced') ON CONFLICT(version_id) DO NOTHING;
  END IF;
  UPDATE research_documents SET current_version_id=v,status='available',canonical_url=r->>'url',availability_checked_at=now(),updated_at=now() WHERE id=doc.id;
  FOR p IN SELECT value FROM jsonb_array_elements(r->'passages') LOOP
   IF jsonb_typeof(p->'locator') IS DISTINCT FROM 'object' OR nullif(p->>'hash','') IS NULL OR p->>'text' IS NULL THEN RAISE EXCEPTION 'invalid_passage'; END IF;
   INSERT INTO research_passages(workspace_id,version_id,locator,text,hash) VALUES(j.workspace_id,v,p->'locator',p->>'text',p->>'hash') ON CONFLICT(version_id,hash) DO NOTHING;
  END LOOP;
  INSERT INTO research_run_documents(workspace_id,run_id,document_id,version_id,metadata) VALUES(j.workspace_id,j.run_id,doc.id,v,acquisition_metadata) ON CONFLICT(run_id,version_id) DO NOTHING;
 END LOOP;
 UPDATE research_checkpoints SET cursor=CASE WHEN p_cursor IS NULL AND NOT terminal THEN cursor ELSE p_cursor END,
 watermark_at=CASE WHEN terminal THEN greatest(watermark_at,(j.payload->'window'->>'to')::timestamptz) ELSE watermark_at END,revision=revision+1,updated_at=now() WHERE id=c.id;
 UPDATE research_jobs SET cursor=CASE WHEN p_cursor IS NULL AND NOT terminal THEN cursor ELSE p_cursor END,
 status=CASE WHEN terminal THEN 'complete' WHEN p_cursor IS NULL THEN 'incomplete' ELSE 'queued' END,
 attempts=0,lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=j.id;
 SELECT coalesce(coverage->j.source_id::text->'scopes','{}'::jsonb)||jsonb_build_object(j.scope_key,cov) INTO scopes_coverage FROM research_runs WHERE id=j.run_id;
 SELECT jsonb_build_object('complete',bool_and((value->>'complete')::boolean),'notesTruncated',bool_or(coalesce((value->>'notesTruncated')::boolean,false)),'scopes',scopes_coverage) INTO source_coverage FROM jsonb_each(scopes_coverage);
 SELECT coalesce(jsonb_agg(note ORDER BY note),'[]'::jsonb) INTO coverage_notes FROM(SELECT DISTINCT note FROM jsonb_each(scopes_coverage) scope CROSS JOIN LATERAL jsonb_array_elements_text(scope.value->'notes') note ORDER BY note LIMIT 50) notes;
 source_coverage:=source_coverage||jsonb_build_object('notes',coverage_notes);
 UPDATE research_runs SET coverage=coverage||jsonb_build_object(j.source_id::text,source_coverage),status=CASE WHEN p_cursor IS NULL AND NOT terminal THEN 'incomplete' ELSE 'running' END,started_at=coalesce(started_at,now()),updated_at=now() WHERE id=j.run_id;
 IF EXISTS(SELECT 1 FROM research_jobs WHERE run_id=j.run_id AND status IN('queued','running','retry')) THEN
  UPDATE research_runs SET status='running' WHERE id=j.run_id;
 ELSIF NOT EXISTS(SELECT 1 FROM research_jobs WHERE run_id=j.run_id AND status<>'complete') THEN
  UPDATE research_runs SET status='complete',finished_at=now(),updated_at=now() WHERE id=j.run_id;
  UPDATE research_investigations SET latest_completed_run_id=j.run_id,updated_at=now() WHERE id=(SELECT investigation_id FROM research_runs WHERE id=j.run_id);
 ELSE
  UPDATE research_runs SET status='incomplete',finished_at=now(),updated_at=now() WHERE id=j.run_id;
 END IF;
 IF terminal THEN UPDATE research_sources SET last_success_at=now(),updated_at=now() WHERE id=j.source_id; END IF;
 RETURN true;
END $$;

CREATE FUNCTION research_cancel_run(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE research_runs SET status='cancelled',finished_at=now(),updated_at=now() WHERE id=p_run AND workspace_id='51435300-0000-4000-8000-000000000001' AND status NOT IN ('complete','cancelled');
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE research_jobs SET status='cancelled',cancelled_at=now(),lease_token=lease_token+1,lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE run_id=p_run AND status NOT IN ('complete','cancelled');
END $$;

CREATE FUNCTION research_enqueue(p_source uuid,p_scope text,p_type text,p_payload jsonb,p_dedupe text,p_run uuid) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE result uuid;
BEGIN
 PERFORM 1 FROM research_sources s JOIN research_rights r ON r.id=s.rights_id AND r.workspace_id=s.workspace_id
 WHERE s.id=p_source AND s.workspace_id='51435300-0000-4000-8000-000000000001' AND s.status='ready' AND r.effective_at<=now() AND (r.expires_at IS NULL OR r.expires_at>now()) FOR UPDATE OF s;
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM 1 FROM research_runs WHERE id=p_run AND workspace_id='51435300-0000-4000-8000-000000000001' AND status IN ('queued','running') FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 INSERT INTO research_checkpoints(source_id,scope_key) VALUES(p_source,p_scope) ON CONFLICT(workspace_id,source_id,scope_key) DO NOTHING;
 INSERT INTO research_jobs(type,source_id,scope_key,run_id,dedupe_key,payload) VALUES(p_type,p_source,p_scope,p_run,p_dedupe,p_payload) ON CONFLICT DO NOTHING RETURNING id INTO result;
 RETURN result;
END $$;

CREATE FUNCTION research_reserve_request(p_source uuid,p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s research_sources; b research_budget_days; request_cap bigint; retry_ms bigint;
BEGIN
 IF EXISTS(SELECT 1 FROM research_sources WHERE id=p_source AND provider='find-case-law') THEN
  PERFORM pg_advisory_xact_lock(hashtext('qcs:research:find-case-law'));
  IF (SELECT count(*) FROM research_request_reservations q JOIN research_sources source ON source.id=q.source_id WHERE source.provider='find-case-law' AND q.workspace_id='51435300-0000-4000-8000-000000000001' AND q.reserved_at>now()-interval '300 seconds')>=1000 THEN
   SELECT greatest(1,ceil(extract(epoch FROM min(q.reserved_at)+interval '300 seconds'-now())*1000)) INTO retry_ms FROM research_request_reservations q JOIN research_sources source ON source.id=q.source_id WHERE source.provider='find-case-law' AND q.workspace_id='51435300-0000-4000-8000-000000000001' AND q.reserved_at>now()-interval '300 seconds';
   RAISE EXCEPTION 'source_rate_limit' USING DETAIL=retry_ms::text;
  END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM research_sources WHERE id=p_source AND provider='companies-house') THEN
  PERFORM pg_advisory_xact_lock(hashtext('qcs:research:companies-house'));
  PERFORM research_check_ch_window();
 END IF;
 SELECT * INTO s FROM research_sources WHERE id=p_source AND workspace_id='51435300-0000-4000-8000-000000000001' FOR UPDATE;
 IF NOT FOUND OR s.status<>'ready' THEN RAISE EXCEPTION 'source_unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM research_rights WHERE id=s.rights_id AND workspace_id=s.workspace_id AND effective_at<=now() AND (expires_at IS NULL OR expires_at>now())) THEN RAISE EXCEPTION 'rights_unavailable'; END IF;
 PERFORM 1 FROM research_runs WHERE id=p_run AND workspace_id=s.workspace_id AND status IN ('queued','running') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'run_unavailable'; END IF;
 IF (SELECT count(*) FROM research_request_reservations WHERE source_id=p_source AND reserved_at>now()-make_interval(secs=>s.window_seconds))>=s.request_limit THEN
  SELECT greatest(0,ceil(extract(epoch FROM min(reserved_at)+make_interval(secs=>s.window_seconds)-now())*1000)) INTO retry_ms FROM research_request_reservations WHERE source_id=p_source AND reserved_at>now()-make_interval(secs=>s.window_seconds);
  RAISE EXCEPTION 'source_rate_limit' USING DETAIL=retry_ms::text;
 END IF;
 SELECT (i.budget->>'maxRequests')::bigint INTO request_cap FROM research_runs r LEFT JOIN research_investigations i ON i.id=r.investigation_id WHERE r.id=p_run;
 IF request_cap IS NOT NULL AND (SELECT count(*) FROM research_request_reservations WHERE run_id=p_run)>=request_cap THEN RAISE EXCEPTION 'run_request_budget'; END IF;
 INSERT INTO research_budget_days(source_id,day) VALUES(p_source,(now() AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING;
 SELECT * INTO b FROM research_budget_days WHERE source_id=p_source AND day=(now() AT TIME ZONE 'UTC')::date FOR UPDATE;
 IF b.requests>=s.daily_requests THEN RAISE EXCEPTION 'daily_request_budget'; END IF;
 INSERT INTO research_request_reservations(source_id,run_id) VALUES(p_source,p_run);
 UPDATE research_budget_days SET requests=requests+1 WHERE source_id=p_source AND day=b.day;
END $$;

CREATE FUNCTION research_reserve_model(p_source uuid,p_run uuid,p_tokens bigint,p_pence bigint) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE s research_sources; b research_budget_days; limits jsonb; used_tokens bigint; used_pence bigint; reservation uuid;
BEGIN
 IF p_tokens IS NULL OR p_pence IS NULL OR p_tokens<0 OR p_pence<0 THEN RAISE EXCEPTION 'invalid_budget'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('qcs:research:model'));
 IF (SELECT count(*) FROM research_model_reservations WHERE workspace_id='51435300-0000-4000-8000-000000000001' AND status='reserved' AND expires_at>now())>=2 THEN RAISE EXCEPTION 'model_capacity'; END IF;
 SELECT * INTO s FROM research_sources WHERE id=p_source AND workspace_id='51435300-0000-4000-8000-000000000001' FOR UPDATE;
 IF NOT FOUND OR s.status<>'ready' THEN RAISE EXCEPTION 'source_unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM research_rights WHERE id=s.rights_id AND workspace_id=s.workspace_id AND effective_at<=now() AND (expires_at IS NULL OR expires_at>now())) THEN RAISE EXCEPTION 'rights_unavailable'; END IF;
 PERFORM 1 FROM research_runs WHERE id=p_run AND workspace_id=s.workspace_id AND status IN ('queued','running') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'run_unavailable'; END IF;
 SELECT i.budget INTO limits FROM research_runs r LEFT JOIN research_investigations i ON i.id=r.investigation_id WHERE r.id=p_run;
 SELECT coalesce(sum(coalesce(actual_tokens,tokens)),0),coalesce(sum(coalesce(actual_pence,pence)),0) INTO used_tokens,used_pence FROM research_model_reservations WHERE run_id=p_run;
 IF used_tokens+p_tokens>coalesce((limits->>'maxTokens')::bigint,s.daily_tokens) OR used_pence+p_pence>coalesce((limits->>'maxCostPence')::bigint,s.daily_pence) THEN RAISE EXCEPTION 'run_budget'; END IF;
 INSERT INTO research_budget_days(source_id,day) VALUES(p_source,(now() AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING;
 SELECT * INTO b FROM research_budget_days WHERE source_id=p_source AND day=(now() AT TIME ZONE 'UTC')::date FOR UPDATE;
 IF b.tokens+p_tokens>s.daily_tokens OR b.pence+p_pence>s.daily_pence THEN RAISE EXCEPTION 'daily_model_budget'; END IF;
 UPDATE research_budget_days SET tokens=tokens+p_tokens,pence=pence+p_pence WHERE source_id=p_source AND day=b.day;
 INSERT INTO research_model_reservations(source_id,run_id,day,tokens,pence) VALUES(p_source,p_run,b.day,p_tokens,p_pence) RETURNING id INTO reservation;
 UPDATE research_runs SET reserved_pence=reserved_pence+p_pence,updated_at=now() WHERE id=p_run;
 RETURN reservation;
END $$;

CREATE FUNCTION research_settle_model(p_id uuid,p_tokens bigint,p_pence bigint) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r research_model_reservations; tokens_used bigint; pence_used bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('qcs:research:model'));
 SELECT * INTO r FROM research_model_reservations WHERE id=p_id AND workspace_id='51435300-0000-4000-8000-000000000001' FOR UPDATE;
 IF NOT FOUND OR r.status<>'reserved' THEN RETURN; END IF;
 tokens_used:=coalesce(p_tokens,r.tokens);pence_used:=coalesce(p_pence,r.pence);
 IF tokens_used<0 OR pence_used<0 THEN RAISE EXCEPTION 'invalid_usage'; END IF;
 UPDATE research_budget_days SET tokens=tokens+tokens_used-r.tokens,pence=pence+pence_used-r.pence WHERE source_id=r.source_id AND day=r.day;
 UPDATE research_model_reservations SET actual_tokens=tokens_used,actual_pence=pence_used,status=CASE WHEN p_tokens IS NULL OR p_pence IS NULL THEN 'usage_unknown' ELSE 'settled' END,updated_at=now() WHERE id=p_id;
 UPDATE research_runs SET reserved_pence=reserved_pence-r.pence,actual_pence=actual_pence+pence_used,actual_tokens=actual_tokens+tokens_used,updated_at=now() WHERE id=r.run_id;
END $$;

CREATE FUNCTION research_dispatch(p_now timestamptz,p_validated jsonb) RETURNS TABLE(source_id uuid,job_id uuid,enqueued boolean) LANGUAGE plpgsql AS $$
DECLARE s research_sources; c research_checkpoints; new_run uuid; existing uuid; made uuid; window_from timestamptz; frozen_payload jsonb; task jsonb; tasks jsonb; created_any boolean;
BEGIN
 FOR s IN SELECT source.* FROM research_sources source JOIN research_rights r ON r.id=source.rights_id AND r.workspace_id=source.workspace_id
 WHERE source.workspace_id='51435300-0000-4000-8000-000000000001' AND source.status='ready' AND source.next_due_at<=p_now
 AND r.effective_at<=now() AND (r.expires_at IS NULL OR r.expires_at>now())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_validated) v WHERE (v->>'id')::uuid=source.id AND (v->>'updatedAt')::timestamptz=source.updated_at)
 ORDER BY source.next_due_at,source.id FOR UPDATE OF source SKIP LOCKED LIMIT 20 LOOP
  new_run:=NULL;created_any:=false;
  tasks:=jsonb_build_array(jsonb_build_object('scope','scheduled','selection',CASE WHEN s.provider='find-case-law' THEN s.selection||'{"mode":"feed","order":"-transformation"}'::jsonb ELSE s.selection END));
  IF s.provider='find-case-law' THEN tasks:=tasks||jsonb_build_array(
   jsonb_build_object('scope','scheduled-reconcile','selection',s.selection||'{"mode":"reconcile"}'::jsonb),
   jsonb_build_object('scope','scheduled-metadata','selection',s.selection||'{"mode":"feed","order":"-updated"}'::jsonb)); END IF;
  FOR task IN SELECT value FROM jsonb_array_elements(tasks) LOOP
   SELECT id INTO existing FROM research_jobs WHERE workspace_id=s.workspace_id AND research_jobs.source_id=s.id AND scope_key=task->>'scope' AND status IN ('queued','running','retry');
   IF existing IS NOT NULL THEN source_id:=s.id;job_id:=existing;enqueued:=false;RETURN NEXT;CONTINUE;END IF;
   SELECT * INTO c FROM research_checkpoints WHERE workspace_id=s.workspace_id AND research_checkpoints.source_id=s.id AND scope_key=task->>'scope';
   window_from:=CASE WHEN c.watermark_at IS NULL THEN s.backfill_start ELSE greatest(s.backfill_start,c.watermark_at-interval '1 hour') END;
   IF window_from>p_now THEN CONTINUE; END IF;
   IF new_run IS NULL THEN INSERT INTO research_runs(source_selection,versions) VALUES(jsonb_build_array(s.id),jsonb_build_object('foundation','1')) RETURNING id INTO new_run; END IF;
   frozen_payload:=jsonb_build_object('window',jsonb_build_object('from',window_from,'to',p_now),'selection',task->'selection');
   made:=research_enqueue(s.id,task->>'scope','fetch',frozen_payload,(task->>'scope')||':'||s.id::text||':'||p_now::text,new_run);
   IF made IS NULL THEN CONTINUE; END IF;
   created_any:=true;source_id:=s.id;job_id:=made;enqueued:=true;RETURN NEXT;
  END LOOP;
  IF created_any THEN UPDATE research_sources SET next_due_at=p_now+make_interval(secs=>s.cadence_seconds),updated_at=now() WHERE id=s.id;
  ELSIF new_run IS NOT NULL THEN DELETE FROM research_runs WHERE id=new_run; END IF;
 END LOOP;
END $$;

CREATE FUNCTION research_withdraw(p_document uuid,p_reason text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d research_documents;
BEGIN
 IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'reason_required'; END IF;
 SELECT * INTO d FROM research_documents WHERE id=p_document AND workspace_id='51435300-0000-4000-8000-000000000001' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'document_unavailable'; END IF;
 UPDATE research_documents SET status='withdrawn',current_version_id=NULL,updated_at=now() WHERE id=d.id;
 UPDATE research_versions SET availability='withdrawn',metadata='{}',updated_at=now() WHERE document_id=d.id;
 UPDATE research_passages SET text='',updated_at=now() WHERE version_id IN(SELECT id FROM research_versions WHERE document_id=d.id);
 INSERT INTO research_invalidations(workspace_id,document_id,version_id,reason) SELECT workspace_id,document_id,id,p_reason FROM research_versions WHERE document_id=d.id ON CONFLICT(version_id) DO NOTHING;
END $$;

CREATE FUNCTION research_terminate_source(p_source uuid,p_reason text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s research_sources; d uuid; affected uuid;
BEGIN
 SELECT * INTO s FROM research_sources WHERE id=p_source AND workspace_id='51435300-0000-4000-8000-000000000001' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'source_unavailable'; END IF;
 UPDATE research_rights SET expires_at=greatest(effective_at,now()),updated_at=now() WHERE id=s.rights_id;
 -- A rights record can govern multiple sources. Revoke every linked source atomically.
 FOR affected IN SELECT id FROM research_sources WHERE rights_id=s.rights_id LOOP
  UPDATE research_sources SET status='paused',configuration_error='rights_terminated',updated_at=now() WHERE id=affected;
  UPDATE research_runs SET status='cancelled',finished_at=now(),updated_at=now() WHERE id IN(SELECT run_id FROM research_jobs WHERE source_id=affected AND status IN('queued','running','retry'));
  UPDATE research_jobs SET status='cancelled',cancelled_at=now(),lease_token=lease_token+1,lease_expires_at=NULL,updated_at=now() WHERE source_id=affected AND status IN('queued','running','retry');
  FOR d IN SELECT id FROM research_documents WHERE source_id=affected LOOP PERFORM research_withdraw(d,p_reason); END LOOP;
 END LOOP;
END $$;

CREATE FUNCTION research_check_ch_window() RETURNS void LANGUAGE plpgsql AS $$
DECLARE requests_count bigint; retry_ms bigint;
BEGIN
 SELECT count(*),greatest(1,ceil(extract(epoch FROM min(reserved_at)+interval '300 seconds'-now())*1000)) INTO requests_count,retry_ms
 FROM (
  SELECT reserved_at FROM research_legacy_ch_requests WHERE workspace_id='51435300-0000-4000-8000-000000000001' AND reserved_at>now()-interval '300 seconds'
  UNION ALL
  SELECT q.reserved_at FROM research_request_reservations q JOIN research_sources s ON s.id=q.source_id WHERE q.workspace_id='51435300-0000-4000-8000-000000000001' AND s.provider='companies-house' AND q.reserved_at>now()-interval '300 seconds'
 ) requests;
 IF requests_count>=600 THEN RAISE EXCEPTION 'source_rate_limit' USING DETAIL=retry_ms::text; END IF;
END $$;
CREATE FUNCTION research_reserve_ch_brief() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('qcs:research:companies-house'));
 PERFORM research_check_ch_window();
 INSERT INTO research_legacy_ch_requests DEFAULT VALUES;
END $$;
