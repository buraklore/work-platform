"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { siteConfig } from "@/config/site";
import type { InvitePreview } from "@/features/workspaces/types";
import { api } from "@/lib/api/client";
import { useErrorText } from "@/lib/client/errors";
import { useState } from "react";
import { TermsConsent } from "@/features/auth/components/terms-consent";

export function InviteAccept({ token, signedIn, needsTerms }: { token: string; signedIn: boolean; needsTerms: boolean }) {
  const t = useTranslations("join");
  const ts = useTranslations("settings");
  const router = useRouter();
  const errorText = useErrorText();
  const validToken = /^[A-Za-z0-9_-]{20,64}$/.test(token);
  const preview = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => api<InvitePreview>("/invites/preview", { method: "POST", body: { token } }),
    enabled: signedIn && validToken,
    retry: false,
  });
  const [terms, setTerms] = useState(false);
  const accept = useMutation({
    mutationFn: async () => {
      if (needsTerms) await api("/me", { method: "PATCH", body: { acceptTerms: true } });
      return api<{ slug: string }>("/invites/accept", { method: "POST", body: { token } });
    },
    onSuccess: ({ slug }) => router.replace(`/w/${slug}`),
  });
  const next = encodeURIComponent(`/davet/${token}`);
  const roleName = (r: InvitePreview["role"]) => (r === "guest" ? ts("roleGuest") : r === "admin" ? ts("roleAdmin") : ts("roleMember"));

  let body: React.ReactNode;
  if (!validToken) {
    body = <p className="mt-3 text-muted">{t("invalid")}</p>;
  } else if (!signedIn) {
    body = (
      <>
        <p className="mt-3 text-muted">{t("signedOut")}</p>
        <div className="mt-6 flex gap-2">
          <Button asChild size="lg">
            <Link href={`/kayit?next=${next}`}>{t("signup")}</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={`/giris?next=${next}`}>{t("login")}</Link>
          </Button>
        </div>
      </>
    );
  } else if (preview.isLoading) {
    body = <Skeleton className="mt-4 h-20 w-full" />;
  } else {
    const p = preview.data;
    const state = p?.state ?? "invalid";
    body =
      state === "valid" ? (
        <>
          <p className="mt-3 text-muted">{t("from", { inviter: p?.inviterName || "—", role: roleName(p?.role ?? "member") })}</p>
          {accept.error ? <p className="mt-3 text-sm text-danger">{errorText(accept.error)}</p> : null}
          {needsTerms ? (
            <div className="mt-6">
              <TermsConsent checked={terms} onChange={setTerms} />
            </div>
          ) : null}
          <Button size="lg" className="mt-6" onClick={() => accept.mutate()} disabled={accept.isPending || (needsTerms && !terms)}>
            {accept.isPending ? t("joining") : t("join")}
          </Button>
        </>
      ) : state === "already_member" && p?.workspaceSlug ? (
        <>
          <p className="mt-3 text-muted">{t("already_member")}</p>
          <Button asChild size="lg" className="mt-6">
            <Link href={`/w/${p.workspaceSlug}`}>{t("goToWorkspace")}</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="mt-3 text-muted">{t(state === "already_member" ? "invalid" : state)}</p>
          <Button asChild variant="secondary" className="mt-6">
            <Link href="/">{t("goHome")}</Link>
          </Button>
        </>
      );
  }

  const title = preview.data?.workspaceName && preview.data.state === "valid" ? t("titleNamed", { workspace: preview.data.workspaceName }) : t("title");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-10">
      <span className="font-display text-lg font-bold tracking-tight">{siteConfig.name}</span>
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {body}
      </div>
    </div>
  );
}
