export const metadata = { title: "Investigation details" };
import { ResearchWorkspace } from '@/components/portal/research/ResearchWorkspace';
import { RelatedActionPanel } from '@/components/portal/actions/RelatedActionPanel';
import { requireWorkspacePage } from '@/lib/portal/auth';
import { getInvestigation, WorkflowError } from '@/lib/db/research-workflow';
import { notFound } from 'next/navigation';
import { z } from 'zod';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireWorkspacePage("/portal/research/investigations");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  try { await getInvestigation(id); }
  catch (error) { if (error instanceof WorkflowError && error.status === 404) notFound(); throw error; }
  return <><ResearchWorkspace mode="investigation" id={id} /><RelatedActionPanel link={{ kind: 'investigation', id }} /></>;
}
