"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** The completion circle. Turquoise fill = done; the motion answers the click. */
export function TaskCheck({
  checked,
  onToggle,
  label,
  disabled,
  size = 18,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{ width: size, height: size }}
      className={cn(
        "group/check relative inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-200",
        checked
          ? "scale-100 border-done bg-done text-white"
          : "border-line-strong text-transparent hover:border-done hover:text-done/70",
        disabled && "cursor-default opacity-60",
      )}
    >
      <Check strokeWidth={3} className={cn("size-[11px] transition-transform duration-200", checked ? "scale-100" : "scale-75")} />
    </button>
  );
}
