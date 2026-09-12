CREATE TABLE "desk_action_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"actor_id" text NOT NULL,
	"kind" text NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "desk_action_events_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "desk_action_priorities" (
	"pursuit_id" text PRIMARY KEY NOT NULL,
	"action_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "desk_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"owner_id" text,
	"suggested_owner_id" text,
	"due_date" date,
	"original_due_date" date,
	"state" text DEFAULT 'todo' NOT NULL,
	"state_reason" text,
	"completed_at" timestamp with time zone,
	"completed_by" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"legacy_key" text,
	"pursuit_id" text,
	"prospect_id" text,
	"programme_id" text,
	"investigation_id" uuid,
	"calendar_id" uuid,
	"retained_context" text,
	CONSTRAINT "desk_actions_legacy_key_unique" UNIQUE("legacy_key"),
	CONSTRAINT "desk_actions_id_pursuit_unique" UNIQUE("id","pursuit_id"),
	CONSTRAINT "desk_action_state" CHECK ("desk_actions"."state" in ('todo','in_progress','waiting','completed','cancelled')),
	CONSTRAINT "desk_action_title" CHECK (length(btrim("desk_actions"."title")) between 1 and 240),
	CONSTRAINT "desk_action_version" CHECK ("desk_actions"."version">0),
	CONSTRAINT "desk_action_single_parent" CHECK (num_nonnulls("desk_actions"."pursuit_id","desk_actions"."prospect_id","desk_actions"."programme_id","desk_actions"."investigation_id","desk_actions"."calendar_id")<=1),
	CONSTRAINT "desk_action_waiting" CHECK ("desk_actions"."state"<>'waiting' or ("desk_actions"."due_date" is not null and coalesce(length(btrim("desk_actions"."state_reason")),0)>0)),
	CONSTRAINT "desk_action_cancelled" CHECK ("desk_actions"."state"<>'cancelled' or coalesce(length(btrim("desk_actions"."state_reason")),0)>0),
	CONSTRAINT "desk_action_completion" CHECK ((("desk_actions"."state"='completed') = ("desk_actions"."completed_at" is not null and "desk_actions"."completed_by" is not null)) and ("desk_actions"."state"='completed' or ("desk_actions"."completed_at" is null and "desk_actions"."completed_by" is null)) and ("desk_actions"."state"<>'completed' or "desk_actions"."owner_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "pursuits" ADD COLUMN "review_due" date;--> statement-breakpoint
ALTER TABLE "desk_action_events" ADD CONSTRAINT "desk_action_events_action_id_desk_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."desk_actions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desk_action_priorities" ADD CONSTRAINT "desk_action_priorities_pursuit_id_pursuits_id_fk" FOREIGN KEY ("pursuit_id") REFERENCES "public"."pursuits"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desk_action_priorities" ADD CONSTRAINT "desk_action_priorities_action_id_pursuit_id_desk_actions_id_pursuit_id_fk" FOREIGN KEY ("action_id","pursuit_id") REFERENCES "public"."desk_actions"("id","pursuit_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desk_actions" ADD CONSTRAINT "desk_actions_pursuit_id_pursuits_id_fk" FOREIGN KEY ("pursuit_id") REFERENCES "public"."pursuits"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desk_actions" ADD CONSTRAINT "desk_actions_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desk_actions" ADD CONSTRAINT "desk_actions_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desk_actions" ADD CONSTRAINT "desk_actions_investigation_id_research_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."research_investigations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desk_actions" ADD CONSTRAINT "desk_actions_calendar_id_research_calendar_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."research_calendar"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "desk_action_events_action_idx" ON "desk_action_events" USING btree ("action_id","created_at","id");--> statement-breakpoint
CREATE INDEX "desk_actions_due_idx" ON "desk_actions" USING btree ("state","due_date","id");--> statement-breakpoint
CREATE INDEX "desk_actions_owner_idx" ON "desk_actions" USING btree ("owner_id","state","due_date");--> statement-breakpoint
CREATE INDEX "desk_actions_pursuit_idx" ON "desk_actions" USING btree ("pursuit_id");--> statement-breakpoint
CREATE INDEX "desk_actions_prospect_idx" ON "desk_actions" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "desk_actions_programme_idx" ON "desk_actions" USING btree ("programme_id");--> statement-breakpoint
CREATE INDEX "desk_actions_investigation_idx" ON "desk_actions" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "desk_actions_calendar_idx" ON "desk_actions" USING btree ("calendar_id");
--> statement-breakpoint
-- All mutations lock the request before inspecting data. Parent then action is
-- the shared lock order, including creation, completion and nomination.
CREATE FUNCTION desk_save_action(p_actor text, p_request_id uuid, p_request_hash text, p_expected_version integer, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
 prior_event desk_action_events; before_row desk_actions; after_row desk_actions;
 action_id uuid; parent_id text; link_kind text; link_id text; exists_before boolean;
 new_state text; new_due date; new_owner text; reason text; event_kind text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT * INTO prior_event FROM desk_action_events WHERE request_id=p_request_id;
 IF FOUND THEN
  IF prior_event.actor_id IS DISTINCT FROM p_actor OR prior_event.request_hash IS DISTINCT FROM p_request_hash THEN
   RETURN jsonb_build_object('ok',false,'code','validation','error','Request was reused with different changes');
  END IF;
  RETURN jsonb_build_object('ok',true,'action',prior_event.after);
 END IF;
 IF coalesce(length(btrim(p_actor)),0)=0 OR p_request_id IS NULL OR coalesce(length(p_request_hash),0)=0 OR p_expected_version IS NULL OR p_expected_version<0 THEN
  RETURN jsonb_build_object('ok',false,'code','validation','error','Invalid command');
 END IF;
 action_id := (p_payload->>'id')::uuid;
 link_kind := p_payload->'link'->>'kind'; link_id := p_payload->'link'->>'id';
 IF action_id IS NULL OR link_kind IS NULL OR link_kind NOT IN ('general','pursuit','prospect','programme','investigation','calendar') OR (link_kind<>'general' AND coalesce(length(link_id),0)=0) OR (link_kind='general' AND link_id IS NOT NULL) THEN
  RETURN jsonb_build_object('ok',false,'code','validation','error','Invalid action link');
 END IF;
 SELECT pursuit_id INTO parent_id FROM desk_actions WHERE id=action_id;
 IF NOT FOUND AND link_kind='pursuit' THEN parent_id := link_id; END IF;
 IF parent_id IS NOT NULL THEN PERFORM 1 FROM pursuits WHERE id=parent_id FOR UPDATE; END IF;
 -- Also serialises competing creates of an as-yet absent action UUID.
 PERFORM pg_advisory_xact_lock(hashtextextended('desk-action:'||action_id::text,0));
 SELECT * INTO before_row FROM desk_actions WHERE id=action_id FOR UPDATE;
 exists_before := FOUND;
 IF exists_before AND before_row.version<>p_expected_version THEN
  RETURN jsonb_build_object('ok',false,'code','conflict','error','The action has changed','current',to_jsonb(before_row));
 ELSIF NOT exists_before AND p_expected_version<>0 THEN
  RETURN jsonb_build_object('ok',false,'code','not_found','error','Action not found');
 END IF;
 IF exists_before AND (before_row.pursuit_id IS DISTINCT FROM CASE WHEN link_kind='pursuit' THEN link_id END OR before_row.prospect_id IS DISTINCT FROM CASE WHEN link_kind='prospect' THEN link_id END OR before_row.programme_id IS DISTINCT FROM CASE WHEN link_kind='programme' THEN link_id END OR before_row.investigation_id IS DISTINCT FROM CASE WHEN link_kind='investigation' THEN link_id::uuid END OR before_row.calendar_id IS DISTINCT FROM CASE WHEN link_kind='calendar' THEN link_id::uuid END) THEN
  RETURN jsonb_build_object('ok',false,'code','validation','error','The action link cannot be changed');
 END IF;
 new_state := p_payload->>'state'; new_due := nullif(p_payload->>'dueDate','')::date;
 new_owner := nullif(btrim(p_payload->>'ownerId'),''); reason := nullif(btrim(p_payload->>'changeReason'),'');
 IF exists_before AND before_row.state IN ('completed','cancelled') AND
  (before_row.title IS DISTINCT FROM btrim(p_payload->>'title') OR
   before_row.description IS DISTINCT FROM nullif(p_payload->>'description','') OR
   before_row.owner_id IS DISTINCT FROM new_owner OR before_row.due_date IS DISTINCT FROM new_due) THEN
  RETURN jsonb_build_object('ok',false,'code','validation','error','Reopen the action before editing its details');
 END IF;
 IF exists_before AND before_row.state IN ('completed','cancelled') AND new_state IN ('todo','in_progress','waiting') AND
  nullif(btrim(p_payload->>'stateReason'),'') IS NOT NULL AND before_row.state_reason IS DISTINCT FROM nullif(btrim(p_payload->>'stateReason'),'') THEN
  RETURN jsonb_build_object('ok',false,'code','validation','error','Reopen the action before editing its details');
 END IF;
 IF exists_before AND before_row.state='completed' AND new_state='completed' THEN
  IF before_row.state_reason IS DISTINCT FROM nullif(btrim(p_payload->>'stateReason'),'') THEN
   RETURN jsonb_build_object('ok',false,'code','validation','error','Reopen the action before editing its details');
  END IF;
  RETURN jsonb_build_object('ok',true,'action',to_jsonb(before_row));
 END IF;
 IF exists_before AND before_row.state IN ('completed','cancelled') AND new_state NOT IN ('todo','in_progress','waiting') THEN
  RETURN jsonb_build_object('ok',false,'code','validation','error','Reopen the action before editing it');
 END IF;
 IF coalesce(length(btrim(p_payload->>'title')),0) NOT BETWEEN 1 AND 240 OR coalesce(length(p_payload->>'description'),0)>4000 OR coalesce(length(p_payload->>'stateReason'),0)>1000 OR coalesce(length(p_payload->>'changeReason'),0)>1000 OR new_state IS NULL OR new_state NOT IN ('todo','in_progress','waiting','completed','cancelled') THEN
  RETURN jsonb_build_object('ok',false,'code','validation','error','Invalid action details');
 END IF;
 IF (new_owner IS NULL AND (NOT coalesce((p_payload->>'saveUnassigned')::boolean,false) OR new_state='completed')) OR (new_owner IS NOT NULL AND new_due IS NULL AND (NOT exists_before OR before_row.owner_id IS DISTINCT FROM new_owner)) THEN
  RETURN jsonb_build_object('ok',false,'code','validation','error','Confirm assignment and its due date or save as unassigned');
 END IF;
 IF (new_state='waiting' AND new_due IS NULL) OR (new_state IN ('waiting','cancelled') AND coalesce(length(btrim(p_payload->>'stateReason')),0)=0) THEN
  RETURN jsonb_build_object('ok',false,'code','validation','error','A reason and any required follow-up date must be supplied');
 END IF;
 IF exists_before AND before_row.due_date IS DISTINCT FROM new_due AND reason IS NULL THEN
  RETURN jsonb_build_object('ok',false,'code','validation','error','Explain why the due date changed');
 END IF;
 IF NOT exists_before THEN
  INSERT INTO desk_actions(id,title,description,owner_id,due_date,original_due_date,state,state_reason,completed_at,completed_by,created_by,pursuit_id,prospect_id,programme_id,investigation_id,calendar_id)
  VALUES(action_id,btrim(p_payload->>'title'),nullif(p_payload->>'description',''),new_owner,new_due,new_due,new_state,nullif(btrim(p_payload->>'stateReason'),''),CASE WHEN new_state='completed' THEN now() END,CASE WHEN new_state='completed' THEN p_actor END,p_actor,CASE WHEN link_kind='pursuit' THEN link_id END,CASE WHEN link_kind='prospect' THEN link_id END,CASE WHEN link_kind='programme' THEN link_id END,CASE WHEN link_kind='investigation' THEN link_id::uuid END,CASE WHEN link_kind='calendar' THEN link_id::uuid END) RETURNING * INTO after_row;
  event_kind := 'created';
 ELSE
  UPDATE desk_actions SET title=btrim(p_payload->>'title'),description=nullif(p_payload->>'description',''),owner_id=new_owner,due_date=new_due,original_due_date=coalesce(before_row.original_due_date,new_due),state=new_state,state_reason=nullif(btrim(p_payload->>'stateReason'),''),completed_at=CASE WHEN new_state='completed' THEN now() END,completed_by=CASE WHEN new_state='completed' THEN p_actor END,updated_at=now(),version=version+1 WHERE id=action_id RETURNING * INTO after_row;
  event_kind := CASE WHEN new_state='completed' THEN 'completed' WHEN new_state='cancelled' THEN 'cancelled' WHEN before_row.state IN ('completed','cancelled') THEN 'reopened' ELSE 'updated' END;
 END IF;
 IF new_state IN ('completed','cancelled') THEN DELETE FROM desk_action_priorities WHERE desk_action_priorities.action_id=after_row.id; END IF;
 INSERT INTO desk_action_events(action_id,request_id,request_hash,actor_id,kind,before,after,reason)
 VALUES(after_row.id,p_request_id,p_request_hash,p_actor,event_kind,CASE WHEN exists_before THEN to_jsonb(before_row) END,to_jsonb(after_row),coalesce(reason,nullif(btrim(p_payload->>'stateReason'),'')));
 RETURN jsonb_build_object('ok',true,'action',to_jsonb(after_row));
EXCEPTION WHEN foreign_key_violation OR check_violation OR invalid_text_representation OR datetime_field_overflow THEN
 RETURN jsonb_build_object('ok',false,'code','validation','error','Invalid action or related record');
END;
$$;
--> statement-breakpoint
CREATE FUNCTION desk_change_action_link(p_actor text,p_request_id uuid,p_request_hash text,p_action_id uuid,p_expected_version integer,p_operation text,p_retained_context text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE prior_event desk_action_events; before_row desk_actions; after_row desk_actions; parent_id text; context_label text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT * INTO prior_event FROM desk_action_events WHERE request_id=p_request_id;
 IF FOUND THEN
  IF prior_event.actor_id IS DISTINCT FROM p_actor OR prior_event.request_hash IS DISTINCT FROM p_request_hash THEN RETURN jsonb_build_object('ok',false,'code','validation','error','Request was reused with different changes'); END IF;
  RETURN jsonb_build_object('ok',true,'action',prior_event.after);
 END IF;
 IF coalesce(length(btrim(p_actor)),0)=0 OR p_request_id IS NULL OR coalesce(length(p_request_hash),0)=0 OR p_action_id IS NULL OR p_expected_version IS NULL OR p_expected_version<1 OR p_operation IS NULL OR p_operation NOT IN ('detached','primary_selected') THEN RETURN jsonb_build_object('ok',false,'code','validation','error','Invalid command'); END IF;
 SELECT pursuit_id INTO parent_id FROM desk_actions WHERE id=p_action_id;
 IF parent_id IS NOT NULL THEN PERFORM 1 FROM pursuits WHERE id=parent_id FOR UPDATE; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('desk-action:'||p_action_id::text,0));
 SELECT * INTO before_row FROM desk_actions WHERE id=p_action_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','not_found','error','Action not found'); END IF;
 IF before_row.version<>p_expected_version THEN RETURN jsonb_build_object('ok',false,'code','conflict','error','The action has changed','current',to_jsonb(before_row)); END IF;
 IF p_operation='primary_selected' THEN
  IF before_row.pursuit_id IS NULL OR before_row.state NOT IN ('todo','in_progress','waiting') THEN RETURN jsonb_build_object('ok',false,'code','validation','error','Select an open action linked to this live lead'); END IF;
  INSERT INTO desk_action_priorities(pursuit_id,action_id) VALUES(before_row.pursuit_id,before_row.id)
  ON CONFLICT(pursuit_id) DO UPDATE SET action_id=excluded.action_id,version=desk_action_priorities.version+1;
  UPDATE desk_actions SET version=version+1,updated_at=now() WHERE id=p_action_id RETURNING * INTO after_row;
 ELSE
  IF num_nonnulls(before_row.pursuit_id,before_row.prospect_id,before_row.programme_id,before_row.investigation_id,before_row.calendar_id)=0 THEN RETURN jsonb_build_object('ok',false,'code','validation','error','Action is already standalone'); END IF;
  context_label := nullif(btrim(p_retained_context),'');
  IF context_label IS NULL THEN
   context_label := CASE WHEN before_row.pursuit_id IS NOT NULL THEN 'Live lead: '||(SELECT firm FROM pursuits WHERE id=before_row.pursuit_id)
    ELSE 'Retained related record: '||coalesce(before_row.prospect_id,before_row.programme_id,before_row.investigation_id::text,before_row.calendar_id::text) END;
  END IF;
  DELETE FROM desk_action_priorities WHERE action_id=p_action_id;
  UPDATE desk_actions SET pursuit_id=NULL,prospect_id=NULL,programme_id=NULL,investigation_id=NULL,calendar_id=NULL,retained_context=context_label,version=version+1,updated_at=now() WHERE id=p_action_id RETURNING * INTO after_row;
 END IF;
 INSERT INTO desk_action_events(action_id,request_id,request_hash,actor_id,kind,before,after,reason) VALUES(p_action_id,p_request_id,p_request_hash,p_actor,p_operation,to_jsonb(before_row),to_jsonb(after_row),context_label);
 RETURN jsonb_build_object('ok',true,'action',to_jsonb(after_row));
END;
$$;
--> statement-breakpoint
CREATE FUNCTION desk_detach_action(p_actor text,p_request_id uuid,p_request_hash text,p_action_id uuid,p_expected_version integer,p_retained_context text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql AS $$ SELECT desk_change_action_link(p_actor,p_request_id,p_request_hash,p_action_id,p_expected_version,'detached',p_retained_context); $$;
--> statement-breakpoint
CREATE FUNCTION desk_select_primary(p_actor text,p_request_id uuid,p_request_hash text,p_action_id uuid,p_expected_version integer)
RETURNS jsonb LANGUAGE sql AS $$ SELECT desk_change_action_link(p_actor,p_request_id,p_request_hash,p_action_id,p_expected_version,'primary_selected'); $$;
--> statement-breakpoint
-- Reject accidental history rewrites, including direct repository updates.
CREATE FUNCTION desk_reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Action history is append-only'; END;
$$;
CREATE TRIGGER desk_action_history_append_only BEFORE UPDATE OR DELETE ON desk_action_events
FOR EACH ROW EXECUTE FUNCTION desk_reject_history_mutation();
--> statement-breakpoint
-- BEGIN LEGACY IMPORT (kept together for repeatable fixture reconciliation).
UPDATE pursuits SET review_due=next_action_due WHERE stage='dormant' AND review_due IS NULL AND next_action_due IS NOT NULL;
WITH imported AS (
 INSERT INTO desk_actions(id,title,owner_id,suggested_owner_id,due_date,original_due_date,state,created_by,legacy_key,pursuit_id)
 SELECT gen_random_uuid(),next_action,NULL,owner_id,next_action_due,next_action_due,'todo','system:legacy-import','pursuit:'||id,id
 FROM pursuits WHERE nullif(btrim(next_action),'') IS NOT NULL
 ON CONFLICT(legacy_key) DO NOTHING RETURNING *
)
INSERT INTO desk_action_events(action_id,request_id,request_hash,actor_id,kind,before,after,reason)
SELECT id,gen_random_uuid(),'legacy-import','system:legacy-import','imported',NULL,to_jsonb(imported),'Imported next action; confirm assignment' FROM imported;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pursuits p WHERE nullif(btrim(p.next_action),'') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM desk_actions a WHERE a.legacy_key='pursuit:'||p.id AND a.title=p.next_action AND a.due_date IS NOT DISTINCT FROM p.next_action_due AND a.pursuit_id=p.id)) THEN RAISE EXCEPTION 'Legacy next action reconciliation failed'; END IF;
 IF EXISTS(SELECT 1 FROM pursuits WHERE stage='dormant' AND next_action_due IS NOT NULL AND review_due IS DISTINCT FROM next_action_due) THEN RAISE EXCEPTION 'Dormant review date reconciliation failed'; END IF;
END $$;
-- END LEGACY IMPORT
