CREATE TABLE research_watchlist_refreshes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 member_id uuid NOT NULL REFERENCES research_watchlist_members(id) ON DELETE CASCADE,
 source_id uuid NOT NULL REFERENCES research_sources(id),run_id uuid REFERENCES research_runs(id),
 status text NOT NULL,reason text,checked_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT research_watchlist_source_refresh UNIQUE(member_id,source_id)
);
CREATE INDEX research_watchlist_refresh_checked ON research_watchlist_refreshes(workspace_id,checked_at);
--> statement-breakpoint
CREATE FUNCTION research_dispatch_watchlists(p_now timestamptz,p_members jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE item jsonb; candidate jsonb; member research_watchlist_members; watch research_watchlists; entity research_entities; source research_sources;
 run uuid; job uuid; current_job uuid; scope text; failure text; created_any boolean; had_active boolean; errors jsonb;queued_count integer:=0;active_count integer:=0;unavailable_count integer:=0;
BEGIN
 IF jsonb_typeof(p_members) IS DISTINCT FROM 'array' OR jsonb_array_length(p_members)>10 THEN RAISE EXCEPTION 'invalid_watchlist_batch'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_members) LOOP
  SELECT * INTO watch FROM research_watchlists WHERE id=(item->>'watchlistId')::uuid AND workspace_id='51435300-0000-4000-8000-000000000001' AND enabled AND revision=(item->>'revision')::integer FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN CONTINUE; END IF;
  SELECT * INTO member FROM research_watchlist_members WHERE id=(item->>'id')::uuid AND workspace_id=watch.workspace_id AND watchlist_id=watch.id AND updated_at=(item->>'updatedAt')::timestamptz AND next_refresh_at<=p_now FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN CONTINUE; END IF;
  SELECT * INTO entity FROM research_entities WHERE id=member.entity_id AND workspace_id=watch.workspace_id AND confirmed AND updated_at=(item->>'entityUpdatedAt')::timestamptz FOR SHARE;
  IF NOT FOUND OR entity.id IS DISTINCT FROM (item->>'entityId')::uuid THEN CONTINUE; END IF;
  IF jsonb_typeof(item->'sources') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'sources')>20 THEN RAISE EXCEPTION 'invalid_watchlist_sources'; END IF;
  run:=NULL;created_any:=false;had_active:=false;errors:='[]'::jsonb;scope:='watchlist:'||member.id::text;
  FOR candidate IN SELECT value FROM jsonb_array_elements(item->'sources') LOOP
   IF NOT watch.sources @> jsonb_build_array(candidate->>'id') THEN CONTINUE; END IF;
   SELECT * INTO source FROM research_sources WHERE id=(candidate->>'id')::uuid AND workspace_id=watch.workspace_id FOR UPDATE;
   IF NOT FOUND THEN CONTINUE; END IF;
   failure:=candidate->>'error';
   IF source.updated_at IS DISTINCT FROM (candidate->>'updatedAt')::timestamptz THEN failure:='source_configuration_changed';
   ELSIF source.status<>'ready' THEN failure:='source_unavailable';
   ELSIF NOT EXISTS(SELECT 1 FROM research_rights r WHERE r.id=source.rights_id AND r.workspace_id=watch.workspace_id AND r.effective_at<=now() AND (r.expires_at IS NULL OR r.expires_at>now())) THEN failure:='rights_unavailable';
   ELSIF failure IS NULL AND source.provider='companies-house' AND NOT EXISTS(SELECT 1 FROM research_identifiers i WHERE i.entity_id=entity.id AND i.workspace_id=watch.workspace_id AND i.scheme='uk-company-number' AND i.verified AND i.value=candidate->'payload'->'selection'->>'companyNumber' and exists(select 1 from research_identifier_evidence proof join research_available_passages p on p.passage_id=proof.passage_id and p.version_id=proof.version_id and p.document_id=proof.document_id and p.workspace_id=i.workspace_id where proof.identifier_id=i.id and proof.workspace_id=i.workspace_id)) THEN failure:='verified_company_number_required';
   END IF;
   IF failure IS NOT NULL OR jsonb_typeof(candidate->'payload') IS DISTINCT FROM 'object' THEN
    INSERT INTO research_watchlist_refreshes(member_id,source_id,status,reason,checked_at) VALUES(member.id,source.id,'unavailable',coalesce(failure,'selection_invalid'),p_now)
    ON CONFLICT(member_id,source_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,checked_at=excluded.checked_at,updated_at=now();
    errors:=errors||jsonb_build_array(jsonb_build_object('sourceId',source.id,'reason',coalesce(failure,'selection_invalid')));
    unavailable_count:=unavailable_count+1;CONTINUE;
   END IF;
   SELECT id INTO current_job FROM research_jobs WHERE workspace_id=watch.workspace_id AND source_id=source.id AND scope_key=scope AND status IN ('queued','running','retry');
   IF current_job IS NOT NULL THEN
    UPDATE research_watchlist_refreshes SET status='active',checked_at=p_now,updated_at=now() WHERE member_id=member.id AND source_id=source.id;
    active_count:=active_count+1;had_active:=true;CONTINUE;
   END IF;
   IF (candidate->'payload'->>'watchlistMemberId')::uuid IS DISTINCT FROM member.id OR (candidate->'payload'->>'entityId')::uuid IS DISTINCT FROM entity.id OR (candidate->'payload'->'window'->>'to')::timestamptz IS DISTINCT FROM p_now OR (candidate->'payload'->'window'->>'from')::timestamptz>p_now THEN RAISE EXCEPTION 'watchlist_payload_mismatch'; END IF;
   IF run IS NULL THEN
    INSERT INTO research_runs(source_selection,versions,coverage) VALUES(watch.sources,jsonb_build_object('watchlist','1','watchlistId',watch.id,'memberId',member.id,'entityId',entity.id),'{}') RETURNING id INTO run;
   END IF;
   job:=research_enqueue(source.id,scope,'fetch',candidate->'payload',scope||':'||source.id::text||':'||p_now::text,run);
   IF job IS NULL THEN active_count:=active_count+1;had_active:=true;CONTINUE;END IF;
   INSERT INTO research_watchlist_refreshes(member_id,source_id,run_id,status,reason,checked_at)
    VALUES(member.id,source.id,run,'queued',CASE WHEN source.provider IN ('find-a-tender','contracts-finder','payment-practices','gazette') THEN 'Provider population scan; entity matches require evidence review' ELSE NULL END,p_now)
    ON CONFLICT(member_id,source_id) DO UPDATE SET run_id=excluded.run_id,status=excluded.status,reason=excluded.reason,checked_at=excluded.checked_at,updated_at=now();
   queued_count:=queued_count+1;created_any:=true;
  END LOOP;
  IF created_any THEN
   FOR candidate IN SELECT value FROM jsonb_array_elements(errors) LOOP
    INSERT INTO research_jobs(type,source_id,scope_key,run_id,dedupe_key,payload,status,error_code)
    VALUES('fetch',(candidate->>'sourceId')::uuid,scope,run,scope||':'||(candidate->>'sourceId')||':'||p_now::text,'{}','failed',candidate->>'reason') ON CONFLICT DO NOTHING;
    UPDATE research_runs SET coverage=coverage||jsonb_build_object(candidate->>'sourceId',jsonb_build_object('complete',false,'notes',jsonb_build_array(candidate->>'reason'))) WHERE id=run;
    UPDATE research_watchlist_refreshes SET run_id=run WHERE member_id=member.id AND source_id=(candidate->>'sourceId')::uuid;
   END LOOP;
   UPDATE research_watchlist_members SET next_refresh_at=p_now+make_interval(secs=>watch.cadence_seconds),updated_at=now() WHERE id=member.id;
  ELSE
   IF run IS NOT NULL THEN DELETE FROM research_runs WHERE id=run; END IF;
   IF NOT had_active THEN UPDATE research_watchlist_members SET next_refresh_at=p_now+make_interval(secs=>least(watch.cadence_seconds,900)),updated_at=now() WHERE id=member.id; END IF;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('enqueued',queued_count,'active',active_count,'unavailable',unavailable_count);
END $$;
--> statement-breakpoint
CREATE FUNCTION research_cancel_watchlist_jobs() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE affected uuid[];
BEGIN
 IF TG_TABLE_NAME='research_watchlist_members' THEN
  SELECT array_agg(DISTINCT run_id) INTO affected FROM research_jobs WHERE payload->>'watchlistMemberId'=OLD.id::text AND status IN ('queued','running','retry');
 ELSE
  SELECT array_agg(DISTINCT run_id) INTO affected FROM research_jobs WHERE payload->>'watchlistId'=NEW.id::text AND status IN ('queued','running','retry') AND (NOT NEW.enabled OR NOT NEW.sources @> jsonb_build_array(source_id::text));
 END IF;
 IF affected IS NULL THEN RETURN NULL; END IF;
 PERFORM 1 FROM research_runs WHERE id=ANY(affected) ORDER BY id FOR UPDATE;
 IF TG_TABLE_NAME='research_watchlist_members' THEN
  UPDATE research_jobs SET status='cancelled',cancelled_at=now(),lease_token=lease_token+1,lease_expires_at=NULL,updated_at=now() WHERE run_id=ANY(affected) AND payload->>'watchlistMemberId'=OLD.id::text AND status IN ('queued','running','retry');
 ELSE
  UPDATE research_jobs SET status='cancelled',cancelled_at=now(),lease_token=lease_token+1,lease_expires_at=NULL,updated_at=now() WHERE run_id=ANY(affected) AND payload->>'watchlistId'=NEW.id::text AND status IN ('queued','running','retry') AND (NOT NEW.enabled OR NOT NEW.sources @> jsonb_build_array(source_id::text));
 END IF;
 UPDATE research_runs r SET status='cancelled',finished_at=now(),updated_at=now() WHERE r.id=ANY(affected) AND NOT EXISTS(SELECT 1 FROM research_jobs j WHERE j.run_id=r.id AND j.status IN ('queued','running','retry'));
 RETURN NULL;
END $$;
CREATE TRIGGER research_cancel_removed_watch_member AFTER DELETE ON research_watchlist_members FOR EACH ROW EXECUTE FUNCTION research_cancel_watchlist_jobs();
CREATE TRIGGER research_cancel_disabled_watchlist AFTER UPDATE OF enabled,sources ON research_watchlists FOR EACH ROW EXECUTE FUNCTION research_cancel_watchlist_jobs();
