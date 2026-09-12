import { requireWorkspacePage } from '@/lib/portal/auth';
export const dynamic='force-dynamic';
export default async function ResearchLayout({children}:{children:React.ReactNode}){await requireWorkspacePage("/portal/research");return children;}
