import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { AppError } from "@/lib/api/errors";
import { requireSession } from "@/lib/auth/session";
import { qk } from "@/lib/client/keys";
import { listMembers } from "@/features/members/server/service";
import { listProjects } from "@/features/projects/server/service";
import { WorkspaceProvider } from "@/features/workspaces/context";
import { getMe, getWorkspaceBySlug } from "@/features/workspaces/server/service";

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireSession(`/w/${slug}`);
  const workspace = await getWorkspaceBySlug(ctx, slug).catch((err) => {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  });

  // Prefetch what every screen needs; the client hydrates without a loading flash.
  const qc = new QueryClient();
  await Promise.all([
    qc.prefetchQuery({ queryKey: qk.me, queryFn: () => getMe(ctx) }),
    qc.prefetchQuery({ queryKey: qk.projects(workspace.id), queryFn: () => listProjects(ctx, workspace.id) }),
    qc.prefetchQuery({ queryKey: qk.members(workspace.id), queryFn: () => listMembers(ctx, workspace.id) }),
  ]);

  return (
    <WorkspaceProvider workspace={workspace}>
      <HydrationBoundary state={dehydrate(qc)}>
        <AppShell>{children}</AppShell>
      </HydrationBoundary>
    </WorkspaceProvider>
  );
}
