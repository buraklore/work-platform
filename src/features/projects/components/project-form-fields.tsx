"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { PROJECT_COLORS } from "../types";

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const t = useTranslations("projects");
  const tc = useTranslations("colors");
  return (
    <div role="radiogroup" aria-label={t("color")} className="flex flex-wrap gap-1.5">
      {PROJECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={tc(c.slice(1).toLocaleUpperCase("en-US"))}
          onClick={() => onChange(c)}
          className={cn("inline-flex size-7 items-center justify-center rounded-md text-white ring-offset-2 ring-offset-surface", value === c && "ring-2 ring-fg/40")}
          style={{ backgroundColor: c }}
        >
          {value === c ? <Check className="size-3.5" /> : null}
        </button>
      ))}
    </div>
  );
}

export function VisibilityPicker({ value, onChange }: { value: "team" | "private"; onChange: (v: "team" | "private") => void }) {
  const t = useTranslations("projects");
  return (
    <div role="radiogroup" aria-label={t("visibility")} className="grid gap-1.5">
      {(["team", "private"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("rounded-lg border px-3 py-2 text-left", value === v ? "border-accent bg-accent-soft/50" : "border-line hover:bg-raised")}
        >
          <span className="block text-base font-medium">{v === "team" ? t("visibilityTeam") : t("visibilityPrivate")}</span>
          <span className="block text-sm text-muted">{v === "team" ? t("visibilityTeamHint") : t("visibilityPrivateHint")}</span>
        </button>
      ))}
    </div>
  );
}
