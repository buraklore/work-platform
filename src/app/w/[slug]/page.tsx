import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { requireSession } from "@/lib/auth/session";
import { qk } from "@/lib/client/keys";
import { HomeView } from "@/features/home/home-view";
import { myTasks } from "@/features/tasks/server/service";
import { getWorkspaceBySlug } from "@/features/workspaces/server/service";

export default async function HomePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const ctx = await requireSession(`/w/${slug}`);
  const ws = await getWorkspaceBySlug(ctx, slug);
  const qc = new QueryClient();
  await qc.prefetchQuery({ queryKey: qk.myTasks(ws.id), queryFn: () => myTasks(ctx, ws.id) });
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <HomeView welcome={sp.hosgeldin === "1"} />
    </HydrationBoundary>
  );
}
