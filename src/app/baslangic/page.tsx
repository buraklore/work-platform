import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";
import { getMe } from "@/features/workspaces/server/service";

export const metadata: Metadata = { title: "Başlangıç" };

export default async function OnboardingPage() {
  const ctx = await requireSession("/baslangic");
  const me = await getMe(ctx);
  // Already in a workspace (e.g. joined via an invite): no setup needed.
  if (me.workspaces.length > 0) redirect(`/w/${me.workspaces[0]!.slug}`);
  return <OnboardingFlow initialName={me.fullName} needsTerms={!me.termsAccepted} />;
}
