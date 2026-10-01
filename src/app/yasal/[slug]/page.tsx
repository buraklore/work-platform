import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { siteConfig } from "@/config/site";

const PAGES = { kvkk: "privacyTitle", "kullanim-kosullari": "termsTitle" } as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const key = PAGES[(await params).slug as keyof typeof PAGES];
  const t = await getTranslations("legal");
  return { title: key ? t(key) : undefined, robots: { index: false } };
}

/**
 * Legal pages. The final texts must be written by a lawyer before launch (M3); until
 * then this page states that plainly instead of shipping invented legal language.
 */
export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const key = PAGES[slug as keyof typeof PAGES];
  if (!key) notFound();
  const t = await getTranslations("legal");
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="font-display text-lg font-bold">{siteConfig.name}</p>
      <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">{t(key)}</h1>
      <p className="mt-6 rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-warn">{t("draftNotice")}</p>
    </main>
  );
}
