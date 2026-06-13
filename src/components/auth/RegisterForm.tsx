import { createSignal } from "solid-js";
import { register, login } from "~/stores/auth";
import { useNavigate } from "@solidjs/router";

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

export function RegisterForm() {
  const [email, setEmail] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [showPassword, setShowPassword] = createSignal(false);
  const [showConfirmPassword, setShowConfirmPassword] = createSignal(false);
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

    if (password() !== confirmPassword()) {
      setFieldErrors({ confirmPassword: "Passwords do not match" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await register(email(), username(), password());
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
      const { error: loginError } = await login(email(), password());
      if (loginError) {
        setGeneralError("Account created but login failed. Please sign in.");
        navigate("/login");
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
    <form onSubmit={handleSubmit} class="space-y-5" novalidate>
      <div class="text-center mb-2">
        <h2 class="text-2xl font-display font-bold text-ink-primary">Join the Tavern</h2>
        <p class="text-sm text-ink-secondary mt-1">Create your adventurer account</p>
      </div>

      {generalError() && (
        <p class="text-sm bg-error-bg text-error rounded-lg px-4 py-2.5" role="alert">{generalError()}</p>
      )}

      <div>
        <label for="reg-email" class="block text-sm font-medium text-ink-secondary mb-1.5">Email address</label>
        <input
          id="reg-email" type="email"
          placeholder="you@example.com"
          value={email()}
          onInput={(e) => { setEmail(e.currentTarget.value); clearField("email"); }}
          class={inputClass("email")}
          required autocomplete="email" autofocus
          aria-describedby={fieldErrors().email ? "reg-email-error" : undefined}
          aria-invalid={!!fieldErrors().email}
        />
        {fieldErrors().email && <p id="reg-email-error" class="mt-1.5 text-xs text-error">{fieldErrors().email}</p>}
      </div>

      <div>
        <label for="reg-username" class="block text-sm font-medium text-ink-secondary mb-1.5">Username</label>
        <input
          id="reg-username" type="text"
          placeholder="Choose a unique name"
          value={username()}
          onInput={(e) => { setUsername(e.currentTarget.value); clearField("username"); }}
          class={inputClass("username")}
          required minLength={3} autocomplete="username"
          aria-describedby={fieldErrors().username ? "reg-username-error" : "reg-username-hint"}
          aria-invalid={!!fieldErrors().username}
        />
        {fieldErrors().username
          ? <p id="reg-username-error" class="mt-1.5 text-xs text-error">{fieldErrors().username}</p>
          : <p id="reg-username-hint" class="mt-1 text-xs text-ink-secondary/60">3–30 characters, letters, numbers, and underscores only</p>
        }
      </div>

      <div>
        <label for="reg-password" class="block text-sm font-medium text-ink-secondary mb-1.5">Password</label>
        <div class="relative">
          <input
            id="reg-password" type={showPassword() ? "text" : "password"}
            placeholder="At least 8 characters"
            value={password()}
            onInput={(e) => { setPassword(e.currentTarget.value); clearField("password"); }}
            class={`${inputClass("password")} pr-11`}
            required minLength={8} autocomplete="new-password"
            aria-describedby={fieldErrors().password ? "reg-password-error" : "reg-password-hint"}
            aria-invalid={!!fieldErrors().password}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary/50 hover:text-ink-secondary transition-colors p-1"
            aria-label={showPassword() ? "Hide password" : "Show password"}
            title={showPassword() ? "Hide password" : "Show password"}
          >
            <EyeIcon open={showPassword()} />
          </button>
        </div>
        {fieldErrors().password && <p id="reg-password-error" class="mt-1.5 text-xs text-error">{fieldErrors().password}</p>}
      </div>

      <div>
        <label for="reg-confirm" class="block text-sm font-medium text-ink-secondary mb-1.5">Confirm password</label>
        <div class="relative">
          <input
            id="reg-confirm" type={showConfirmPassword() ? "text" : "password"}
            placeholder="Type your password again"
            value={confirmPassword()}
            onInput={(e) => { setConfirmPassword(e.currentTarget.value); clearField("confirmPassword"); }}
            class={`${inputClass("confirmPassword")} pr-11`}
            required minLength={8} autocomplete="new-password"
            aria-describedby={fieldErrors().confirmPassword ? "reg-confirm-error" : undefined}
            aria-invalid={!!fieldErrors().confirmPassword}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary/50 hover:text-ink-secondary transition-colors p-1"
            aria-label={showConfirmPassword() ? "Hide confirm password" : "Show confirm password"}
            title={showConfirmPassword() ? "Hide confirm password" : "Show confirm password"}
          >
            <EyeIcon open={showConfirmPassword()} />
          </button>
        </div>
        {fieldErrors().confirmPassword && <p id="reg-confirm-error" class="mt-1.5 text-xs text-error">{fieldErrors().confirmPassword}</p>}
      </div>

      <button
        type="submit"
        disabled={submitting()}
        class="w-full rounded-lg bg-accent px-4 py-2.5 text-surface-overlay font-semibold
               hover:bg-accent-hover active:scale-[0.98]
               disabled:opacity-50 disabled:cursor-not-allowed
               transition-all duration-150"
      >
        {submitting() ? "Creating account..." : "Register"}
      </button>

      <p class="text-center text-sm text-ink-secondary">
        Already have an account?{" "}
        <a href="/login" class="text-accent hover:underline font-medium">Sign in</a>
      </p>
    </form>
  );
}
