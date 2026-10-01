import type { Metadata } from "next";
import { SignupForm } from "@/features/auth/components/auth-forms";

export const metadata: Metadata = { title: "Hesap oluştur" };

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export default async function Page({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  return <SignupForm next={one(sp.next)} hata={one(sp.hata)} />;
}
