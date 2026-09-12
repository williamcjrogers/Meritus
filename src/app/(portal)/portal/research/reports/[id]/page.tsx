export const metadata = { title: "Report details" };
import { ResearchWorkspace } from '@/components/portal/research/ResearchWorkspace';
export default async function Page({params}:{params:Promise<{id:string}>}){return <ResearchWorkspace mode="report" id={(await params).id}/>;}
