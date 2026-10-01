import type { Metadata } from "next";
import { ForgotForm } from "@/features/auth/components/auth-forms";

export const metadata: Metadata = { title: "Şifremi unuttum" };

export default function Page() {
  return <ForgotForm />;
}
