-- Automatic research questions keep only lifecycle state and pointers. Answer text
-- remains in research_conversations so the existing withdrawal path applies.
CREATE TABLE research_quick_questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 owner text NOT NULL,request_id uuid NOT NULL,input_hash text NOT NULL,question text NOT NULL,
 monitoring boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','complete','failed')),
 investigation_id uuid NOT NULL REFERENCES research_investigations(id),
 run_id uuid NOT NULL REFERENCES research_runs(id),
 answer_id uuid REFERENCES research_conversations(id),last_evidence_hash text,
 lease_token bigint NOT NULL DEFAULT 0,lease_expires_at timestamptz,
 attempts integer NOT NULL DEFAULT 0,cycle_daily boolean NOT NULL DEFAULT false,
 last_checked_at timestamptz,next_check_at timestamptz,error text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT research_quick_request UNIQUE(workspace_id,owner,request_id),
 CHECK(length(trim(question)) BETWEEN 5 AND 2000),CHECK(lease_token>=0 AND attempts>=0)
);
CREATE INDEX research_quick_due ON research_quick_questions(workspace_id,status,next_check_at,lease_expires_at);
CREATE INDEX research_quick_owner ON research_quick_questions(workspace_id,owner,created_at);
--> statement-breakpoint
-- Permission and suppression checks are shared by selection, completion and reads.
-- A paused collector is excluded from this automated workflow without changing
-- the existing manual research policy for already-collected material.
CREATE VIEW research_quick_available_passages AS
SELECT p.* FROM research_available_passages p
JOIN research_sources source ON source.id=p.source_id AND source.workspace_id=p.workspace_id
JOIN research_rights rights ON rights.id=source.rights_id AND rights.workspace_id=p.workspace_id
JOIN research_versions version ON version.id=p.version_id AND version.workspace_id=p.workspace_id
WHERE p.workspace_id='51435300-0000-4000-8000-000000000001' AND source.status='ready'
AND NOT EXISTS(
 SELECT 1 FROM research_suppressions s WHERE s.workspace_id=p.workspace_id
 AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now())
 AND (s.target IN(p.document_id,p.version_id,p.passage_id,p.source_id)
 OR EXISTS(SELECT 1 FROM research_claim_evidence ce JOIN research_claims c ON c.id=ce.claim_id
 LEFT JOIN research_signal_claims sc ON sc.claim_id=c.id
 WHERE ce.document_id=p.document_id AND ce.workspace_id=p.workspace_id
 AND s.target IN(c.id,c.entity_id,c.investigation_id,sc.signal_id))
 OR EXISTS(SELECT 1 FROM research_identifier_evidence ie JOIN research_identifiers i ON i.id=ie.identifier_id
 WHERE ie.document_id=p.document_id AND ie.workspace_id=p.workspace_id AND s.target=i.entity_id))
);
--> statement-breakpoint
CREATE FUNCTION research_quick_assert_evidence(refs jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF jsonb_typeof(refs) IS DISTINCT FROM 'array' OR jsonb_array_length(refs)>12 THEN RAISE EXCEPTION 'invalid_quick_evidence'; END IF;
 -- Lock rights and source permissions before validating, as well as documents.
 PERFORM 1 FROM research_sources WHERE id IN(SELECT d.source_id FROM research_documents d WHERE d.id IN(SELECT (value->>'documentId')::uuid FROM jsonb_array_elements(refs))) ORDER BY id FOR SHARE;
 PERFORM 1 FROM research_rights WHERE id IN(SELECT s.rights_id FROM research_sources s JOIN research_documents d ON d.source_id=s.id WHERE d.id IN(SELECT (value->>'documentId')::uuid FROM jsonb_array_elements(refs))) ORDER BY id FOR SHARE;
 LOCK TABLE research_suppressions IN SHARE MODE;
 PERFORM research_assert_evidence(refs);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(refs) e WHERE NOT EXISTS(
 SELECT 1 FROM research_quick_available_passages p WHERE p.document_id=(e->>'documentId')::uuid AND p.version_id=(e->>'versionId')::uuid AND p.passage_id=(e->>'passageId')::uuid)) THEN RAISE EXCEPTION 'evidence_unavailable'; END IF;
END $$;
--> statement-breakpoint
CREATE FUNCTION research_quick_answer_current(p_answer uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM research_conversations c WHERE c.id=p_answer
 AND c.workspace_id='51435300-0000-4000-8000-000000000001' AND c.status='proposed'
 AND NOT EXISTS(SELECT 1 FROM research_suppressions s WHERE s.workspace_id=c.workspace_id AND s.target=c.investigation_id AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now()))
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c.evidence) e WHERE NOT EXISTS(
 SELECT 1 FROM research_quick_available_passages p WHERE p.document_id=(e->>'documentId')::uuid AND p.version_id=(e->>'versionId')::uuid AND p.passage_id=(e->>'passageId')::uuid)))
$$;
--> statement-breakpoint
CREATE FUNCTION research_quick_enqueue(p_actor text,p_request uuid,p_hash text,p_question text,p_monitoring boolean) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE prior research_quick_questions; investigation uuid; run uuid; result uuid;
BEGIN
 IF nullif(trim(p_actor),'') IS NULL OR length(trim(p_actor))>200 OR length(trim(p_question)) NOT BETWEEN 5 AND 2000 OR p_request IS NULL OR p_hash IS NULL OR p_monitoring IS NULL THEN RAISE EXCEPTION 'invalid_quick_question'; END IF;
 -- A workspace lock serialises quota checks as well as idempotent creation.
 PERFORM pg_advisory_xact_lock(hashtextextended('qcs:quick:queue',0));
 SELECT * INTO prior FROM research_quick_questions WHERE workspace_id='51435300-0000-4000-8000-000000000001' AND owner=p_actor AND request_id=p_request;
 IF FOUND THEN
  IF prior.input_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
  RETURN jsonb_build_object('id',prior.id,'status',prior.status);
 END IF;
 IF (SELECT count(*) FROM research_quick_questions WHERE workspace_id='51435300-0000-4000-8000-000000000001' AND status IN('queued','running'))>=50 THEN RAISE EXCEPTION 'research_queue_full'; END IF;
 IF p_monitoring AND (SELECT count(*) FROM research_quick_questions WHERE workspace_id='51435300-0000-4000-8000-000000000001' AND monitoring)>=20 THEN RAISE EXCEPTION 'research_monitor_limit'; END IF;
 INSERT INTO research_investigations(question,scope,owner,status,budget)
 VALUES(trim(p_question),jsonb_build_object('kind','sector','subject',trim(p_question),'entityId',NULL,'jurisdiction','United Kingdom','from',NULL,'to',NULL,'sources','[]'::jsonb),p_actor,'active','{"maxRequests":0,"maxTokens":30000,"maxCostPence":200}') RETURNING id INTO investigation;
 INSERT INTO research_runs(investigation_id,source_selection,status,versions)
 VALUES(investigation,'[]','queued','{"quickResearch":"1"}') RETURNING id INTO run;
 INSERT INTO research_quick_questions(owner,request_id,input_hash,question,monitoring,investigation_id,run_id)
 VALUES(p_actor,p_request,p_hash,trim(p_question),p_monitoring,investigation,run) RETURNING id INTO result;
 RETURN jsonb_build_object('id',result,'status','queued');
END $$;
--> statement-breakpoint
CREATE FUNCTION research_quick_monitor(p_actor text,p_id uuid,p_monitoring boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE q research_quick_questions;
BEGIN
 IF p_monitoring IS NULL THEN RAISE EXCEPTION 'invalid_monitoring'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('qcs:quick:queue',0));
 SELECT * INTO q FROM research_quick_questions WHERE id=p_id AND workspace_id='51435300-0000-4000-8000-000000000001' AND owner=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'question_not_found'; END IF;
 IF q.monitoring=p_monitoring THEN RETURN; END IF;
 IF p_monitoring AND (SELECT count(*) FROM research_quick_questions WHERE workspace_id=q.workspace_id AND monitoring)>=20 THEN RAISE EXCEPTION 'research_monitor_limit'; END IF;
 IF NOT p_monitoring AND q.cycle_daily AND q.status='running' THEN
  UPDATE research_runs SET status='cancelled',finished_at=now(),updated_at=now() WHERE id=q.run_id AND workspace_id=q.workspace_id;
  UPDATE research_quick_questions SET lease_token=lease_token+1,lease_expires_at=NULL,status=CASE WHEN answer_id IS NULL THEN 'failed' ELSE 'complete' END,error=CASE WHEN answer_id IS NULL THEN 'Daily research stopped.' ELSE NULL END WHERE id=q.id;
 END IF;
 UPDATE research_quick_questions SET monitoring=p_monitoring,next_check_at=CASE WHEN p_monitoring AND status IN('complete','failed') THEN now()+interval '24 hours' ELSE NULL END,updated_at=now() WHERE id=q.id;
 INSERT INTO research_reviews(actor,action,target,reason,"references") VALUES(p_actor,CASE WHEN p_monitoring THEN 'desk_monitor_start' ELSE 'desk_monitor_stop' END,q.id,'Director changed daily research','{}');
END $$;
--> statement-breakpoint
CREATE FUNCTION research_quick_lease() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE q research_quick_questions; fresh_run uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('qcs:quick:queue',0));
 UPDATE research_quick_questions cancelled SET status='failed',monitoring=false,error='Research was cancelled.',lease_token=lease_token+1,lease_expires_at=NULL,next_check_at=NULL,updated_at=now()
 FROM research_runs r WHERE cancelled.run_id=r.id AND cancelled.workspace_id='51435300-0000-4000-8000-000000000001' AND cancelled.status IN('queued','running') AND r.status='cancelled';
 -- Exhausted crashes never silently reset the cycle budget or retry forever.
 FOR q IN SELECT * FROM research_quick_questions WHERE workspace_id='51435300-0000-4000-8000-000000000001' AND status='running' AND lease_expires_at<=now() AND attempts>=3 FOR UPDATE SKIP LOCKED LOOP
  UPDATE research_runs SET status='failed',finished_at=now(),error_summary='Research worker did not finish.',updated_at=now() WHERE id=q.run_id;
  UPDATE research_quick_questions SET status='failed',error='Research did not finish. Please try again.',lease_token=lease_token+1,lease_expires_at=NULL,last_checked_at=now(),next_check_at=CASE WHEN monitoring THEN now()+interval '24 hours' ELSE NULL END,updated_at=now() WHERE id=q.id;
 END LOOP;
 SELECT * INTO q FROM research_quick_questions question WHERE workspace_id='51435300-0000-4000-8000-000000000001'
 AND (status='queued' OR (status='running' AND lease_expires_at<=now() AND attempts<3) OR (monitoring AND status IN('complete','failed') AND next_check_at<=now() AND (SELECT count(*) FROM research_quick_questions pending WHERE pending.workspace_id=question.workspace_id AND pending.status IN('queued','running'))<50))
 AND NOT EXISTS(SELECT 1 FROM research_suppressions s WHERE s.workspace_id=question.workspace_id AND s.target IN(question.id,question.investigation_id) AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now()))
 ORDER BY coalesce(next_check_at,created_at),id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF q.status IN('complete','failed') THEN
  INSERT INTO research_runs(investigation_id,source_selection,status,versions)
  VALUES(q.investigation_id,'[]','queued','{"quickResearch":"1"}') RETURNING id INTO fresh_run;
  q.run_id:=fresh_run;q.attempts:=0;q.cycle_daily:=true;
 END IF;
 UPDATE research_quick_questions SET run_id=q.run_id,status='running',lease_token=lease_token+1,lease_expires_at=now()+interval '10 minutes',attempts=q.attempts+1,cycle_daily=q.cycle_daily,error=NULL,next_check_at=NULL,updated_at=now() WHERE id=q.id RETURNING * INTO q;
 UPDATE research_runs SET status='running',started_at=coalesce(started_at,now()),updated_at=now() WHERE id=q.run_id AND workspace_id=q.workspace_id;
 RETURN jsonb_build_object('id',q.id,'leaseToken',q.lease_token,'owner',q.owner,'question',q.question,'investigationId',q.investigation_id,'runId',q.run_id,'monitoring',q.monitoring,'lastEvidenceHash',q.last_evidence_hash,'hasCurrentAnswer',research_quick_answer_current(q.answer_id));
END $$;
--> statement-breakpoint
CREATE FUNCTION research_quick_attach(p_id uuid,p_lease bigint,p_run uuid,p_evidence jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE q research_quick_questions; sources jsonb;
BEGIN
 SELECT * INTO q FROM research_quick_questions WHERE id=p_id AND workspace_id='51435300-0000-4000-8000-000000000001' AND run_id=p_run AND status='running' AND lease_token=p_lease AND lease_expires_at>now() AND EXISTS(SELECT 1 FROM research_runs active_run WHERE active_run.id=p_run AND active_run.status='running' AND active_run.workspace_id='51435300-0000-4000-8000-000000000001') FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM research_suppressions s WHERE s.workspace_id=q.workspace_id AND s.target IN(q.id,q.investigation_id) AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now())) THEN RETURN false; END IF;
 PERFORM research_quick_assert_evidence(p_evidence);
 IF EXISTS(SELECT 1 FROM research_suppressions s WHERE s.workspace_id=q.workspace_id AND s.target IN(q.id,q.investigation_id) AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now())) THEN RETURN false; END IF;
 SELECT coalesce(jsonb_agg(DISTINCT source_id),'[]') INTO sources FROM research_quick_available_passages WHERE passage_id IN(SELECT (value->>'passageId')::uuid FROM jsonb_array_elements(p_evidence));
 UPDATE research_investigations SET scope=jsonb_set(scope,'{sources}',sources),updated_at=now() WHERE id=q.investigation_id AND workspace_id=q.workspace_id;
 UPDATE research_runs SET source_selection=sources,updated_at=now() WHERE id=q.run_id AND workspace_id=q.workspace_id;
 INSERT INTO research_run_documents(run_id,document_id,version_id)
 SELECT q.run_id,(e->>'documentId')::uuid,(e->>'versionId')::uuid FROM jsonb_array_elements(p_evidence) e
 ON CONFLICT(run_id,version_id) DO NOTHING;
 RETURN true;
END $$;
--> statement-breakpoint
CREATE FUNCTION research_quick_finish(p_id uuid,p_lease bigint,p_run uuid,p_answer jsonb,p_evidence jsonb,p_hash text,p_model text,p_prompt text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE q research_quick_questions; answer uuid;
BEGIN
 SELECT * INTO q FROM research_quick_questions WHERE id=p_id AND workspace_id='51435300-0000-4000-8000-000000000001' AND run_id=p_run AND status='running' AND lease_token=p_lease AND lease_expires_at>now() AND EXISTS(SELECT 1 FROM research_runs active_run WHERE active_run.id=p_run AND active_run.status='running' AND active_run.workspace_id='51435300-0000-4000-8000-000000000001') FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM research_suppressions s WHERE s.workspace_id=q.workspace_id AND s.target IN(q.id,q.investigation_id) AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now())) THEN RETURN false; END IF;
 PERFORM research_quick_assert_evidence(p_evidence);
 IF EXISTS(SELECT 1 FROM research_suppressions s WHERE s.workspace_id=q.workspace_id AND s.target IN(q.id,q.investigation_id) AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now())) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_evidence) e WHERE NOT EXISTS(SELECT 1 FROM research_run_documents rd WHERE rd.run_id=q.run_id AND rd.document_id=(e->>'documentId')::uuid AND rd.version_id=(e->>'versionId')::uuid AND rd.workspace_id=q.workspace_id)) THEN RAISE EXCEPTION 'evidence_not_attached'; END IF;
 IF jsonb_typeof(p_answer->'findings') IS DISTINCT FROM 'array' OR jsonb_typeof(p_answer->'limitations') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_quick_answer'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_answer->'findings') finding CROSS JOIN LATERAL jsonb_array_elements(finding->'evidence') ref WHERE NOT p_evidence @> jsonb_build_array(ref)) THEN RAISE EXCEPTION 'unknown_answer_evidence'; END IF;
 answer:=research_store_answer(q.investigation_id,q.run_id,q.owner,q.question,p_answer,p_evidence,p_model,p_prompt);
 UPDATE research_runs SET status='complete',finished_at=now(),updated_at=now() WHERE id=q.run_id;
 UPDATE research_investigations SET latest_completed_run_id=q.run_id,updated_at=now() WHERE id=q.investigation_id;
 UPDATE research_quick_questions SET answer_id=answer,last_evidence_hash=p_hash,status='complete',lease_expires_at=NULL,last_checked_at=now(),next_check_at=CASE WHEN monitoring THEN now()+interval '24 hours' ELSE NULL END,error=NULL,updated_at=now() WHERE id=q.id;
 RETURN true;
END $$;
--> statement-breakpoint
CREATE FUNCTION research_quick_unchanged(p_id uuid,p_lease bigint,p_run uuid,p_hash text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE q research_quick_questions; refs jsonb;
BEGIN
 SELECT * INTO q FROM research_quick_questions WHERE id=p_id AND workspace_id='51435300-0000-4000-8000-000000000001' AND run_id=p_run AND status='running' AND lease_token=p_lease AND lease_expires_at>now() AND EXISTS(SELECT 1 FROM research_runs active_run WHERE active_run.id=p_run AND active_run.status='running' AND active_run.workspace_id='51435300-0000-4000-8000-000000000001') FOR UPDATE;
 IF NOT FOUND OR q.last_evidence_hash IS DISTINCT FROM p_hash OR NOT research_quick_answer_current(q.answer_id) THEN RETURN false; END IF;
 SELECT evidence INTO refs FROM research_conversations WHERE id=q.answer_id FOR SHARE;
 BEGIN PERFORM research_quick_assert_evidence(refs); EXCEPTION WHEN OTHERS THEN IF SQLERRM='evidence_unavailable' THEN RETURN false; ELSE RAISE; END IF; END;
 IF NOT research_quick_answer_current(q.answer_id) THEN RETURN false; END IF;
 UPDATE research_runs SET status='complete',finished_at=now(),updated_at=now() WHERE id=q.run_id;
 UPDATE research_quick_questions SET status='complete',lease_expires_at=NULL,last_checked_at=now(),next_check_at=CASE WHEN monitoring THEN now()+interval '24 hours' ELSE NULL END,error=NULL,updated_at=now() WHERE id=q.id;
 RETURN true;
END $$;
--> statement-breakpoint
CREATE FUNCTION research_quick_fail(p_id uuid,p_lease bigint,p_run uuid,p_error text,p_stop_monitoring boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
DECLARE q research_quick_questions;
BEGIN
 SELECT * INTO q FROM research_quick_questions WHERE id=p_id AND workspace_id='51435300-0000-4000-8000-000000000001' AND run_id=p_run AND status='running' AND lease_token=p_lease AND lease_expires_at>now() AND EXISTS(SELECT 1 FROM research_runs active_run WHERE active_run.id=p_run AND active_run.status='running' AND active_run.workspace_id='51435300-0000-4000-8000-000000000001') FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE research_runs SET status='failed',finished_at=now(),error_summary=left(p_error,500),updated_at=now() WHERE id=q.run_id;
 UPDATE research_quick_questions SET status='failed',monitoring=monitoring AND NOT p_stop_monitoring,lease_expires_at=NULL,last_checked_at=now(),next_check_at=CASE WHEN monitoring AND NOT p_stop_monitoring THEN now()+interval '24 hours' ELSE NULL END,error=left(p_error,500),updated_at=now() WHERE id=q.id;
END $$;
--> statement-breakpoint
CREATE FUNCTION research_quick_review(p_actor text,p_document uuid,p_action text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF nullif(trim(p_actor),'') IS NULL OR p_action NOT IN('save','dismiss','reopen') THEN RAISE EXCEPTION 'invalid_desk_review'; END IF;
 IF NOT EXISTS(SELECT 1 FROM research_quick_available_passages WHERE document_id=p_document) THEN RAISE EXCEPTION 'evidence_unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('qcs:quick:review:'||p_actor||':'||p_document::text,0));
 IF (SELECT action FROM research_reviews WHERE workspace_id='51435300-0000-4000-8000-000000000001' AND actor=p_actor AND target=p_document AND action IN('desk_save','desk_dismiss','desk_reopen') ORDER BY created_at DESC,id DESC LIMIT 1) IS NOT DISTINCT FROM 'desk_'||p_action THEN RETURN; END IF;
 INSERT INTO research_reviews(actor,action,target,reason,"references") VALUES(p_actor,'desk_'||p_action,p_document,'Director research desk selection','{}');
END $$;
--> statement-breakpoint
-- Scalar field labels are part of the searchable evidence context. These
-- indexes keep candidate selection off a full document aggregation path.
CREATE FUNCTION research_quick_field_words(p_locator jsonb) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT regexp_replace(regexp_replace(coalesce(p_locator->>'value',''),'([a-z])([A-Z])','\1 \2','g'),'[^a-zA-Z0-9]+',' ','g')
$$;
CREATE INDEX research_quick_field_search ON research_passages USING gin(to_tsvector('english',research_quick_field_words(locator)));
CREATE INDEX research_quick_title_search ON research_versions USING gin(to_tsvector('english',coalesce(metadata->>'title','')));
CREATE INDEX research_quick_passage_version ON research_passages(version_id,id);
CREATE INDEX research_quick_construction_sic ON research_passages(version_id) WHERE locator->>'value' LIKE '/sic_codes/%' AND text ~ '^(41|42|43)[0-9]{3}$';
CREATE INDEX research_quick_review_actor ON research_reviews(workspace_id,actor,target,created_at DESC,id DESC) WHERE action IN('desk_save','desk_dismiss','desk_reopen');
--> statement-breakpoint
-- Honour cancellation from the existing Advanced Runs controls immediately,
-- including an already leased quick question, using the same lock order as the
-- answer completion functions. A later explicit monitoring restart is allowed.
CREATE OR REPLACE FUNCTION research_cancel_run(p_run uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM research_quick_questions WHERE run_id=p_run AND workspace_id='51435300-0000-4000-8000-000000000001' ORDER BY id FOR UPDATE;
 UPDATE research_runs SET status='cancelled',finished_at=now(),updated_at=now() WHERE id=p_run AND workspace_id='51435300-0000-4000-8000-000000000001' AND status NOT IN ('complete','cancelled');
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE research_quick_questions SET status=CASE WHEN answer_id IS NULL THEN 'failed' ELSE 'complete' END,monitoring=false,error='Research was cancelled.',lease_token=lease_token+1,lease_expires_at=NULL,next_check_at=NULL,updated_at=now()
 WHERE run_id=p_run AND workspace_id='51435300-0000-4000-8000-000000000001' AND status IN('queued','running');
 UPDATE research_jobs SET status='cancelled',cancelled_at=now(),lease_token=lease_token+1,lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE run_id=p_run AND status NOT IN ('complete','cancelled');
END $$;
