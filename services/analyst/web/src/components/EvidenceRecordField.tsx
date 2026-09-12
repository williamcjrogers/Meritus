import type { EvidenceItem, ListResponse } from '../types'
import { useApi } from '../hooks/useApi'
import { DependencyState, SelectField, TextField } from './Ui'

export function EvidenceRecordField({ id, value, error, required = false, onChange }: { id: string; value: string; error?: string; required?: boolean; onChange: (recordId: string) => void }) {
  const evidence = useApi<ListResponse<EvidenceItem>>('/api/evidence?page_size=100')
  const records = new Map<string, EvidenceItem>()
  for (const item of evidence.data?.items ?? []) if (item.record_id && item.active !== false && !item.withdrawn && !records.has(item.record_id)) records.set(item.record_id, item)
  return <>
    <DependencyState label="source evidence list" loading={evidence.loading} error={evidence.error} onRetry={evidence.reload} />
    <SelectField id={`${id}-select`} label="Source evidence (recent records)" value={records.has(value) ? value : ''} onChange={event => onChange(event.target.value)} disabled={evidence.loading || Boolean(evidence.error)} hint="The list covers the latest 100 evidence observations. Enter an exact record ID below if the required record is not listed."><option value="">Select a source record</option>{Array.from(records.entries()).map(([recordId, item]) => <option key={recordId} value={recordId}>{item.title ?? item.headline ?? recordId} ({item.source_id ?? 'Source'})</option>)}</SelectField>
    <TextField id={id} label={`Source evidence record ID${required ? '' : ' (optional for provisional notes)'}`} value={value} onChange={event => onChange(event.target.value)} error={error} required={required} hint="Use a retained evidence record. Meritus verifies its identity, current permissions and availability before saving." />
  </>
}
