import { LoginForm } from "~/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main class="min-h-screen flex items-center justify-center bg-surface relative overflow-hidden p-4">
      <div class="absolute inset-0 opacity-[0.025] dark:opacity-[0.05]" style="background-image: radial-gradient(circle, var(--color-accent) 1px, transparent 1px); background-size: 20px 20px;" aria-hidden="true" />
      <div class="absolute top-12 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" aria-hidden="true" />
      <div class="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" aria-hidden="true" />

      <div class="relative z-10 w-full max-w-sm sm:max-w-md">
        <div class="absolute -top-3 -left-3 -right-3 -bottom-3 rounded-2xl border border-surface-border/60 bg-surface-elevated/30 -z-10" aria-hidden="true" />
        <div class="absolute -top-1.5 -left-1.5 -right-1.5 -bottom-1.5 rounded-xl border border-accent/15 -z-10" aria-hidden="true" style="box-shadow: inset 0 0 40px color-mix(in oklab, var(--color-accent) 4%, transparent);" />

        <div class="p-4 sm:p-8 rounded-xl border border-surface-border bg-surface-elevated" style="box-shadow: 0 1px 3px rgb(0 0 0 / 0.06), 0 4px 20px rgb(0 0 0 / 0.04), inset 0 0 0 1px color-mix(in oklab, var(--color-accent) 5%, transparent);">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
