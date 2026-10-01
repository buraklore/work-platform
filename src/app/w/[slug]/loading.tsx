import { Skeleton } from "@/components/ui/misc";

/** Shown instantly while a workspace page loads (the sidebar stays in place). */
export default function Loading() {
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-8 md:px-8 md:pt-14">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mt-6 h-12 w-full" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
