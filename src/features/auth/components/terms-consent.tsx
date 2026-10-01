"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

/** Required acceptance of the terms of use + KVKK notice (recorded as profiles.terms_accepted_at). */
export function TermsConsent({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: string | null }) {
  const t = useTranslations("auth");
  return (
    <div>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
        <span>
          {t.rich("termsConsent", {
            terms: (c) => (
              <Link href="/yasal/kullanim-kosullari" target="_blank" className="text-accent underline-offset-2 hover:underline">
                {c}
              </Link>
            ),
            privacy: (c) => (
              <Link href="/yasal/kvkk" target="_blank" className="text-accent underline-offset-2 hover:underline">
                {c}
              </Link>
            ),
          })}
        </span>
      </label>
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
