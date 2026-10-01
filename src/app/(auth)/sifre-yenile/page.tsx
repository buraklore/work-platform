import type { Metadata } from "next";
import { optionalSession } from "@/lib/auth/session";
import { NewPasswordForm } from "@/features/auth/components/auth-forms";

export const metadata: Metadata = { title: "Yeni şifre" };

export default async function Page() {
  const session = await optionalSession();
  return <NewPasswordForm hasSession={Boolean(session)} />;
}
