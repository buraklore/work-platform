import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getMe } from "@/features/workspaces/server/service";

/** Entry point: send people to their last workspace, or to first-run setup. */
export default async function RootPage() {
  const ctx = await requireSession();
  const me = await getMe(ctx);
  if (me.workspaces.length === 0) redirect("/baslangic");
  const target = me.workspaces.find((w) => w.id === me.lastWorkspaceId) ?? me.workspaces[0]!;
  redirect(`/w/${target.slug}`);
}
