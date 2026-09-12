export const metadata = { title: "Evidence details" };
import { ResearchWorkspace } from '@/components/portal/research/ResearchWorkspace';
export default async function Page({params}:{params:Promise<{id:string}>}){return <ResearchWorkspace mode="evidence" id={(await params).id}/>;}
