import { ResearchWorkspace } from '@/components/portal/research/ResearchWorkspace';
export default async function Page({params}:{params:Promise<{id:string}>}){return <ResearchWorkspace mode="investigation" id={(await params).id}/>;}
