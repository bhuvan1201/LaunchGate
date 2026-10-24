export type RunReport = {
  status: string; revisionId: number; startedAt?: string; completedAt?: string;
  executionId?: string; summary?: string; evidencePack?: string; evidenceLogs: string[];
  checks?: { name: string; status: string; failure?: string }[];
};

export function evidenceStatus(report: RunReport | null, revisionId: number, authorized: boolean) {
  if (!report) return { label: 'Not verified yet', tone: 'neutral', detail: 'No app-managed verification report is saved for this candidate.' };
  if (report.revisionId !== revisionId) return { label: 'Different revision', tone: 'warning', detail: 'This report does not verify the promotion currently being previewed.' };
  if (report.status === 'running') return { label: 'Live run in progress', tone: 'live', detail: 'Results below are still arriving. This is not a completed verification.' };
  if (report.status === 'passed' && authorized) return { label: 'Saved passing report', tone: 'passed', detail: 'Completed evidence matches this confirmed revision, app build and reviewed suite.' };
  if (report.status === 'passed') return { label: 'Fresh verification required', tone: 'warning', detail: 'The saved run passed, but it no longer authorizes this launch. Review the launch gate below.' };
  return { label: 'Saved incomplete or failed run', tone: 'failed', detail: 'This run does not provide passing launch evidence.' };
}
