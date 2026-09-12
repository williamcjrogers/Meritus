-- QCS director workflow. Apply only after 0003_qcs_research_foundation.
CREATE TABLE research_workflow_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 actor text NOT NULL,
 request_id uuid NOT NULL,
 request_hash text NOT NULL,
 investigation_id uuid NOT NULL REFERENCES research_investigations(id),
 run_id uuid NOT NULL REFERENCES research_runs(id),
 CONSTRAINT research_workflow_requests_unique_0 UNIQUE(actor,request_id)
);
CREATE INDEX research_workflow_requests_updated ON research_workflow_requests(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_watchlists (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 label text NOT NULL,
 owner text NOT NULL,
 cadence_seconds integer NOT NULL,
 timezone text NOT NULL,
 sources jsonb NOT NULL,
 signal_preferences jsonb NOT NULL,
 enabled boolean NOT NULL,
 revision integer NOT NULL
);
CREATE INDEX research_watchlists_updated ON research_watchlists(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_watchlist_members (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 watchlist_id uuid NOT NULL REFERENCES research_watchlists(id),
 entity_id uuid NOT NULL REFERENCES research_entities(id),
 next_refresh_at timestamptz NOT NULL,
 CONSTRAINT research_watchlist_members_unique_0 UNIQUE(watchlist_id,entity_id)
);
CREATE INDEX research_watchlist_members_updated ON research_watchlist_members(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 investigation_id uuid NOT NULL REFERENCES research_investigations(id),
 entity_id uuid REFERENCES research_entities(id),
 text text NOT NULL,
 kind text NOT NULL,
 status text NOT NULL,
 availability text NOT NULL,
 quotation text,
 verified_by text,
 revision integer NOT NULL
);
CREATE INDEX research_claims_updated ON research_claims(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_claim_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 claim_id uuid NOT NULL REFERENCES research_claims(id),
 document_id uuid NOT NULL REFERENCES research_documents(id),
 version_id uuid NOT NULL REFERENCES research_versions(id),
 passage_id uuid NOT NULL REFERENCES research_passages(id),
 relation text NOT NULL,
 CONSTRAINT research_claim_evidence_unique_0 UNIQUE(claim_id,passage_id,relation)
);
CREATE INDEX research_claim_evidence_updated ON research_claim_evidence(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_signals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 investigation_id uuid NOT NULL REFERENCES research_investigations(id),
 entity_id uuid NOT NULL REFERENCES research_entities(id),
 event_key text NOT NULL,
 event_type text NOT NULL,
 kind text NOT NULL,
 occurred_at timestamptz,
 confidence double precision NOT NULL,
 half_life_days double precision NOT NULL,
 independence_confirmed boolean NOT NULL,
 scoring_version text NOT NULL,
 components jsonb NOT NULL,
 score integer NOT NULL,
 scored_at timestamptz NOT NULL,
 status text NOT NULL,
 stale boolean NOT NULL,
 review_id uuid REFERENCES research_reviews(id),
 revision integer NOT NULL
);
CREATE INDEX research_signals_updated ON research_signals(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_signal_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 signal_id uuid NOT NULL REFERENCES research_signals(id),
 claim_id uuid NOT NULL REFERENCES research_claims(id),
 CONSTRAINT research_signal_claims_unique_0 UNIQUE(signal_id,claim_id)
);
CREATE INDEX research_signal_claims_updated ON research_signal_claims(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_relationships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 subject_id uuid NOT NULL REFERENCES research_entities(id),
 predicate text NOT NULL,
 object_id uuid NOT NULL REFERENCES research_entities(id),
 evidence jsonb NOT NULL,
 valid_from timestamptz,
 valid_to timestamptz,
 confidence double precision NOT NULL,
 reviewed_by text,
 channel text NOT NULL,
 service_offer text NOT NULL,
 owner text NOT NULL,
 stage text NOT NULL,
 last_contact_at timestamptz
);
CREATE INDEX research_relationships_updated ON research_relationships(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_calendar (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 investigation_id uuid NOT NULL REFERENCES research_investigations(id),
 entity_id uuid REFERENCES research_entities(id),
 kind text NOT NULL,
 proposed_date date NOT NULL,
 evidence jsonb NOT NULL,
 jurisdiction text,
 rule text,
 accrual_basis text,
 assumptions text NOT NULL,
 reviewed_by text,
 state text NOT NULL
);
CREATE INDEX research_calendar_updated ON research_calendar(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_suppressions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 target uuid NOT NULL,
 scope text NOT NULL,
 reason text NOT NULL,
 expires_at timestamptz,
 actor text NOT NULL,
 revoked_at timestamptz
);
CREATE INDEX research_suppressions_updated ON research_suppressions(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 investigation_id uuid NOT NULL REFERENCES research_investigations(id),
 run_id uuid NOT NULL REFERENCES research_runs(id),
 audience text NOT NULL,
 status text NOT NULL,
 findings jsonb NOT NULL,
 coverage jsonb NOT NULL,
 methodology text NOT NULL,
 object_key text,
 reviewer text
);
CREATE INDEX research_reports_updated ON research_reports(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_report_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 report_id uuid NOT NULL REFERENCES research_reports(id),
 document_id uuid NOT NULL REFERENCES research_documents(id),
 version_id uuid NOT NULL REFERENCES research_versions(id),
 passage_id uuid NOT NULL REFERENCES research_passages(id),
 CONSTRAINT research_report_evidence_unique_0 UNIQUE(report_id,passage_id)
);
CREATE INDEX research_report_evidence_updated ON research_report_evidence(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 investigation_id uuid NOT NULL REFERENCES research_investigations(id),
 run_id uuid NOT NULL REFERENCES research_runs(id),
 actor text NOT NULL,
 question text NOT NULL,
 answer jsonb NOT NULL,
 evidence jsonb NOT NULL,
 status text NOT NULL,
 model_id text NOT NULL,
 prompt_version text NOT NULL
);
CREATE INDEX research_conversations_updated ON research_conversations(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_conversions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 signal_id uuid NOT NULL REFERENCES research_signals(id),
 pursuit_id text NOT NULL REFERENCES pursuits(id),
 review_id uuid NOT NULL REFERENCES research_reviews(id),
 created_by text NOT NULL,
 summary_hash text NOT NULL,
 needs_review boolean NOT NULL,
 CONSTRAINT research_conversions_unique_0 UNIQUE(signal_id),
 CONSTRAINT research_conversions_unique_1 UNIQUE(pursuit_id)
);
CREATE INDEX research_conversions_updated ON research_conversions(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_conversion_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 conversion_id uuid NOT NULL REFERENCES research_conversions(id),
 version_id uuid NOT NULL REFERENCES research_versions(id),
 CONSTRAINT research_conversion_evidence_unique_0 UNIQUE(conversion_id,version_id)
);
CREATE INDEX research_conversion_evidence_updated ON research_conversion_evidence(workspace_id,updated_at);
--> statement-breakpoint
CREATE TABLE research_outcomes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 signal_id uuid NOT NULL REFERENCES research_signals(id),
 pursuit_id text NOT NULL REFERENCES pursuits(id),
 kind text NOT NULL,
 occurred_at timestamptz NOT NULL,
 actor text NOT NULL,
 CONSTRAINT research_outcomes_unique_0 UNIQUE(signal_id,kind)
);
CREATE INDEX research_outcomes_updated ON research_outcomes(workspace_id,updated_at);
--> statement-breakpoint
CREATE VIEW research_available_passages AS
SELECT p.id AS passage_id,v.id AS version_id,d.id AS document_id,s.id AS source_id,p.text,p.locator,d.canonical_url AS url,coalesce(v.metadata->>'title',d.provider_id) AS title,v.retrieved_at,v.published_at,v.event_at,s.attribution,p.workspace_id
FROM research_passages p JOIN research_versions v ON v.id=p.version_id JOIN research_documents d ON d.current_version_id=v.id JOIN research_sources s ON s.id=d.source_id JOIN research_rights r ON r.id=s.rights_id
WHERE d.status='available' AND v.availability='available' AND p.text<>'' AND p.workspace_id=d.workspace_id AND d.workspace_id=s.workspace_id AND r.effective_at<=now() AND (r.expires_at IS NULL OR r.expires_at>now());
--> statement-breakpoint
CREATE FUNCTION research_assert_evidence(refs jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE e jsonb;
BEGIN
 PERFORM 1 FROM research_documents WHERE id IN(SELECT (value->>'documentId')::uuid FROM jsonb_array_elements(refs)) ORDER BY id FOR SHARE;
 FOR e IN SELECT value FROM jsonb_array_elements(refs) LOOP
  IF NOT EXISTS(SELECT 1 FROM research_available_passages WHERE workspace_id='51435300-0000-4000-8000-000000000001' AND document_id=(e->>'documentId')::uuid AND version_id=(e->>'versionId')::uuid AND passage_id=(e->>'passageId')::uuid) THEN RAISE EXCEPTION 'evidence_unavailable'; END IF;
 END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION research_commission(p_actor text,p_request uuid,p_hash text,p_question text,p_scope jsonb,p_budget jsonb,p_payloads jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE prior research_workflow_requests; investigation uuid; run uuid; sid uuid; s research_sources; available boolean; cov jsonb:='{}'; source_count integer:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor||':'||p_request::text,0));
 SELECT * INTO prior FROM research_workflow_requests WHERE actor=p_actor AND request_id=p_request;
 IF FOUND THEN IF prior.request_hash<>p_hash THEN RAISE EXCEPTION 'idempotency_conflict'; END IF; RETURN jsonb_build_object('investigationId',prior.investigation_id,'runId',prior.run_id); END IF;
 INSERT INTO research_investigations(question,scope,owner,status,budget) VALUES(p_question,p_scope,p_actor,'active',p_budget) RETURNING id INTO investigation;
 INSERT INTO research_runs(investigation_id,source_selection,status,versions) VALUES(investigation,p_scope->'sources','queued','{"workflow":"qcs_workflow_v1"}') RETURNING id INTO run;
 FOR sid IN SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(p_scope->'sources') LOOP
  SELECT * INTO s FROM research_sources WHERE id=sid AND workspace_id='51435300-0000-4000-8000-000000000001';
  IF NOT FOUND THEN RAISE EXCEPTION 'source_not_found'; END IF;
  available:=s.status='ready' AND EXISTS(SELECT 1 FROM research_rights WHERE id=s.rights_id AND effective_at<=now() AND (expires_at IS NULL OR expires_at>now()));
  INSERT INTO research_checkpoints(source_id,scope_key) VALUES(sid,investigation::text) ON CONFLICT DO NOTHING;
  INSERT INTO research_jobs(type,source_id,scope_key,run_id,dedupe_key,payload,status,error_code) VALUES('fetch',sid,investigation::text,run,'investigation:'||run::text||':'||sid::text,p_payloads->sid::text,CASE WHEN available THEN 'queued' ELSE 'failed' END,CASE WHEN available THEN NULL ELSE 'source_unavailable' END);
  cov:=cov||jsonb_build_object(sid::text,jsonb_build_object('complete',false,'notes',jsonb_build_array(CASE WHEN available THEN 'Queued' ELSE 'Source access unavailable' END)));
  IF available THEN source_count:=source_count+1; END IF;
 END LOOP;
 UPDATE research_runs SET coverage=cov,status=CASE WHEN source_count=0 THEN 'failed' ELSE 'queued' END WHERE id=run;
 INSERT INTO research_workflow_requests(actor,request_id,request_hash,investigation_id,run_id) VALUES(p_actor,p_request,p_hash,investigation,run);
 RETURN jsonb_build_object('investigationId',investigation,'runId',run);
END $$;
--> statement-breakpoint
CREATE FUNCTION research_add_claim(p_investigation uuid,p_entity uuid,p_finding jsonb,p_actor text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE claim uuid; ref jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM research_investigations WHERE id=p_investigation AND workspace_id='51435300-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'investigation_not_found'; END IF;
 PERFORM research_assert_evidence(p_finding->'evidence');
 IF p_finding->>'kind'<>'inference' AND jsonb_array_length(p_finding->'evidence')=0 THEN RAISE EXCEPTION 'missing_evidence'; END IF;
 INSERT INTO research_claims(investigation_id,entity_id,text,kind,status,availability,quotation,revision) VALUES(p_investigation,p_entity,p_finding->>'text',p_finding->>'kind','unverified','available',p_finding->>'quotation',0) RETURNING id INTO claim;
 FOR ref IN SELECT value FROM jsonb_array_elements(p_finding->'evidence') LOOP
  INSERT INTO research_claim_evidence(claim_id,document_id,version_id,passage_id,relation) VALUES(claim,(ref->>'documentId')::uuid,(ref->>'versionId')::uuid,(ref->>'passageId')::uuid,'supporting') ON CONFLICT DO NOTHING;
 END LOOP;
 INSERT INTO research_reviews(actor,action,target,reason,"references") VALUES(p_actor,'propose',claim,'Evidence-backed finding proposed','{}');RETURN claim;
END $$;
--> statement-breakpoint
CREATE FUNCTION research_signal_available(p_signal uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT EXISTS(SELECT 1 FROM research_signal_claims WHERE signal_id=p_signal) AND NOT EXISTS(
 SELECT 1 FROM research_signal_claims sc JOIN research_claims c ON c.id=sc.claim_id
 WHERE sc.signal_id=p_signal AND (c.availability<>'available' OR NOT EXISTS(SELECT 1 FROM research_claim_evidence e WHERE e.claim_id=c.id) OR EXISTS(
 SELECT 1 FROM research_claim_evidence e WHERE e.claim_id=c.id AND NOT EXISTS(SELECT 1 FROM research_available_passages p WHERE p.document_id=e.document_id AND p.version_id=e.version_id AND p.passage_id=e.passage_id)))
);
$$;
--> statement-breakpoint
CREATE FUNCTION research_review_signal(p_signal uuid,p_actor text,p_revision integer,p_action text,p_reason text,p_independent boolean) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE s research_signals; review uuid;
BEGIN
 SELECT * INTO s FROM research_signals WHERE id=p_signal AND workspace_id='51435300-0000-4000-8000-000000000001' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'signal_not_found'; END IF;
 IF s.revision<>p_revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 IF p_action NOT IN ('approve','dismiss','reopen') THEN RAISE EXCEPTION 'invalid_action'; END IF;
 IF p_action='approve' AND NOT research_signal_available(p_signal) THEN RAISE EXCEPTION 'evidence_unavailable'; END IF;
 INSERT INTO research_reviews(actor,action,target,reason,"references") VALUES(p_actor,p_action,p_signal,p_reason,jsonb_build_object('revision',p_revision,'independenceConfirmed',p_independent)) RETURNING id INTO review;
 UPDATE research_signals SET status=CASE p_action WHEN 'approve' THEN 'reviewed' WHEN 'dismiss' THEN 'dismissed' ELSE 'unreviewed' END,independence_confirmed=CASE WHEN p_action='approve' THEN p_independent ELSE false END,review_id=review,revision=revision+1,updated_at=now() WHERE id=p_signal;
 IF p_action='approve' THEN UPDATE research_claims SET status='verified',verified_by=p_actor,revision=revision+1,updated_at=now() WHERE id IN(SELECT claim_id FROM research_signal_claims WHERE signal_id=p_signal); END IF;
 RETURN review;
END $$;
--> statement-breakpoint
CREATE FUNCTION research_convert_signal(p_signal uuid,p_actor text,p_owner text,p_review uuid,p_exception text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE s research_signals; previous research_conversions; new_pursuit text; conversion uuid; name text; summary text; count_events integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_signal::text,0));
 SELECT * INTO s FROM research_signals WHERE id=p_signal AND workspace_id='51435300-0000-4000-8000-000000000001' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'signal_not_found'; END IF;
 IF EXISTS(SELECT 1 FROM research_suppressions WHERE target IN(s.entity_id,s.investigation_id,s.id) AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())) THEN RAISE EXCEPTION 'subject_suppressed'; END IF;
 IF s.status<>'reviewed' OR s.review_id IS DISTINCT FROM p_review OR NOT research_signal_available(p_signal) THEN RAISE EXCEPTION 'current_review_required'; END IF;
 SELECT * INTO previous FROM research_conversions WHERE signal_id=p_signal;
 IF FOUND THEN RETURN jsonb_build_object('pursuitId',previous.pursuit_id,'created',false); END IF;
 PERFORM 1 FROM research_documents d WHERE d.id IN(SELECT e.document_id FROM research_signal_claims sc JOIN research_claim_evidence e ON e.claim_id=sc.claim_id WHERE sc.signal_id=p_signal) FOR SHARE;
 IF NOT research_signal_available(p_signal) THEN RAISE EXCEPTION 'evidence_unavailable'; END IF;
 SELECT count(DISTINCT t.event_key) INTO count_events FROM research_signals t WHERE t.entity_id=s.entity_id AND t.status='reviewed' AND t.independence_confirmed AND t.kind<>'context' AND t.confidence>=0.75 AND t.occurred_at<=now() AND t.occurred_at IS NOT NULL AND (CASE t.kind WHEN 'direct' THEN 40 WHEN 'project_change' THEN 25 WHEN 'payment' THEN 15 ELSE 5 END)*t.confidence*power(2,-extract(epoch from(now()-t.occurred_at))/86400/t.half_life_days)>=5 AND NOT EXISTS(SELECT 1 FROM research_suppressions x WHERE x.target=t.id AND x.revoked_at IS NULL AND (x.expires_at IS NULL OR x.expires_at>now())) AND NOT t.stale AND research_signal_available(t.id);
 IF count_events<2 AND length(trim(coalesce(p_exception,'')))<20 THEN RAISE EXCEPTION 'single_event_reason_required'; END IF;
 SELECT display_name INTO name FROM research_entities WHERE id=s.entity_id AND confirmed;
 IF name IS NULL THEN RAISE EXCEPTION 'confirmed_entity_required'; END IF;
 SELECT string_agg(c.text,E'\n' ORDER BY c.created_at) INTO summary FROM research_claims c JOIN research_signal_claims sc ON sc.claim_id=c.id WHERE sc.signal_id=p_signal AND c.status='verified';
 IF summary IS NULL THEN RAISE EXCEPTION 'verified_claim_required'; END IF;
 new_pursuit:=gen_random_uuid()::text;
 INSERT INTO pursuits(id,firm,summary,source,source_detail,owner_id,stage,created_by) VALUES(new_pursuit,name,left(summary,4000),'other','QCS research',p_owner,'enquiry',p_actor);
 INSERT INTO research_conversions(signal_id,pursuit_id,review_id,created_by,summary_hash,needs_review) VALUES(p_signal,new_pursuit,p_review,p_actor,md5(left(summary,4000)),false) RETURNING id INTO conversion;
 INSERT INTO research_conversion_evidence(conversion_id,version_id) SELECT DISTINCT conversion,e.version_id FROM research_claim_evidence e JOIN research_signal_claims sc ON sc.claim_id=e.claim_id WHERE sc.signal_id=p_signal;
 INSERT INTO activity(id,pursuit_id,kind,actor_id,meta) VALUES(gen_random_uuid()::text,new_pursuit,'created',p_actor,jsonb_build_object('researchSignalId',p_signal,'researchInvestigationId',s.investigation_id));
 INSERT INTO research_reviews(actor,action,target,reason,"references") VALUES(p_actor,'convert',p_signal,coalesce(p_exception,'Corroborated research'),jsonb_build_object('pursuitId',new_pursuit,'reviewId',p_review));
 RETURN jsonb_build_object('pursuitId',new_pursuit,'created',true);
END $$;
--> statement-breakpoint
CREATE FUNCTION research_invalidate_workflow(p_version uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM research_conversions WHERE id IN(SELECT conversion_id FROM research_conversion_evidence WHERE version_id=p_version) FOR UPDATE;
 UPDATE research_claims SET text='',quotation=NULL,availability='unavailable',status='unverified',verified_by=NULL,revision=revision+1,updated_at=now() WHERE id IN(SELECT claim_id FROM research_claim_evidence WHERE version_id=p_version);
 UPDATE research_reports SET status='stale',findings='[]',updated_at=now() WHERE id IN(SELECT report_id FROM research_report_evidence WHERE version_id=p_version);
 UPDATE research_conversations SET answer='{"findings":[],"limitations":["Source evidence changed; regenerate this answer."]}',status='stale',updated_at=now() WHERE evidence @> jsonb_build_array(jsonb_build_object('versionId',p_version));
 UPDATE research_signals SET event_type='',event_key=id::text,stale=true,status='retracted',score=0,independence_confirmed=false,review_id=NULL,revision=revision+1,updated_at=now() WHERE id IN(SELECT sc.signal_id FROM research_signal_claims sc JOIN research_claim_evidence ce ON ce.claim_id=sc.claim_id WHERE ce.version_id=p_version);
 UPDATE pursuits p SET summary=NULL,updated_at=now() FROM research_conversions c JOIN research_conversion_evidence e ON e.conversion_id=c.id WHERE e.version_id=p_version AND p.id=c.pursuit_id ;
 UPDATE briefs SET status='failed',facts=NULL,analysis=NULL,summary=NULL,sources=NULL,error='Research source changed' WHERE pursuit_id IN(SELECT c.pursuit_id FROM research_conversions c JOIN research_conversion_evidence e ON e.conversion_id=c.id WHERE e.version_id=p_version);
 UPDATE activity SET body=NULL WHERE meta->>'researchDerived'='true' AND pursuit_id IN(SELECT c.pursuit_id FROM research_conversions c JOIN research_conversion_evidence e ON e.conversion_id=c.id WHERE e.version_id=p_version);
 DELETE FROM questions WHERE pursuit_id IN(SELECT c.pursuit_id FROM research_conversions c JOIN research_conversion_evidence e ON e.conversion_id=c.id WHERE e.version_id=p_version);
 UPDATE research_conversions SET needs_review=true,updated_at=now() WHERE id IN(SELECT conversion_id FROM research_conversion_evidence WHERE version_id=p_version);
 UPDATE research_calendar SET rule=NULL,accrual_basis=NULL,assumptions='',state='provisional',reviewed_by=NULL,updated_at=now() WHERE evidence @> jsonb_build_array(jsonb_build_object('versionId',p_version));
 UPDATE research_relationships SET predicate='',service_offer='',reviewed_by=NULL,stage='review_required',updated_at=now() WHERE evidence @> jsonb_build_array(jsonb_build_object('versionId',p_version));
END $$;
--> statement-breakpoint
CREATE FUNCTION research_pursuit_available(p_id text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT NOT EXISTS(SELECT 1 FROM research_conversions c JOIN research_conversion_evidence e ON e.conversion_id=c.id WHERE c.pursuit_id=p_id AND NOT EXISTS(
 SELECT 1 FROM research_documents d JOIN research_versions v ON v.id=d.current_version_id JOIN research_sources s ON s.id=d.source_id JOIN research_rights r ON r.id=s.rights_id
 WHERE v.id=e.version_id AND v.availability='available' AND d.status='available' AND r.effective_at<=now() AND (r.expires_at IS NULL OR r.expires_at>now())))
$$;
--> statement-breakpoint
CREATE FUNCTION research_write_pursuit_questions(p_id text,p_messages jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE m jsonb; ordinal integer:=0;
BEGIN
 PERFORM 1 FROM research_conversions WHERE pursuit_id=p_id FOR UPDATE;
 IF NOT research_pursuit_available(p_id) THEN RETURN false; END IF;
 IF jsonb_array_length(p_messages)<>2 OR p_messages->0->>'role'<>'user' OR p_messages->1->>'role'<>'assistant' THEN RAISE EXCEPTION 'invalid_question_pair'; END IF;
 FOR m IN SELECT value FROM jsonb_array_elements(p_messages) LOOP
  INSERT INTO questions(id,pursuit_id,role,content,sources,created_at) VALUES(coalesce(m->>'id',gen_random_uuid()::text),p_id,m->>'role',m->>'content',nullif(m->'sources','null'),coalesce((m->>'createdAt')::timestamptz,now()+ordinal*interval '1 millisecond'));
  ordinal:=ordinal+1;
 END LOOP;RETURN true;
END $$;
--> statement-breakpoint
CREATE FUNCTION research_complete_pursuit_brief(p_id text,p_values jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE pursuit text;
BEGIN
 SELECT pursuit_id INTO pursuit FROM briefs WHERE id=p_id;
 IF pursuit IS NULL THEN RETURN false; END IF;
 PERFORM 1 FROM research_conversions WHERE pursuit_id=pursuit FOR UPDATE;
 IF NOT research_pursuit_available(pursuit) THEN UPDATE briefs SET status='failed',error='Research source changed',facts=NULL,analysis=NULL,summary=NULL,sources=NULL WHERE id=p_id;RETURN false;END IF;
 UPDATE briefs SET status='complete',error=NULL,facts=nullif(p_values->'facts','null'),analysis=p_values->'analysis',summary=p_values->>'summary',sources=p_values->'sources' WHERE id=p_id;
 RETURN true;
END $$;
--> statement-breakpoint
CREATE FUNCTION research_write_derived_note(p_id text,p_actor text,p_body text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM research_conversions WHERE pursuit_id=p_id FOR UPDATE;
 IF NOT research_pursuit_available(p_id) THEN RETURN false; END IF;
 INSERT INTO activity(id,pursuit_id,kind,actor_id,body,meta) VALUES(gen_random_uuid()::text,p_id,'note',p_actor,p_body,'{"researchDerived":true}');RETURN true;
END $$;

--> statement-breakpoint
CREATE FUNCTION research_store_answer(p_investigation uuid,p_run uuid,p_actor text,p_question text,p_answer jsonb,p_evidence jsonb,p_model text,p_prompt text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE answer_id uuid;
BEGIN
 PERFORM 1 FROM research_runs WHERE id=p_run AND investigation_id=p_investigation AND status='running' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'run_not_running'; END IF;
 PERFORM research_assert_evidence(p_evidence);
 INSERT INTO research_conversations(investigation_id,run_id,actor,question,answer,evidence,status,model_id,prompt_version) VALUES(p_investigation,p_run,p_actor,p_question,p_answer,p_evidence,'proposed',p_model,p_prompt) RETURNING id INTO answer_id;
 RETURN answer_id;
END $$;

--> statement-breakpoint
CREATE FUNCTION research_suppress_subject(p_target uuid,p_scope text,p_reason text,p_expires timestamptz,p_actor text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE suppression uuid; run uuid;
BEGIN
 INSERT INTO research_suppressions(target,scope,reason,expires_at,actor) VALUES(p_target,p_scope,p_reason,p_expires,p_actor) RETURNING id INTO suppression;
 FOR run IN SELECT r.id FROM research_runs r JOIN research_investigations i ON i.id=r.investigation_id WHERE i.workspace_id='51435300-0000-4000-8000-000000000001' AND (i.id=p_target OR i.scope->>'entityId'=p_target::text OR i.id IN(SELECT investigation_id FROM research_signals WHERE id=p_target)) AND r.status NOT IN('complete','cancelled') LOOP
  PERFORM research_cancel_run(run);
 END LOOP;
 UPDATE research_signals SET score=0,updated_at=now() WHERE id=p_target OR entity_id=p_target OR investigation_id=p_target;
 INSERT INTO research_reviews(actor,action,target,reason,"references") VALUES(p_actor,'suppress',p_target,p_reason,jsonb_build_object('suppressionId',suppression));
 RETURN suppression;
END $$;

--> statement-breakpoint
CREATE FUNCTION research_delete_watchlist(p_id uuid,p_actor text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE run uuid;
BEGIN
 PERFORM 1 FROM research_watchlists WHERE id=p_id AND workspace_id='51435300-0000-4000-8000-000000000001' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'watchlist_not_found'; END IF;
 FOR run IN SELECT DISTINCT run_id FROM research_jobs WHERE payload->>'watchlistId'=p_id::text AND status IN('queued','running','retry') LOOP PERFORM research_cancel_run(run); END LOOP;
 DELETE FROM research_watchlist_members WHERE watchlist_id=p_id;
 DELETE FROM research_watchlists WHERE id=p_id;
 INSERT INTO research_reviews(actor,action,target,reason,"references") VALUES(p_actor,'watchlist_deleted',p_id,'Director deleted monitoring configuration','{}');
END $$;

--> statement-breakpoint
CREATE FUNCTION research_prune_watchlist(p_id uuid,p_entities jsonb,p_sources jsonb,p_enabled boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE run uuid;
BEGIN
 FOR run IN SELECT DISTINCT j.run_id FROM research_jobs j WHERE j.payload->>'watchlistId'=p_id::text AND j.status IN('queued','running','retry') AND (NOT p_enabled OR j.source_id NOT IN(SELECT value::uuid FROM jsonb_array_elements_text(p_sources)) OR j.payload->>'watchlistMemberId' IN(SELECT m.id::text FROM research_watchlist_members m WHERE m.watchlist_id=p_id AND m.entity_id NOT IN(SELECT value::uuid FROM jsonb_array_elements_text(p_entities)))) LOOP PERFORM research_cancel_run(run); END LOOP;
 DELETE FROM research_watchlist_members WHERE watchlist_id=p_id AND entity_id NOT IN(SELECT value::uuid FROM jsonb_array_elements_text(p_entities));
END $$;
