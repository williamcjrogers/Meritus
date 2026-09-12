-- Evidence-backed identity and legal-treatment reviews. No copied judgment quotation is retained.
CREATE TABLE research_identifier_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 identifier_id uuid NOT NULL REFERENCES research_identifiers(id) ON DELETE CASCADE,
 document_id uuid NOT NULL REFERENCES research_documents(id), version_id uuid NOT NULL REFERENCES research_versions(id),
 passage_id uuid NOT NULL REFERENCES research_passages(id), reviewed_by text NOT NULL, reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(identifier_id,version_id,passage_id)
);
CREATE INDEX research_identifier_evidence_version ON research_identifier_evidence(version_id);
CREATE TABLE research_case_treatments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL DEFAULT '51435300-0000-4000-8000-000000000001',
 from_document_id uuid NOT NULL REFERENCES research_documents(id), to_document_id uuid NOT NULL REFERENCES research_documents(id),
 from_version_id uuid NOT NULL REFERENCES research_versions(id), to_version_id uuid NOT NULL REFERENCES research_versions(id),
 passage_id uuid NOT NULL REFERENCES research_passages(id), kind text NOT NULL CHECK(kind IN ('cites','applies','distinguishes','overrules','appeal')),
 reviewed_by text, reason text NOT NULL, available boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(from_document_id<>to_document_id), UNIQUE(from_version_id,to_version_id,passage_id,kind)
);
CREATE INDEX research_case_treatment_versions ON research_case_treatments(from_version_id,to_version_id);
--> statement-breakpoint
CREATE FUNCTION research_confirm_identifier(p_entity uuid,p_scheme text,p_value text,p_ref jsonb,p_actor text,p_reason text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE ent research_entities; source uuid; passage_text text; locator jsonb; identifier_result uuid;
BEGIN
 IF nullif(trim(p_actor),'') IS NULL OR length(trim(p_reason))<20 OR nullif(trim(p_value),'') IS NULL THEN RAISE EXCEPTION 'review_required'; END IF;
 SELECT * INTO ent FROM research_entities WHERE id=p_entity AND workspace_id='51435300-0000-4000-8000-000000000001' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'entity_unavailable'; END IF;
 IF p_scheme='uk-company-number' AND (ent.kind<>'company' OR ent.jurisdiction NOT IN('GB','UK','United Kingdom','England and Wales','Scotland','Northern Ireland') OR p_value!~'^[A-Z0-9]{8}$') THEN RAISE EXCEPTION 'identifier_kind_mismatch'; END IF;
 PERFORM research_assert_evidence(jsonb_build_array(p_ref));
 SELECT source_id,text,research_available_passages.locator INTO source,passage_text,locator FROM research_available_passages WHERE passage_id=(p_ref->>'passageId')::uuid;
 IF p_scheme='uk-company-number' THEN
  IF locator->>'kind'<>'field' OR upper(regexp_replace(passage_text,'\s','','g'))<>p_value THEN RAISE EXCEPTION 'identifier_not_supported'; END IF;
 ELSIF position(p_value in passage_text)=0 THEN RAISE EXCEPTION 'identifier_not_supported'; END IF;
 IF EXISTS(SELECT 1 FROM research_identifiers WHERE workspace_id=ent.workspace_id AND scheme=p_scheme AND value=p_value AND verified AND entity_id<>ent.id AND p_scheme IN('uk-company-number','lei','ocid')) THEN RAISE EXCEPTION 'identifier_conflict'; END IF;
 SELECT id INTO identifier_result FROM research_identifiers WHERE workspace_id=ent.workspace_id AND entity_id=ent.id AND scheme=p_scheme AND value=p_value ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF identifier_result IS NULL THEN INSERT INTO research_identifiers(workspace_id,entity_id,scheme,value,source_id,verified) VALUES(ent.workspace_id,ent.id,p_scheme,p_value,source,true) RETURNING id INTO identifier_result;
 ELSE UPDATE research_identifiers SET verified=true,updated_at=now() WHERE id=identifier_result; END IF;
 INSERT INTO research_identifier_evidence(workspace_id,identifier_id,document_id,version_id,passage_id,reviewed_by,reason)
 VALUES(ent.workspace_id,identifier_result,(p_ref->>'documentId')::uuid,(p_ref->>'versionId')::uuid,(p_ref->>'passageId')::uuid,p_actor,p_reason) ON CONFLICT(identifier_id,version_id,passage_id) DO NOTHING;
 UPDATE research_entities SET confirmed=true,updated_at=now() WHERE id=ent.id;
 INSERT INTO research_reviews(workspace_id,actor,action,target,reason,"references") VALUES(ent.workspace_id,p_actor,'identifier_confirmed',ent.id,p_reason,jsonb_build_object('identifierId',identifier_result,'evidence',jsonb_build_array(p_ref)));
 RETURN identifier_result;
END $$;
--> statement-breakpoint
CREATE FUNCTION research_review_case_treatment(p_from uuid,p_to uuid,p_ref jsonb,p_kind text,p_quotation text,p_target_reference text,p_actor text,p_reason text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE source_version uuid; target_version uuid; target_meta jsonb; result uuid; source_text text;
BEGIN
 IF p_from=p_to OR p_kind NOT IN('cites','applies','distinguishes','overrules','appeal') OR nullif(trim(p_actor),'') IS NULL OR length(trim(p_reason))<20 THEN RAISE EXCEPTION 'review_required'; END IF;
 PERFORM 1 FROM research_documents WHERE id IN(p_from,p_to) ORDER BY id FOR SHARE;
 SELECT d.current_version_id INTO source_version FROM research_documents d JOIN research_sources s ON s.id=d.source_id WHERE d.id=p_from AND d.workspace_id='51435300-0000-4000-8000-000000000001' AND s.provider='find-case-law' AND d.status='available';
 SELECT d.current_version_id,v.metadata INTO target_version,target_meta FROM research_documents d JOIN research_versions v ON v.id=d.current_version_id JOIN research_sources s ON s.id=d.source_id JOIN research_rights r ON r.id=s.rights_id WHERE d.id=p_to AND d.workspace_id='51435300-0000-4000-8000-000000000001' AND s.provider='find-case-law' AND d.status='available' AND v.availability='available' AND r.effective_at<=now() AND (r.expires_at IS NULL OR r.expires_at>now());
 IF source_version IS NULL OR target_version IS NULL OR (p_ref->>'documentId')::uuid<>p_from OR (p_ref->>'versionId')::uuid<>source_version THEN RAISE EXCEPTION 'evidence_unavailable'; END IF;
 PERFORM research_assert_evidence(jsonb_build_array(p_ref));
 SELECT text INTO source_text FROM research_available_passages WHERE passage_id=(p_ref->>'passageId')::uuid;
 IF nullif(trim(p_quotation),'') IS NULL OR position(p_quotation in source_text)=0 OR nullif(trim(p_target_reference),'') IS NULL OR position(p_target_reference in p_quotation)=0 THEN RAISE EXCEPTION 'treatment_not_supported'; END IF;
 IF p_target_reference IS DISTINCT FROM target_meta->>'title' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(target_meta->'identifiers','[]'::jsonb)) i WHERE i->>'value'=p_target_reference) THEN RAISE EXCEPTION 'treatment_target_mismatch'; END IF;
 IF (p_kind='overrules' AND p_quotation!~*'overrul') OR (p_kind='distinguishes' AND p_quotation!~*'distinguish') OR (p_kind='applies' AND p_quotation!~*'(appl|follow)') OR (p_kind='appeal' AND p_quotation!~*'appeal') THEN RAISE EXCEPTION 'express_treatment_required'; END IF;
 INSERT INTO research_case_treatments(from_document_id,to_document_id,from_version_id,to_version_id,passage_id,kind,reviewed_by,reason)
 VALUES(p_from,p_to,source_version,target_version,(p_ref->>'passageId')::uuid,p_kind,p_actor,p_reason)
 ON CONFLICT(from_version_id,to_version_id,passage_id,kind) DO UPDATE SET reviewed_by=excluded.reviewed_by,reason=excluded.reason,available=true RETURNING id INTO result;
 INSERT INTO research_reviews(actor,action,target,reason,"references") VALUES(p_actor,'case_treatment_reviewed',result,p_reason,jsonb_build_object('fromVersionId',source_version,'toVersionId',target_version,'passageId',p_ref->>'passageId'));
 RETURN result;
END $$;
--> statement-breakpoint
CREATE FUNCTION research_invalidate_identity_treatment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.availability='available' OR OLD.availability IS NOT DISTINCT FROM NEW.availability THEN RETURN NEW; END IF;
 UPDATE research_case_treatments SET available=false,reviewed_by=NULL,reason='' WHERE from_version_id=NEW.id OR to_version_id=NEW.id;
 UPDATE research_reviews SET reason='Source evidence changed; prior review rationale removed',updated_at=now() WHERE action='case_treatment_reviewed' AND ("references"->>'fromVersionId'=NEW.id::text OR "references"->>'toVersionId'=NEW.id::text);
 UPDATE research_identifier_evidence SET reason='' WHERE version_id=NEW.id;
 UPDATE research_reviews SET reason='Source evidence changed; prior review rationale removed',updated_at=now() WHERE action='identifier_confirmed' AND "references"->'evidence' @> jsonb_build_array(jsonb_build_object('versionId',NEW.id));
 UPDATE research_identifiers i SET verified=false,updated_at=now() WHERE i.id IN(SELECT identifier_id FROM research_identifier_evidence WHERE version_id=NEW.id) AND NOT EXISTS(SELECT 1 FROM research_identifier_evidence e JOIN research_available_passages p ON p.passage_id=e.passage_id AND p.version_id=e.version_id AND p.document_id=e.document_id WHERE e.identifier_id=i.id);
 UPDATE research_entities e SET confirmed=false,updated_at=now() WHERE e.id IN(SELECT i.entity_id FROM research_identifiers i JOIN research_identifier_evidence refs ON refs.identifier_id=i.id WHERE refs.version_id=NEW.id) AND NOT EXISTS(SELECT 1 FROM research_identifiers i WHERE i.entity_id=e.id AND i.verified);
 RETURN NEW;
END $$;
CREATE TRIGGER research_identity_treatment_invalidation AFTER UPDATE OF availability ON research_versions FOR EACH ROW EXECUTE FUNCTION research_invalidate_identity_treatment();
