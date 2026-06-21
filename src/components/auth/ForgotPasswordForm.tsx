import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { t } from "~/lib/i18n";

type Step = "lookup" | "reset" | "done";

export function ForgotPasswordForm() {
  const [step, setStep] = createSignal<Step>("lookup");
  const [login, setLogin] = createSignal("");
  const [question, setQuestion] = createSignal("");
  const [answer, setAnswer] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirm, setConfirm] = createSignal("");
  const [error, setError] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const navigate = useNavigate();

  const handleLookup = async (e: Event) => {
    e.preventDefault();
    setError("");
    if (!login().trim()) {
      setError(t("Enter your email or username"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login().trim() }),
      });
      const json = await res.json().catch(() => null);
      if (json?.success) {
        setQuestion(json.data.question);
        setStep("reset");
      } else {
        setError(json?.error?.message || t("No security question is available for this account."));
      }
    } catch {
      setError(t("Can't reach the server. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: Event) => {
    e.preventDefault();
    setError("");
    if (password() !== confirm()) {
      setError(t("Passwords do not match"));
      return;
    }
    if (password().length < 8) {
      setError(t("Password must be at least 8 characters"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login().trim(), answer: answer(), password: password() }),
      });
      const json = await res.json().catch(() => null);
      if (json?.success) {
        setStep("done");
      } else {
        setError(json?.error?.message || t("That answer doesn't match our records."));
      }
    } catch {
      setError(t("Can't reach the server. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    `w-full rounded-lg border border-surface-border px-4 py-2.5 text-ink-primary bg-surface placeholder:text-ink-secondary/40
     transition-all duration-150 hover:border-ink-secondary/30
     focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20`;

  return (
    <>
      <div class="text-center mb-2">
        <p class="text-3xl mb-2">🔑</p>
        <h2 class="text-xl font-display font-bold text-ink-primary">{t("Recover your account")}</h2>
        <p class="text-sm text-ink-secondary mt-0.5">
          {step() === "done"
            ? t("Your password has been reset.")
            : t("Answer your security question to set a new password.")}
        </p>
      </div>

      <Show when={error()}>
        <p class="text-sm bg-error-bg text-error rounded-lg px-4 py-2.5 mb-4 animate-fade-up" role="alert">{error()}</p>
      </Show>

      {/* Step 1 — look up the security question */}
      <Show when={step() === "lookup"}>
        <form onSubmit={handleLookup} class="space-y-4" novalidate>
          <div>
            <label for="fp-login" class="block text-sm font-medium text-ink-secondary mb-1.5">{t("Email or Username")}</label>
            <input id="fp-login" type="text" value={login()} onInput={(e) => setLogin(e.currentTarget.value)}
              class={inputClass} required autocomplete="username" autofocus />
          </div>
          <button type="submit" disabled={submitting()}
            class="w-full rounded-lg bg-accent px-4 py-2.5 text-surface-overlay font-semibold hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150">
            {submitting() ? t("Checking...") : t("Continue")}
          </button>
        </form>
      </Show>

      {/* Step 2 — answer + new password */}
      <Show when={step() === "reset"}>
        <form onSubmit={handleReset} class="space-y-4" novalidate>
          <div class="rounded-lg border border-surface-border bg-surface-elevated px-4 py-3">
            <p class="text-xs text-ink-secondary mb-0.5">{t("Security question")}</p>
            <p class="text-sm font-medium text-ink-primary">{question()}</p>
          </div>
          <div>
            <label for="fp-answer" class="block text-sm font-medium text-ink-secondary mb-1.5">{t("Your answer")}</label>
            <input id="fp-answer" type="text" value={answer()} onInput={(e) => setAnswer(e.currentTarget.value)}
              class={inputClass} required autofocus autocomplete="off" />
          </div>
          <div>
            <label for="fp-password" class="block text-sm font-medium text-ink-secondary mb-1.5">{t("New password")}</label>
            <input id="fp-password" type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)}
              class={inputClass} required minLength={8} autocomplete="new-password" placeholder={t("At least 8 characters")} />
          </div>
          <div>
            <label for="fp-confirm" class="block text-sm font-medium text-ink-secondary mb-1.5">{t("Confirm password")}</label>
            <input id="fp-confirm" type="password" value={confirm()} onInput={(e) => setConfirm(e.currentTarget.value)}
              class={inputClass} required minLength={8} autocomplete="new-password" />
          </div>
          <button type="submit" disabled={submitting()}
            class="w-full rounded-lg bg-accent px-4 py-2.5 text-surface-overlay font-semibold hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150">
            {submitting() ? t("Resetting...") : t("Reset password")}
          </button>
        </form>
      </Show>

      {/* Step 3 — success */}
      <Show when={step() === "done"}>
        <div class="text-center space-y-4">
          <p class="text-4xl">✅</p>
          <button onClick={() => navigate("/login")}
            class="w-full rounded-lg bg-accent px-4 py-2.5 text-surface-overlay font-semibold hover:bg-accent-hover active:scale-[0.98] transition-all duration-150">
            {t("Back to sign in")}
          </button>
        </div>
      </Show>

      <Show when={step() !== "done"}>
        <p class="text-center text-sm text-ink-secondary mt-4">
          <a href="/login" class="text-accent hover:underline">{t("Back to sign in")}</a>
        </p>
      </Show>
    </>
  );
}
