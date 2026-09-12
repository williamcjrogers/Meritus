'use client';
import { useCallback, useEffect, useState } from 'react';
import { ActionForm, DataTable, api, date, dateTime, nullable, value, type Row } from './ResearchControls';

export function ResearchDecisions({ signalId, revision, directors, onSaved }: { signalId: string; revision: number; directors: Row[]; onSaved?: () => Promise<unknown> }) {
  const [decisions, setDecisions] = useState<Row[]>([]);
  const [signals, setSignals] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([api<Row[]>(`/api/portal/research/signals/${signalId}/decisions`), api<Row[]>('/api/portal/research/signals')]);
      setDecisions(d); setSignals(s); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Decisions unavailable'); }
  }, [signalId]);
  useEffect(() => { void load(); }, [load]);
  const current = signals.find(s => s.id === signalId);
  return <details className="rounded border border-ink/15 p-4">
    <summary className="cursor-pointer font-medium">Assignment, notes and event equivalence</summary>
    <div className="space-y-4 pt-4">
      {error && <p role="alert">{error}</p>}
      <ActionForm title="Record a director decision" fields={[
        { name: 'action', label: 'Decision', type: 'select', required: true, options: ['annotate', 'assign', 'revisit', 'merge'].map(v => ({ value: v, label: v === 'merge' ? 'Link equivalent underlying event' : v })) },
        { name: 'note', label: 'Reason or note', type: 'textarea', required: true },
        { name: 'ownerId', label: 'Director owner (assignment)', type: 'select', options: directors.map(d => ({ value: String(d.id), label: String(d.name) })) },
        { name: 'revisitAt', label: 'Revisit date and time', type: 'datetime-local' },
        { name: 'relatedSignalId', label: 'Equivalent event for the same identity', type: 'select', options: signals.filter(s => s.id !== signalId && s.entity_id === current?.entity_id && s.available).map(s => ({ value: String(s.id), label: String(s.event_type) })) },
      ]} submit={async v => {
        await api(`/api/portal/research/signals/${signalId}/decisions`, { revision: Number(current?.revision ?? revision), action: value(v, 'action'), note: value(v, 'note'), ownerId: nullable(v, 'ownerId'), revisitAt: dateTime(v, 'revisitAt'), relatedSignalId: nullable(v, 'relatedSignalId') });
        await load(); await onSaved?.();
      }} />
      <p className="text-xs text-ink/65">Linking equivalent events removes duplicate corroboration and requires fresh review. Notes remain connected to the supporting source versions.</p>
      <DataTable rows={decisions} columns={[{ key: 'action', title: 'Decision' }, { key: 'note', title: 'Reason' }, { key: 'owner_id', title: 'Assigned director', render: d => directors.find(x => x.id === d.owner_id)?.name as string ?? String(d.owner_id ?? 'Not assigned') }, { key: 'revisit_at', title: 'Revisit', render: d => date(d.revisit_at) }, { key: 'created_at', title: 'Recorded', render: d => date(d.created_at) }]} />
    </div>
  </details>;
}
