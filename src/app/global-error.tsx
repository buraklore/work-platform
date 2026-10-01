"use client";

/** Last-resort boundary (root layout failed): no providers available, so plain Turkish text. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 2rem", color: "#171923" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Beklenmedik bir hata oluştu</h1>
        <p style={{ color: "#5e6275", marginTop: "0.5rem" }}>Sayfayı yenilemeyi dene.</p>
        <button type="button" onClick={reset} style={{ marginTop: "1.5rem", padding: "0.5rem 1rem", borderRadius: 6, background: "#3b4fe4", color: "#fff", border: 0 }}>
          Tekrar dene
        </button>
      </body>
    </html>
  );
}
