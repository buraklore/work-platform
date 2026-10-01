"use client";

/**
 * Change only the query string (panel, filters, tabs, view) without a server round trip.
 * router.push/replace would re-run the page's Server Component on every keystroke and its
 * fresh prefetch could overwrite optimistic client state. Next.js keeps useSearchParams in
 * sync with these native calls (docs: "Using the native History API").
 */
export function setUrl(url: string, mode: "push" | "replace" = "replace") {
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}
