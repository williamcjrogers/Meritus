import type { EvidenceItem } from '../types'
import { sentence } from '../format'

const noticeKeys = ['attribution', 'distribution_conditions', 'redistribution_conditions'] as const

function noticeText(permissions: Record<string, unknown> = {}): string[] {
  return [...new Set(noticeKeys.flatMap(key => {
    const value = permissions[key]
    const values: unknown[] = Array.isArray(value) ? value : [value]
    return values.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  }))]
}

export function SourceLicenceNotice({ source, permissions }: { source: string; permissions?: Record<string, unknown> }) {
  const conditions = noticeText(permissions)
  return conditions.length ? <div className="notice licence-notice" role="note" aria-label={`${source} licence conditions`}>
    <strong>{source}: licence and coverage</strong>
    {conditions.map(condition => <p key={condition}>{condition}</p>)}
  </div> : null
}

export function EvidenceLicenceNotices({ items }: { items: EvidenceItem[] }) {
  const sources = new Map<string, { name: string; conditions: Set<string> }>()
  for (const item of items) {
    const conditions = noticeText(item.source_permissions)
    if (!conditions.length) continue
    const key = item.source_id ?? item.source_name ?? item.id
    const source = sources.get(key) ?? { name: item.source_name ?? sentence(item.source_id ?? 'Source'), conditions: new Set<string>() }
    conditions.forEach(condition => source.conditions.add(condition))
    sources.set(key, source)
  }
  return <>{[...sources].map(([key, source]) => <SourceLicenceNotice key={key} source={source.name} permissions={{ distribution_conditions: [...source.conditions] }} />)}</>
}
