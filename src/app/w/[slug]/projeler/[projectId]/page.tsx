import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/api/errors";
import { requireSession } from "@/lib/auth/session";
import { qk } from "@/lib/client/keys";
import { zUuid } from "@/lib/validation/common";
import { ProjectView } from "@/features/projects/components/project-view";
import { getProject } from "@/features/projects/server/service";
import { listProjectTasks } from "@/features/tasks/server/service";
import { getWorkspaceBySlug } from "@/features/workspaces/server/service";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string; projectId: string }> }) {
  const { slug, projectId } = await params;
  if (!zUuid.safeParse(projectId).success) notFound();
  const ctx = await requireSession(`/w/${slug}/projeler/${projectId}`);
  const ws = await getWorkspaceBySlug(ctx, slug);
  const qc = new QueryClient();
  try {
    const project = await getProject(ctx, projectId);
    if (project.workspaceId !== ws.id) notFound();
    qc.setQueryData(qk.project(projectId), project);
    await qc.prefetchQuery({ queryKey: qk.projectTasks(projectId), queryFn: () => listProjectTasks(ctx, projectId) });
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <ProjectView projectId={projectId} />
    </HydrationBoundary>
  );
}
