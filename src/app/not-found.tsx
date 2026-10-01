import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="flex min-h-[70dvh] flex-col items-start justify-center px-8 md:px-16">
      <p className="font-display text-6xl font-bold tracking-tight text-line-strong">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 max-w-md text-muted">{t("body")}</p>
      <Button asChild className="mt-6">
        <Link href="/">{t("cta")}</Link>
      </Button>
    </main>
  );
}
