export type EntityKind = 'organisation' | 'project' | 'building' | 'proceeding' | 'person'

export interface Session { username: string; csrf_token: string; demo_mode?: boolean; synthetic?: boolean }
export interface ListResponse<T> { items: T[]; total: number; page: number; page_size: number; synthetic?: boolean; truncated?: boolean; coverage?: unknown }
export interface Contribution {
  observation_id: string
  event_key: string
  family: string
  kind: string
  age_days: number
  points?: number
  evidence_url?: string
  exclusion_reason?: string | null
}
export interface WatchlistItem {
  entity_id: string
  entity_key: string
  name: string
  kind: EntityKind
  score: number
  eligible: boolean
  independent_events: number
  reasons: string[]
  contributions: Contribution[]
  latest_evidence_at?: string | null
  source_ids: string[]
  gaps: string[]
  stage?: string | null
  sector?: string | null
  geography?: string | null
  lead_time_band?: string | null
  reviewer?: string | null
  review_state?: string | null
  pipeline_stage?: string | null
  change_since_previous?: string | number | null
  suggested_review_route?: string | null
}
export interface WatchlistResponse extends ListResponse<WatchlistItem> { as_of: string; rule_version: string; coverage?: Coverage }

export interface Entity {
  id: string
  key: string
  name: string
  kind: EntityKind
  scheme?: string | null
  identifier?: string | null
  verified?: boolean
  observations?: EvidenceItem[]
  records?: EvidenceItem[]
  relationships?: Relationship[]
  calendar?: CalendarEntry[]
  pipeline?: PipelineAction[]
  score?: Partial<WatchlistItem>
}
export interface EvidenceItem {
  id: string
  record_id?: string
  entity_id?: string
  entity_name?: string
  headline?: string
  title?: string
  detail?: string
  kind?: string
  source_id?: string
  source_name?: string
  source_permissions?: Record<string, unknown>
  source_url?: string
  evidence_pointer?: string
  occurred_at?: string | null
  observed_at?: string | null
  state?: string
  active?: boolean
  withdrawn?: boolean
  rights?: string
}
export interface Source {
  id: string
  name: string
  description?: string
  home_url?: string
  licence_url?: string
  enabled: boolean
  requires_permission: boolean
  credential_names: string[]
  permissions: Record<string, unknown>
  config: Record<string, unknown>
  status: string
  last_attempt_at?: string | null
  last_success_at?: string | null
  last_error?: string | null
  partial?: boolean
  readiness?: {
    can_run: boolean
    reasons: string[]
    checked_at: string
    configuration_scope: string
    operations: Record<'retrieve' | 'import' | 'analyse' | 'export', boolean>
    credentials: { name: string; configured: boolean; required_for_run?: boolean }[]
    contact: { required: boolean; configured: boolean }
  }
}
export interface IngestionRun {
  id: string
  source_id: string
  status: string
  started_at?: string | null
  finished_at?: string | null
  fetched?: number
  inserted?: number
  updated?: number
  rejected?: number
  error?: string | null
}
export interface ReviewItem {
  id: string
  target_type: string
  target_id: string
  review_type?: 'identity' | 'observation' | 'independence' | string
  payload?: Record<string, unknown>
  allowed_actions?: string[]
  target?: { id: string; type: string; name?: string; identifier?: string; verified?: boolean }
  headline?: string
  state?: string
  action?: string
  actor?: string | null
  reason?: string
  created_at?: string
}
export interface CalendarEntry {
  id: string
  entity_id: string
  entity_name?: string
  kind: string
  title: string
  date: string
  precision?: string
  source_url?: string
  evidence?: string
  status: 'provisional' | 'confirmed' | string
  jurisdiction?: string
  basis?: string
  reviewer?: string
  created_at?: string
}
export interface Relationship {
  id: string
  record_id?: string | null
  attributes?: { evidence_mode?: string; human_basis?: string; [key: string]: unknown }
  from_entity_id: string
  from_name?: string
  to_entity_id: string
  to_name?: string
  role: string
  evidence_pointer: string
  source_url?: string
  valid_from?: string | null
  valid_to?: string | null
  state?: string
  created_at?: string
}
export interface PipelineAction {
  id: string
  entity_id: string
  entity_name?: string
  stage: string
  note: string
  actor?: string
  occurred_at?: string
}
export interface Snapshot { id: string; kind: 'weekly' | 'digest'; as_of: string; rule_version?: string; created_at?: string; redacted_at?: string | null }

export interface Coverage {
  complete: boolean
  database_enumeration_complete: boolean
  truncated: boolean
  incomplete_sources: string[]
  entities_considered: number
  source_records_considered: number
}
export interface OutcomeMetrics {
  as_of: string
  filters: { cohort: string | null; date_from: string | null; date_to: string; follow_up_through: string }
  denominator_scope: { reviewed_recommendations: string; contacted_opportunities: string }
  denominators: { conversation_rate_reviewed: number; conversation_rate_contacted: number }
  counts: { reviewed_recommendations: number; contacted_opportunities: number; conversations: number; instructions: number }
  conversation_rate_reviewed: number | null
  conversation_rate_contacted: number | null
  benchmark_assessment: string
  synthetic?: boolean
}
interface IndexIdentity { source_id: string; kind: string; category: string; unit?: string | null }
export interface IndicesResponse {
  series: Array<IndexIdentity & { scope: string; points: Array<{ window: string; period_start?: string; period_end?: string; value: number | null; published_at?: string; observed_at?: string; source_url?: string; record_id: string; observation_id: string; revision?: string }> }>
  coverage: Array<IndexIdentity & { windows: string[]; first_window: string; last_window: string; point_count: number }>
  suppressed_points: number
  suppressed: Array<IndexIdentity & { window: string; reason: string; record_id: string; observation_id?: string }>
  methodology: string
}

export interface EntityBrief { id: string; key: string; name: string; kind: string }
export interface EvidenceLineage { record_id?: string; observation_id?: string; relationship_id?: string; source_id?: string; source_url?: string }
export interface Matter { entity_id?: string | null; reference?: string | null }
export interface OpportunitiesResponse {
  project_exposures: Array<{ supplier: EntityBrief; project: EntityBrief; relationship_id: string; contract_id?: string; status: string; commercial_relevance: string; lineage: { insolvency: EvidenceLineage; project_role: EvidenceLineage } }>
  introduction_routes: Array<{ relationship_id: string; professional: EntityBrief; party: EntityBrief; professional_role: string; matter: Matter; status: string; reason: string; lineage: EvidenceLineage }>
  conflict_review_prompts: Array<{ professional: EntityBrief; parties: EntityBrief[]; matters: Matter[]; overlap: string; relationship_ids: string[]; status: string; prompt: string; lineages: EvidenceLineage[] }>
  totals: { project_exposures: number; introduction_routes: number; conflict_review_prompts: number }
  page: number
  page_size: number
  as_of: string
  truncated: boolean
  coverage: string
}
export interface TimingPreview { preview: CalendarEntry & { calculation: { accrual_date: string; selected_period_years: number; result_type: string }; legal_conclusion: false; review_required: true }; persisted: false; actionable: false }

export interface Alert { id: string; entity_id?: string | null; category: string; title: string; body: string; created_at: string; read_at?: string | null }
