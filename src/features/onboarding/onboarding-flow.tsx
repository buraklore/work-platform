"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { siteConfig } from "@/config/site";
import { USE_CASES, type UseCase, type WorkspaceSummary } from "@/features/workspaces/types";
import { api } from "@/lib/api/client";
import { useErrorText } from "@/lib/client/errors";
import { cn } from "@/lib/utils";
import { TermsConsent } from "@/features/auth/components/terms-consent";

export function OnboardingFlow({ initialName, needsTerms }: { initialName: string; needsTerms: boolean }) {
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const ti = useTranslations("invite");
  const ta = useTranslations("auth");
  const ts = useTranslations("settings");
  const router = useRouter();
  const errorText = useErrorText();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(initialName);
  const [terms, setTerms] = useState(false);
  const tf = useTranslations("errors.fields");
  const [wsName, setWsName] = useState("");
  const [useCase, setUseCase] = useState<UseCase | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const finish = () =>
    run(async () => {
      await api("/me", { method: "PATCH", body: { onboardingCompleted: true } });
      router.replace(`/w/${workspace!.slug}?hosgeldin=1`);
    });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-10">
      <span className="font-display text-lg font-bold tracking-tight">{siteConfig.name}</span>
      <div className="flex flex-1 flex-col justify-center py-10">
        <p className="text-sm text-faint">{t("stepOf", { step, total: 3 })}</p>
        <div className="mt-2 flex gap-1" aria-hidden>
          {[1, 2, 3].map((s) => (
            <span key={s} className={cn("h-1 flex-1 rounded-full", s <= step ? "bg-accent" : "bg-raised")} />
          ))}
        </div>

        {step === 1 ? (
          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              if (needsTerms && !terms) {
                setError(tf("terms"));
                return;
              }
              void run(async () => {
                await api("/me", { method: "PATCH", body: { fullName: name.trim(), ...(needsTerms ? { acceptTerms: true } : {}) } });
                setStep(2);
              });
            }}
          >
            <h1 className="font-display text-3xl font-semibold tracking-tight">{t("nameTitle")}</h1>
            <Field label={ta("fullName")} htmlFor="ob-name" error={error}>
              <Input id="ob-name" autoFocus autoComplete="name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </Field>
            {needsTerms ? <TermsConsent checked={terms} onChange={setTerms} /> : null}
            <Button type="submit" size="lg" className="w-full" disabled={!name.trim() || busy}>
              {tc("continue")}
            </Button>
          </form>
        ) : null}

        {step === 2 ? (
          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!wsName.trim()) return;
              void run(async () => {
                const ws = await api<WorkspaceSummary>("/workspaces", { method: "POST", body: { name: wsName.trim(), useCase } });
                setWorkspace(ws);
                setStep(3);
                const invite = await api<{ url: string }>(`/workspaces/${ws.id}/invite-links`, {
                  method: "POST",
                  body: { role: "member", expiresInDays: "7", maxUses: null },
                }).catch(() => null);
                setLink(invite?.url ?? null);
              });
            }}
          >
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">{t("workspaceTitle")}</h1>
              <p className="mt-2 text-muted">{t("workspaceBody")}</p>
            </div>
            <Field label={ts("workspaceName")} htmlFor="ob-ws" error={error}>
              <Input id="ob-ws" autoFocus value={wsName} maxLength={80} placeholder={t("workspacePlaceholder")} onChange={(e) => setWsName(e.target.value)} />
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t("useCaseTitle")}</legend>
              <div className="flex flex-wrap gap-1.5">
                {USE_CASES.map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={useCase === u}
                    onClick={() => setUseCase(useCase === u ? null : u)}
                    className={cn("h-8 rounded-md border px-3 text-sm", useCase === u ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-fg")}
                  >
                    {t(`useCase.${u}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            <Button type="submit" size="lg" className="w-full" disabled={!wsName.trim() || busy}>
              {busy ? t("creating") : tc("continue")}
            </Button>
          </form>
        ) : null}

        {step === 3 ? (
          <div className="mt-8 space-y-5">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">{t("inviteTitle")}</h1>
              <p className="mt-2 text-muted">{t("inviteBody")}</p>
            </div>
            {link ? (
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface p-2 pl-3">
                <code className="min-w-0 flex-1 truncate text-sm">{link}</code>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard.writeText(link);
                    toast(ti("copied"));
                  }}
                >
                  <Copy />
                  {ti("copy")}
                </Button>
              </div>
            ) : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button size="lg" className="w-full" onClick={finish} disabled={busy}>
              {t("finish")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
