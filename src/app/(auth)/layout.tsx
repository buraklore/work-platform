import { getTranslations } from "next-intl/server";
import { siteConfig } from "@/config/site";

/** Auth screens: a quiet form column, and on wide screens the one thing the product does best. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("home");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <span className="font-display text-lg font-bold tracking-tight">{siteConfig.name}</span>
        <div className="flex flex-1 items-center">
          <div className="w-full max-w-sm py-10">{children}</div>
        </div>
      </div>
      <aside aria-hidden className="hidden flex-col justify-center border-l border-line bg-surface px-14 lg:flex">
        <p className="max-w-md font-display text-3xl font-semibold leading-tight tracking-tight">{t("emptyTitle")}</p>
        <div className="mt-8 max-w-md rounded-xl border border-line bg-bg p-4 shadow-pop">
          <p className="text-lg">
            <mark className="parse-mark rounded-[3px] bg-accent-soft px-0.5 text-accent">Yarın 14&apos;te</mark>{" "}
            <mark className="parse-mark rounded-[3px] bg-done-soft px-0.5 text-done">Ayşe&apos;ye</mark> raporu hazırlat
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-sm">
            <span className="rounded-md bg-accent-soft px-2 py-1 text-accent">Yarın 14:00</span>
            <span className="rounded-md bg-done-soft px-2 py-1 text-done">Ayşe</span>
            <span className="rounded-md bg-raised px-2 py-1">Raporu hazırla</span>
          </div>
        </div>
        <p className="mt-6 max-w-md text-muted">{t("emptyBody")}</p>
      </aside>
    </div>
  );
}
