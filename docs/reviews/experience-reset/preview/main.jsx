import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './mock-api';
import { HomeDashboard } from '@/components/portal/dashboard/HomeDashboard';
import { ActionRegister } from '@/components/portal/actions/ActionRegister';
import { ResearchDesk } from '@/components/portal/research/ResearchDesk';
import { PortalNavigation } from '@/components/portal/PortalNavigation';
import { AccessForm } from '@/components/access/AccessForm';
import { ClientDocumentsView } from '@/components/client/ClientDocumentsView';
import { AccessShell } from '@/components/access/AccessShell';
import ClientLayout from '@/app/client/layout';
import { PursuitShell } from '@/components/portal/PursuitShell';
import { ProgrammeUpload } from '@/components/portal/ProgrammeUpload';
import { ProgrammeReportView } from '@/components/portal/ProgrammeReportView';
import { ProspectsTable } from '@/components/portal/ProspectsTable';
import { FileList } from '@/components/portal/FileList';
import { ClientDomainForm } from '@/components/portal/ClientDomainForm';
import { Board } from '@/components/portal/Board';
import { NewPursuitButton } from '@/components/portal/NewPursuitButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { ToastProvider } from '@/components/ui/Toast';
import { pursuitFixture } from '@/lib/portal/live-lead-fixtures.test-support';
import { parseActionQuery } from '@/lib/actions/filters';
import { dashboardFixture, records, directory, today, updateRecord } from './fixtures';
import '@/styles/globals.css';
import './preview.css';

for (const row of records) if (row.title.includes('director')) updateRecord({ ...row, title: row.title.replace('director', 'team') });

function Preview() {
  const [revision, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    window.addEventListener('preview-refresh', update);
    return () => window.removeEventListener('preview-refresh', update);
  }, []);
  const url = new URL(window.location.href);
  const view = dashboardFixture(url.searchParams.get('scenario') || 'busy', url.searchParams.get('scope') || 'team');
  const query = parseActionQuery(url.searchParams);
  const open = action => ['todo', 'in_progress', 'waiting'].includes(action.state);
  const filtered = records.filter(action => {
    if (query.scope === 'mine' && action.ownerId !== 'user_wr') return false;
    if (query.ownerId !== undefined && action.ownerId !== query.ownerId) return false;
    if (query.state && action.state !== query.state) return false;
    if (query.link && (action.link.kind !== query.link.kind || (query.link.kind !== 'general' && action.link.id !== query.link.id))) return false;
    return query.filter === 'all' || query.filter === 'open' && open(action) || query.filter === 'overdue' && open(action) && action.dueDate && action.dueDate < today || query.filter === 'today' && open(action) && action.dueDate === today || query.filter === 'upcoming' && open(action) && action.dueDate > today && action.dueDate <= '2026-09-19' || query.filter === 'unassigned' && open(action) && !action.ownerId || query.filter === 'undated' && open(action) && !action.dueDate || query.filter === 'completed_recent' && action.state === 'completed';
  });
  let content = <HomeDashboard key={revision} view={view} />;
  if (url.pathname === '/portal/actions') content = <ActionRegister key={revision + url.search} rows={filtered.slice((query.page - 1) * 50, query.page * 50)} total={filtered.length} query={query} directory={directory} now={view.refreshedAt} initialAction={records.find(action => action.id === url.searchParams.get('edit')) || null} />;
  if (url.pathname === '/portal/research') content = <ResearchDesk />;
  if (url.pathname === '/portal/pursuits') content = <><PageHeader title="Pursuits" description="Develop enquiries, agree the next step and follow each lead through to an instruction." actions={<NewPursuitButton />} /><Board columns={Object.fromEntries(['enquiry','scoping','proposal'].map((stage,index)=>[stage,[{pursuit:pursuitFixture({id:stage,firm:['Example Construction','Sample Infrastructure','Example Housing'][index],stage,contactEmail:'alex@example.test',ownerId:'user_wr'}),nextAction:null,reviewDue:null}]]))} counts={{enquiry:1,scoping:1,proposal:1}} directors={[{id:'user_wr',name:'William Rogers',email:'william@example.test',initials:'WR'}]} now={new Date('2026-09-12T10:30:00Z')} onMove={async()=>({ok:false,error:'This illustrative preview does not save changes.'})} /></>;
  if (url.pathname.startsWith('/portal/pursuits/')) content = <PursuitShell pursuit={pursuitFixture({firm:'Example Construction',contactName:'Alex Example',contactEmail:'alex@example.test',summary:'Review the programme and supporting cost records for the proposed appointment.'})} directors={[{id:'user_wr',name:'William Rogers',email:'william@example.test',initials:'WR'}]} userId="user_wr" related={[]} latestChange={null} activity={[]} documents={[]} briefState={{latestRun:null,brief:null}} questions={[]} programmes={[]} actions={[]} nextAction={null} directoryAvailable now="2026-09-12T10:30:00Z" />;
  if (url.pathname === '/portal/prospects') content = <><PageHeader title="Prospects" description="Identify an organisation and record the next approach." /><ProspectsTable rows={[]} /></>;
  if (url.pathname === '/portal/clients') content = <><PageHeader title="Client documents" description="Manage organisation access and link submissions to the relevant pursuit." /><div className="app-panel p-6"><ClientDomainForm pursuits={[{id:'p1',firm:'Example Construction',stage:'enquiry'}]} /></div></>;
  if (url.pathname === '/portal/library') content = <div className="max-w-3xl"><PageHeader title="Library" description="Shared firm documents. Pursuit records remain with their pursuit; instructed evidence stays in VeriCase." /><div className="app-panel bg-surface border border-line p-6"><FileList documents={[]} uploadUrl="/api/portal/library" /></div></div>;
  if (url.pathname === '/portal/programmes') content = <div className="max-w-4xl"><PageHeader title="Programmes" description="Review programme records, assess schedule quality and examine delay. Upload XML or CSV for activity-level analysis; native Asta files can be inspected." /><div className="app-panel mb-8 border border-line bg-surface p-6"><ProgrammeUpload /></div><p>No programmes yet.</p></div>;
  if (url.pathname.startsWith('/portal/programmes/')) content = <><PageHeader title="Programme review" description="gantt.pdf" /><ProgrammeReportView detail={{id:'prog-1',fileName:'gantt.pdf',format:'pdf',parseStatus:'partial',parseEngine:'meritus_pdf_markup_v1',parseConfidence:15,issueCount:1,highIssues:1,activityCount:0,createdAt:'2026-09-11T12:00:00Z',issues:[{code:'pdf_not_schedule_evidence',severity:'high',title:'PDF is mark-up, not a schedule',detail:'Float is not computed from a Gantt PDF.'}],report:null,reportBody:null}} /></>;
  if (url.pathname === '/access') return <><FixtureNotice /><AccessShell title="Send documents" description="Enter your work email to request a secure link to your organisation’s documents."><AccessForm /></AccessShell></>;
  if (url.pathname === '/client') return <><FixtureNotice /><ClientLayout><ClientDocumentsView organisation="Example Construction" email="william@example.test" receipts={url.searchParams.get('scenario') === 'empty' ? [] : [{ id: 'receipt-1', title: 'September progress assessment.pdf', size: 285440, createdAt: '2026-09-12T10:00:00Z', uploaderEmail: 'william@example.test' }, { id: 'receipt-2', title: 'Programme update.xlsx', size: 145810, createdAt: '2026-09-11T14:00:00Z', uploaderEmail: 'colleague@example.test' }]} /></ClientLayout></>;
  return <div className="workspace-shell"><PortalNavigation clerk director={{ name: 'William Rogers', initials: 'WR' }} /><div className="workspace-body"><FixtureNotice /><main id="main-content" className="workspace-main">{content}</main></div></div>;
}
function FixtureNotice() { return <p className="fixture-notice">Component verification with illustrative data. No live accounts, messages or writes.</p>; }
createRoot(document.getElementById('root')).render(<ToastProvider><Preview /></ToastProvider>);
