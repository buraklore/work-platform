"use client";

import { useState } from "react";
import { initials } from "@/lib/text/tr";
import { cn } from "@/lib/utils";

/** Avatar URLs that failed to load (expired / blocked): show initials instead of a broken image. */
const failed = new Set<string>();

const AVATAR_TONES = ["#3B4FE4", "#12998F", "#C98A0B", "#8B5CF6", "#DB2777", "#0EA5E9", "#65A30D", "#E0513F"];

function tone(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
}

export function Avatar({
  name,
  id,
  src,
  size = 22,
  className,
}: {
  name: string;
  id: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const [, rerender] = useState(0);
  const style = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)) };
  if (src && !failed.has(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user avatars come from arbitrary OAuth hosts
      <img
        src={src}
        alt={name}
        style={style}
        referrerPolicy="no-referrer" // Google avatar URLs refuse requests that carry a Referer
        onError={() => {
          failed.add(src);
          rerender((n) => n + 1);
        }}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-label={name}
      title={name}
      style={{ ...style, backgroundColor: tone(id) }}
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white", className)}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 3, size = 22 }: { people: Array<{ id: string; name: string; avatarUrl?: string | null }>; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((p) => (
        <Avatar key={p.id} id={p.id} name={p.name} src={p.avatarUrl} size={size} className="ring-2 ring-surface" />
      ))}
      {rest > 0 ? (
        <span
          style={{ width: size, height: size }}
          className="inline-flex items-center justify-center rounded-full bg-raised text-[10px] font-semibold text-muted ring-2 ring-surface"
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-raised px-1 font-sans text-[11px] font-medium text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-raised", className)} />;
}

export function ColorDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-[3px]", className)} style={{ backgroundColor: color }} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}
