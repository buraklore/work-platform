import type { Metadata } from "next";
import { optionalSession } from "@/lib/auth/session";
import { getMe } from "@/features/workspaces/server/service";
import { InviteAccept } from "@/features/onboarding/invite-accept";

export const metadata: Metadata = { title: "Davet", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await optionalSession();
  const me = session ? await getMe(session).catch(() => null) : null;
  return <InviteAccept token={token} signedIn={Boolean(session)} needsTerms={Boolean(me && !me.termsAccepted)} />;
}
