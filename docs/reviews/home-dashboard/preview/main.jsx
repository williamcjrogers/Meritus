import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {HomeDashboard} from '@/components/portal/dashboard/HomeDashboard';
import {ActionRegister} from '@/components/portal/actions/ActionRegister';
import {parseActionQuery} from '@/lib/actions/filters';
import {PortalNavigation} from '@/components/portal/PortalNavigation';
import {dashboardFixture,records,directory,today} from './fixtures.js';
import '@/styles/globals.css';
import './preview.css';
function Preview(){const [revision,refresh]=useState(0);useEffect(()=>{const update=()=>refresh(v=>v+1);window.addEventListener('preview-refresh',update);return()=>window.removeEventListener('preview-refresh',update)},[]);const url=new URL(window.location.href);const view=dashboardFixture(url.searchParams.get('scenario')||'busy',url.searchParams.get('scope')||'team');const query=parseActionQuery(url.searchParams);const open=a=>['todo','in_progress','waiting'].includes(a.state);const matches=a=>{
if(query.scope==='mine'&&a.ownerId!=='user_wr')return false;
if(query.ownerId!==undefined&&a.ownerId!==query.ownerId)return false;
if(query.state&&a.state!==query.state)return false;
if(query.link&&(a.link.kind!==query.link.kind||(query.link.kind!=='general'&&a.link.id!==query.link.id)))return false;
return query.filter==='all'||query.filter==='open'&&open(a)||query.filter==='overdue'&&open(a)&&a.dueDate&&a.dueDate<today||query.filter==='today'&&open(a)&&a.dueDate===today||query.filter==='upcoming'&&open(a)&&a.dueDate>today&&a.dueDate<='2026-09-19'||query.filter==='unassigned'&&open(a)&&!a.ownerId||query.filter==='undated'&&open(a)&&!a.dueDate||query.filter==='completed_recent'&&a.state==='completed';
};const filtered=records.filter(matches);return <div className="portal min-h-screen bg-cream text-ink"><PortalNavigation /><div className="lg:pl-56"><div className="preview-note">Synthetic local preview. No production data or writes.</div><main id="main-content" className="px-4 py-6 lg:px-10 lg:py-10">{url.pathname==='/portal/actions'?<ActionRegister key={revision+url.search} rows={filtered.slice((query.page-1)*50,query.page*50)} total={filtered.length} query={query} directory={directory} now={view.refreshedAt} initialAction={records.find(a=>a.id===url.searchParams.get('edit'))||null}/>:<HomeDashboard key={revision} view={view}/>}</main></div></div>}
createRoot(document.getElementById('root')).render(<Preview/>);
