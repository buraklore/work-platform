import { describe, expect, it } from "vitest";
import { nextFromRedirect, safeNext } from "@/features/auth/schemas";

const SITE = "https://app.example.com";

describe("redirect targets", () => {
  it("safeNext keeps only same-site relative paths", () => {
    expect(safeNext("/w/ekip", "/")).toBe("/w/ekip");
    expect(safeNext("//evil.com", "/")).toBe("/");
    expect(safeNext("/\\evil.com", "/")).toBe("/");
    expect(safeNext("https://evil.com", "/")).toBe("/");
    expect(safeNext(null, "/baslangic")).toBe("/baslangic");
  });

  it("unwraps Supabase's {{ .RedirectTo }} back to the invite path", () => {
    expect(nextFromRedirect(`${SITE}/auth/callback?next=/davet/abc123`, SITE, "/baslangic")).toBe("/davet/abc123");
    expect(nextFromRedirect(`${SITE}/w/ekip?gorev=1`, SITE)).toBe("/w/ekip?gorev=1");
    expect(nextFromRedirect("/sifre-yenile", SITE)).toBe("/sifre-yenile");
  });

  it("refuses other origins and nested open redirects", () => {
    expect(nextFromRedirect("https://evil.com/auth/callback?next=/w", SITE, "/x")).toBe("/x");
    expect(nextFromRedirect(`${SITE}/auth/callback?next=//evil.com`, SITE, "/x")).toBe("/x");
    expect(nextFromRedirect("not a url", SITE, "/x")).toBe("/x");
  });
});
