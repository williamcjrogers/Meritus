import { requireResearchDirector } from '@/lib/research/roles';
export const dynamic='force-dynamic';
export default async function ResearchLayout({children}:{children:React.ReactNode}){await requireResearchDirector();return children;}
