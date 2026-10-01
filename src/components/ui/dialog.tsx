"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  hideTitle,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  hideTitle?: boolean;
}) {
  const t = useTranslations("common");
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-[rgb(16_18_25/0.45)] backdrop-blur-[1px]" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-[12vh] z-50 max-h-[80dvh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-pop",
          "focus:outline-none",
          className,
        )}
      >
        <D.Title className={cn("font-display text-lg font-semibold tracking-tight", hideTitle && "sr-only")}>
          {title}
        </D.Title>
        {description ? (
          <D.Description className="mt-1 text-base text-muted">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">{title}</D.Description>
        )}
        <div className={cn(!hideTitle && "mt-4")}>{children}</div>
        <D.Close
          aria-label={t("close")}
          className="absolute right-3 top-3 rounded-md p-1.5 text-faint hover:bg-raised hover:text-fg"
        >
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

/** Right-hand panel on desktop, full screen on mobile. */
export function SheetContent({
  title,
  children,
  className,
  onEscapeKeyDown,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-[rgb(16_18_25/0.25)] md:bg-transparent" />
      <D.Content
        onEscapeKeyDown={onEscapeKeyDown}
        // Clicking another task, a toast's "Geri al" or the sidebar must not close the panel
        // (it would race with opening the next task). It closes via X, Esc or "back".
        onInteractOutside={(e) => e.preventDefault()}
        className={cn(
          "fixed inset-0 z-40 flex flex-col bg-surface focus:outline-none",
          "md:inset-y-0 md:left-auto md:right-0 md:w-[min(560px,100vw)] md:border-l md:border-line md:shadow-pop",
          className,
        )}
      >
        <D.Title className="sr-only">{title}</D.Title>
        <D.Description className="sr-only">{title}</D.Description>
        {children}
      </D.Content>
    </D.Portal>
  );
}
