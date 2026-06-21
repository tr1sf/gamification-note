import { createSignal } from "solid-js";
import { login } from "~/stores/auth";
import { useNavigate } from "@solidjs/router";
import { t } from "~/lib/i18n";

function EyeIcon(props: { open: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {props.open ? (
        <>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" x2="22" y1="2" y2="22" />
        </>
      )}
    </svg>
  );
}

export function LoginForm() {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [showPassword, setShowPassword] = createSignal(false);
  const [fieldErrors, setFieldErrors] = createSignal<Record<string, string>>({});
  const [generalError, setGeneralError] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const navigate = useNavigate();

  const clearField = (field: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setGeneralError("");
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError("");
    setSubmitting(true);
    try {
      const { error } = await login(email(), password());
      if (error) {
        if (error.details?.fieldErrors) {
          const mapped: Record<string, string> = {};
          const fe = error.details.fieldErrors;
          for (const [key, msgs] of Object.entries(fe)) {
            if (msgs.length) mapped[key] = msgs[0];
          }
          setFieldErrors(mapped);
        } else {
          setGeneralError(error.message);
        }
        return;
      }
      navigate("/tavern");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full rounded-lg border px-4 py-2.5 text-ink-primary bg-surface placeholder:text-ink-secondary/40
     transition-all duration-150
     hover:border-ink-secondary/30
     focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20
     ${fieldErrors()[field] ? "border-error ring-1 ring-error/20" : "border-surface-border"}`;

  return (
    <form onSubmit={handleSubmit} class="space-y-4" novalidate>
      <div class="text-center mb-2">
        <p class="text-3xl mb-2">🏰</p>
        <h2 class="text-xl font-display font-bold text-ink-primary">{t("Welcome back")}</h2>
        <p class="text-sm text-ink-secondary mt-0.5">{t("Sign in to continue your adventure")}</p>
      </div>
      {generalError() && (
        <p class="text-sm bg-error-bg text-error rounded-lg px-4 py-2.5 animate-fade-up" role="alert">{generalError()}</p>
      )}
      <div>
        <label for="login-email" class="block text-sm font-medium text-ink-secondary mb-1.5">{t("Email or Username")}</label>
        <input id="login-email" type="text" value={email()} onInput={(e) => { setEmail(e.currentTarget.value); clearField("login"); }} class={inputClass("login")} required autocomplete="username" autofocus aria-describedby={fieldErrors().login ? "login-email-error" : undefined} aria-invalid={!!fieldErrors().login} />
        {fieldErrors().login && <p id="login-email-error" class="mt-1 text-xs text-error">{fieldErrors().login}</p>}
      </div>
      <div>
        <label for="login-password" class="block text-sm font-medium text-ink-secondary mb-1.5">{t("Password")}</label>
        <div class="relative mt-1">
          <input
            id="login-password"
            type={showPassword() ? "text" : "password"}
            value={password()}
            onInput={(e) => { setPassword(e.currentTarget.value); clearField("password"); }}
            class={`${inputClass("password")} pr-11`}
            required
            autocomplete="current-password"
            aria-describedby={fieldErrors().password ? "login-password-error" : undefined}
            aria-invalid={!!fieldErrors().password}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary/50 hover:text-ink-secondary transition-colors p-1"
            aria-label={showPassword() ? t("Hide password") : t("Show password")}
            title={showPassword() ? t("Hide password") : t("Show password")}
          >
            <EyeIcon open={showPassword()} />
          </button>
        </div>
        {fieldErrors().password && <p id="login-password-error" class="mt-1 text-xs text-error">{fieldErrors().password}</p>}
      </div>
      <button type="submit" disabled={submitting()} class="w-full rounded-lg bg-accent px-4 py-2.5 text-surface-overlay font-semibold hover:bg-accent-hover hover:shadow-md hover:shadow-accent/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150">
        {submitting() ? t("Entering...") : t("Enter Tavern")}
      </button>
      <p class="text-center text-sm">
        <a href="/forgot-password" class="text-ink-secondary hover:text-accent hover:underline">{t("Forgot password?")}</a>
      </p>
      <p class="text-center text-sm text-ink-secondary">
        {t("No account?")} <a href="/register" class="text-accent hover:underline">{t("Register")}</a>
      </p>
    </form>
  );
}
