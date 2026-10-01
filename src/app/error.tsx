"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[70dvh] flex-col items-start justify-center px-8 md:px-16">
      <h1 className="font-display text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 max-w-md text-muted">{t("body")}</p>
      {error.digest ? <code className="mt-3 rounded bg-raised px-2 py-1 text-sm text-muted">{error.digest}</code> : null}
      <Button className="mt-6" onClick={reset}>
        {t("cta")}
      </Button>
    </main>
  );
}
