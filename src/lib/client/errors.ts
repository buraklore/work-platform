"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";

/** Turns any thrown error into one Turkish sentence that says what happened. */
export function useErrorText() {
  const t = useTranslations("errors");
  return useCallback(
    (err: unknown): string => {
      if (!(err instanceof ApiError)) return t("generic");
      const detail = (key: string) => (t.has(key) ? t(key) : null);
      if (err.code === "limit") return detail(`limit.${String(err.details?.limit)}`) ?? t("generic");
      if (err.code === "invite") return detail(`invite.${String(err.details?.reason)}`) ?? t("invite.invalid");
      if (err.code === "auth") return detail(`auth.${err.message}`) ?? t("auth.auth_failed");
      if (err.code === "validation" && detail(err.message)) return t(err.message);
      return detail(err.code) ?? t("generic");
    },
    [t],
  );
}

export function useErrorToast() {
  const text = useErrorText();
  return useCallback((err: unknown) => toast.error(text(err)), [text]);
}
