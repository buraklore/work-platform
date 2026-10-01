import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { qk } from "@/lib/client/keys";
import { MyTasksView } from "@/features/tasks/components/my-tasks-view";
import { myTasks } from "@/features/tasks/server/service";
import { getWorkspaceBySlug } from "@/features/workspaces/server/service";

export const metadata: Metadata = { title: "Görevlerim" };

export default async function MyTasksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireSession(`/w/${slug}/gorevlerim`);
  const ws = await getWorkspaceBySlug(ctx, slug);
  const qc = new QueryClient();
  await qc.prefetchQuery({ queryKey: qk.myTasks(ws.id), queryFn: () => myTasks(ctx, ws.id) });
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <MyTasksView />
    </HydrationBoundary>
  );
}
