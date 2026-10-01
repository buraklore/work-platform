import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/auth-forms";

export const metadata: Metadata = { title: "Giriş yap" };

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export default async function Page({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  return <LoginForm next={one(sp.next)} hata={one(sp.hata)} />;
}
