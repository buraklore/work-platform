"use client";

import { Check } from "lucide-react";
import { DropdownMenu as M, Popover as P, Tooltip as T } from "radix-ui";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuGroup = M.Group;

const panel = "z-50 min-w-44 rounded-lg border border-line bg-surface p-1 shadow-pop text-base";

export function MenuContent({ children, className, align = "start", ...props }: M.DropdownMenuContentProps) {
  return (
    <M.Portal>
      <M.Content sideOffset={6} align={align} collisionPadding={8} className={cn(panel, className)} {...props}>
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({ className, danger, ...props }: M.DropdownMenuItemProps & { danger?: boolean }) {
  return (
    <M.Item
      className={cn(
        "flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 outline-none [&_svg]:size-4",
        "data-[highlighted]:bg-raised data-[disabled]:opacity-50",
        danger ? "text-danger" : "text-fg [&_svg]:text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function MenuCheckItem({
  checked,
  children,
  ...props
}: Omit<M.DropdownMenuItemProps, "children"> & { checked: boolean; children: React.ReactNode }) {
  return (
    <MenuItem {...props}>
      <span className="flex-1 truncate">{children}</span>
      {checked ? <Check className="!text-accent" /> : <span className="size-4" />}
    </MenuItem>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <M.Label className="px-2 pb-1 pt-1.5 text-xs font-medium text-faint">{children}</M.Label>;
}

export function MenuSeparator() {
  return <M.Separator className="my-1 h-px bg-line" />;
}

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverClose = P.Close;

export function PopoverContent({ className, align = "start", ...props }: P.PopoverContentProps) {
  return (
    <P.Portal>
      <P.Content sideOffset={6} align={align} collisionPadding={8} className={cn(panel, "p-2", className)} {...props} />
    </P.Portal>
  );
}

export function Tooltip({ label, children, side = "bottom" }: { label: string; children: React.ReactNode; side?: T.TooltipContentProps["side"] }) {
  return (
    <T.Provider delayDuration={400}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content side={side} sideOffset={6} className="z-50 rounded-md bg-fg px-2 py-1 text-xs text-bg">
            {label}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
