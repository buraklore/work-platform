"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { useErrorText } from "@/lib/client/errors";
import { safeNext, zEmail } from "../schemas";
import { TermsConsent } from "./terms-consent";

function GoogleButton({ next }: { next: string }) {
  const t = useTranslations("auth");
  return (
    <>
      <Button asChild variant="secondary" size="lg" className="w-full">
        <a href={`/auth/google?next=${encodeURIComponent(next)}`}>
          <svg viewBox="0 0 24 24" aria-hidden className="size-4">
            <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.2Z" />
            <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9Z" />
            <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4Z" />
          </svg>
          {t("google")}
        </a>
      </Button>
      <p className="mt-2 text-xs text-faint">{t("googleConsent")}</p>
    </>
  );
}

function Divider() {
  const t = useTranslations("auth");
  return (
    <div className="my-5 flex items-center gap-3 text-sm text-faint">
      <span className="h-px flex-1 bg-line" />
      {t("or")}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

type FromQuery = { next?: string | null; hata?: string | null };

function QueryError({ hata }: { hata?: string | null }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  if (!hata) return null;
  const text = hata === "oauth" ? t("oauthError") : hata === "rate_limited" ? te("rate_limited") : t("linkError");
  return (
    <p role="alert" className="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {text}
    </p>
  );
}

export function LoginForm({ next: rawNext, hata }: FromQuery) {
  const t = useTranslations("auth");
  const te = useTranslations("errors.fields");
  const router = useRouter();
  const next = safeNext(rawNext, "/");
  const errorText = useErrorText();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [magicBusy, setMagicBusy] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/login", { method: "POST", body: { email, password } });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  const magic = async () => {
    setError(null);
    if (!zEmail.safeParse(email).success) {
      setEmailError(te("email"));
      return;
    }
    setEmailError(null);
    setMagicBusy(true);
    try {
      await api("/auth/magic-link", { method: "POST", body: { email, next } });
      setMagicSent(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setMagicBusy(false);
    }
  };

  if (magicSent) {
    return (
      <div>
        <Mail className="size-6 text-accent" />
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">{t("checkEmailTitle")}</h1>
        <p className="mt-2 text-muted">{t("magicSent", { email })}</p>
        <Button variant="link" className="mt-6" onClick={() => setMagicSent(false)}>
          {t("useAnotherEmail")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t("loginTitle")}</h1>
      <p className="mt-1.5 text-muted">{t("loginSubtitle")}</p>
      <div className="mt-8">
        <QueryError hata={hata} />
        <GoogleButton next={next} />
        <Divider />
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={t("email")} htmlFor="email" error={emailError}>
            <Input id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={t("password")} htmlFor="password" error={error}>
            <Input id="password" type="password" autoComplete="current-password" required value={password} aria-invalid={Boolean(error)} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Link href="/sifremi-unuttum" className="text-sm text-muted hover:text-fg">
              {t("forgot")}
            </Link>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy || !email || !password}>
            {t("login")}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={magic} disabled={magicBusy}>
            {t("magicLink")}
          </Button>
        </form>
        <p className="mt-8 text-sm text-muted">
          {t("noAccount")}{" "}
          <Link href={`/kayit${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-accent hover:underline">
            {t("signup")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export function SignupForm({ next: rawNext, hata }: FromQuery) {
  const t = useTranslations("auth");
  const te = useTranslations("errors.fields");
  const router = useRouter();
  const next = safeNext(rawNext, "/baslangic");
  const errorText = useErrorText();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", acceptTerms: false, marketingConsent: false });
  const [errors, setErrors] = useState<Partial<Record<"fullName" | "email" | "password" | "acceptTerms" | "form", string>>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!form.fullName.trim()) e.fullName = te("required");
    if (!zEmail.safeParse(form.email).success) e.email = te("email");
    if (form.password.length < 8) e.password = te("passwordShort");
    if (!form.acceptTerms) e.acceptTerms = te("terms");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await api<{ needsConfirmation: boolean }>("/auth/signup", { method: "POST", body: { ...form, acceptTerms: true, next } });
      if (res.needsConfirmation) setSent(true);
      else {
        router.replace(next);
        router.refresh();
      }
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div>
        <Mail className="size-6 text-accent" />
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">{t("checkEmailTitle")}</h1>
        <p className="mt-2 text-muted">{t("checkEmailBody", { email: form.email })}</p>
        <p className="mt-4 text-sm text-muted">{t("checkSpam")}</p>
        <Button variant="link" className="mt-4" onClick={() => setSent(false)}>
          {t("useAnotherEmail")}
        </Button>
      </div>
    );
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t("signupTitle")}</h1>
      <p className="mt-1.5 text-muted">{t("signupSubtitle")}</p>
      <div className="mt-8">
        <QueryError hata={hata} />
        <GoogleButton next={next} />
        <Divider />
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={t("fullName")} htmlFor="fullName" error={errors.fullName}>
            <Input id="fullName" autoComplete="name" value={form.fullName} aria-invalid={Boolean(errors.fullName)} onChange={(e) => set("fullName", e.target.value)} />
          </Field>
          <Field label={t("email")} htmlFor="email" error={errors.email}>
            <Input id="email" type="email" inputMode="email" autoComplete="email" value={form.email} aria-invalid={Boolean(errors.email)} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label={t("password")} htmlFor="password" hint={t("passwordHint")} error={errors.password}>
            <Input id="password" type="password" autoComplete="new-password" value={form.password} aria-invalid={Boolean(errors.password)} onChange={(e) => set("password", e.target.value)} />
          </Field>
<TermsConsent checked={form.acceptTerms} onChange={(v) => set("acceptTerms", v)} error={errors.acceptTerms} />
          <label className="flex items-start gap-2.5 text-sm text-muted">
            <input type="checkbox" checked={form.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
            {t("marketingConsent")}
          </label>
          {errors.form ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {errors.form}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {t("signup")}
          </Button>
        </form>
        <p className="mt-8 text-sm text-muted">
          {t("haveAccount")}{" "}
          <Link href="/giris" className="font-medium text-accent hover:underline">
            {t("login")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export function ForgotForm() {
  const t = useTranslations("auth");
  const te = useTranslations("errors.fields");
  const errorText = useErrorText();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t("resetTitle")}</h1>
      <p className="mt-1.5 text-muted">{t("resetSubtitle")}</p>
      {sent ? (
        <p className="mt-8 rounded-md bg-done-soft px-3 py-2 text-done">{t("resetSent")}</p>
      ) : (
        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!zEmail.safeParse(email).success) return setError(te("email"));
            setBusy(true);
            setError(null);
            try {
              await api("/auth/password-reset", { method: "POST", body: { email } });
              setSent(true);
            } catch (err) {
              setError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={t("email")} htmlFor="email" error={error}>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={!email || busy}>
            {t("resetCta")}
          </Button>
        </form>
      )}
      <Link href="/giris" className="mt-8 inline-block text-sm text-muted hover:text-fg">
        {t("backToLogin")}
      </Link>
    </div>
  );
}

export function NewPasswordForm({ hasSession }: { hasSession: boolean }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors.fields");
  const router = useRouter();
  const errorText = useErrorText();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!hasSession) {
    // The reset link was opened in another browser or has expired: no recovery session here.
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("newPasswordTitle")}</h1>
        <p className="mt-3 text-muted">{t("resetLinkInvalid")}</p>
        <Button asChild className="mt-6">
          <Link href="/sifremi-unuttum">{t("resetCta")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t("newPasswordTitle")}</h1>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password.length < 8) return setError(te("passwordShort"));
          try {
            await api("/auth/password-update", { method: "POST", body: { password } });
            toast(t("passwordUpdated"));
            router.replace("/");
          } catch (err) {
            setError(errorText(err));
          }
        }}
      >
        <Field label={t("newPassword")} htmlFor="password" hint={t("passwordHint")} error={error}>
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="w-full">
          {t("updatePassword")}
        </Button>
      </form>
    </div>
  );
}
