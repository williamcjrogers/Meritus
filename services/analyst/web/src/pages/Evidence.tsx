import { Link, useSearchParams } from 'react-router-dom'
import type { EvidenceItem, ListResponse } from '../types'
import { useApi } from '../hooks/useApi'
import { usePageTitle } from '../hooks/usePageTitle'
import { EvidencePair, Page, StatePanel, Status, TableFrame } from '../components/Ui'
import { formatDateTime } from '../format'
import { EvidenceLicenceNotices } from '../components/SourceLicenceNotice'

export default function Evidence() {
  usePageTitle('Evidence'); const [params] = useSearchParams(); const entity = params.get('entity_id'); const { data, loading, error, reload } = useApi<ListResponse<EvidenceItem>>(`/api/evidence${entity ? `?entity_id=${encodeURIComponent(entity)}` : ''}`)
  return <Page title="Evidence" eyebrow={entity ? 'Entity evidence' : 'Source records'}>{loading && !data ? <StatePanel state="loading" /> : error ? <StatePanel state="error" message={error} onRetry={reload} /> : !data?.items.length ? <StatePanel state="empty" title="No evidence records" message="Run an enabled source or import reviewed evidence to populate this register." /> : <><EvidenceLicenceNotices items={data.items} /><TableFrame label="Evidence register" range={`Showing ${data.items.length} API records`}><table><thead><tr><th scope="col">Evidence pair</th><th scope="col">Entity</th><th scope="col">State</th><th scope="col">Observed</th><th scope="col">Source access</th></tr></thead><tbody>{data.items.map(item => <tr key={item.id}><td><EvidencePair source={item.source_id ?? 'Source'} event={item.kind ?? 'Record'} title={item.headline ?? item.title ?? 'Evidence record'} href={item.source_url} /></td><td>{item.entity_id ? <Link to={`/entities/${item.entity_id}`}>{item.entity_name ?? 'Open entity'}</Link> : 'Unlinked'}</td><td><Status value={item.withdrawn ? 'withdrawn' : item.active === false ? 'inactive' : item.state ?? 'pending'} /></td><td>{formatDateTime(item.observed_at)}</td><td>{item.rights ?? 'Follow source licence'}</td></tr>)}</tbody></table></TableFrame></>}</Page>
}
