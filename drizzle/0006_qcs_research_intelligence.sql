CREATE TABLE research_signal_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 signal_id uuid NOT NULL REFERENCES research_signals(id),
 action text NOT NULL CHECK(action IN ('annotate','assign','revisit','merge')),
 actor text NOT NULL,
 owner_id text,
 revisit_at timestamptz,
 note text NOT NULL,
 evidence jsonb NOT NULL DEFAULT '[]',
 related_signal_id uuid REFERENCES research_signals(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX research_signal_decisions_signal ON research_signal_decisions(signal_id,created_at);
--> statement-breakpoint
CREATE TABLE research_weekly_digests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 week_start date NOT NULL,
 signal_ids jsonb NOT NULL,
 calendar_ids jsonb NOT NULL,
 source_coverage jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,week_start)
);
--> statement-breakpoint
CREATE TABLE research_indexes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 investigation_id uuid NOT NULL REFERENCES research_investigations(id),
 kind text NOT NULL,
 specification jsonb NOT NULL,
 summary jsonb NOT NULL,
 evidence jsonb NOT NULL,
 actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE FUNCTION research_decide_signal(p_signal uuid,p_revision integer,p_actor text,p_action text,p_note text,p_owner text,p_revisit timestamptz,p_related uuid,p_evidence jsonb) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE s research_signals; other research_signals; decision uuid;
BEGIN
 -- Stable lock order prevents two reciprocal merge requests deadlocking.
 PERFORM 1 FROM research_signals WHERE id IN(p_signal,p_related) ORDER BY id FOR UPDATE;
 SELECT * INTO s FROM research_signals WHERE id=p_signal AND workspace_id='51435300-0000-4000-8000-000000000001';
 IF NOT FOUND THEN RAISE EXCEPTION 'signal_not_found'; END IF;
 IF s.revision<>p_revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 IF NOT research_signal_available(s.id) THEN RAISE EXCEPTION 'evidence_unavailable'; END IF;
 PERFORM research_assert_evidence(p_evidence);
 IF p_action='merge' THEN
  SELECT * INTO other FROM research_signals WHERE id=p_related AND entity_id=s.entity_id AND id<>s.id AND workspace_id=s.workspace_id;
  IF NOT FOUND OR NOT research_signal_available(other.id) THEN RAISE EXCEPTION 'same_entity_signal_required'; END IF;
  -- An equivalence decision changes corroboration and therefore requires fresh review.
  UPDATE research_signals SET event_key=other.event_key,status='unreviewed',review_id=NULL,independence_confirmed=false,revision=revision+1,updated_at=now() WHERE id IN(s.id,other.id);
  UPDATE research_conversions SET needs_review=true,updated_at=now() WHERE signal_id IN(s.id,other.id);
 ELSIF p_action IN('annotate','assign','revisit') THEN
  UPDATE research_signals SET revision=revision+1,updated_at=now() WHERE id=s.id;
 ELSE RAISE EXCEPTION 'invalid_decision'; END IF;
 INSERT INTO research_signal_decisions(signal_id,action,actor,note,owner_id,revisit_at,related_signal_id,evidence)
 VALUES(s.id,p_action,p_actor,p_note,p_owner,p_revisit,p_related,p_evidence) RETURNING id INTO decision;
 INSERT INTO research_reviews(actor,action,target,reason,"references") VALUES(p_actor,p_action,s.id,'Director research decision',jsonb_build_object('decisionId',decision));
 RETURN decision;
END $$;
--> statement-breakpoint
CREATE FUNCTION research_refresh_intelligence(p_now timestamptz DEFAULT now()) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE week date; result uuid;
BEGIN
 week:=date_trunc('week',p_now AT TIME ZONE 'Europe/London')::date;
 IF NOT EXISTS(SELECT 1 FROM research_signals WHERE research_signal_available(id)) AND NOT EXISTS(SELECT 1 FROM research_calendar WHERE proposed_date>=week AND proposed_date<week+7) THEN RETURN NULL; END IF;
 INSERT INTO research_weekly_digests(week_start,signal_ids,calendar_ids,source_coverage)
 SELECT week,
  coalesce((SELECT jsonb_agg(id) FROM (SELECT s.id FROM research_signals s WHERE s.status<>'dismissed' AND research_signal_available(s.id) AND NOT EXISTS(SELECT 1 FROM research_suppressions x WHERE x.target IN(s.id,s.entity_id,s.investigation_id) AND x.revoked_at IS NULL AND (x.expires_at IS NULL OR x.expires_at>p_now)) ORDER BY s.score DESC,s.id LIMIT 200) q),'[]'),
  coalesce((SELECT jsonb_agg(id) FROM research_calendar WHERE proposed_date>=week AND proposed_date<week+7),'[]'),
  coalesce((SELECT jsonb_agg(jsonb_build_object('sourceId',id,'status',status,'lastSuccessAt',last_success_at,'freshnessSeconds',freshness_seconds)) FROM research_sources),'[]')
 ON CONFLICT(workspace_id,week_start) DO NOTHING RETURNING id INTO result;
 RETURN result;
END $$;
--> statement-breakpoint
CREATE FUNCTION research_intelligence_withdrawal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.availability<>'available' AND OLD.availability='available' THEN
  UPDATE research_signal_decisions SET note='' WHERE evidence @> jsonb_build_array(jsonb_build_object('versionId',NEW.id));
  UPDATE research_indexes SET specification='{}',summary='{}' WHERE evidence @> jsonb_build_array(jsonb_build_object('versionId',NEW.id));
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER research_intelligence_withdrawal_trigger AFTER UPDATE OF availability ON research_versions FOR EACH ROW EXECUTE FUNCTION research_intelligence_withdrawal();
