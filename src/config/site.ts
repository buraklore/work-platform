/** Product identity — the single place that knows the (still undecided) name and domain. */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_PRODUCT_NAME || "PROJECT",
  description:
    process.env.NEXT_PUBLIC_PRODUCT_DESCRIPTION || "Ekibinin işini tek yerde, en az tıklamayla yönet.",
  url: (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  ogImageUrl: process.env.NEXT_PUBLIC_OG_IMAGE_URL || null,
  locale: "tr-TR",
  timezone: "Europe/Istanbul",
} as const;
