import { RegisterForm } from "~/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <main class="min-h-screen flex items-center justify-center bg-surface relative overflow-hidden px-4">
      <div class="absolute inset-0 opacity-[0.025] dark:opacity-[0.05]" style="background-image: radial-gradient(circle, var(--color-accent) 1px, transparent 1px); background-size: 20px 20px;" aria-hidden="true" />
      <div class="absolute top-10 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" aria-hidden="true" />
      <div class="absolute bottom-10 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" aria-hidden="true" />

      <div class="relative z-10 w-full max-w-sm sm:max-w-md">
        <div class="absolute -top-2 -left-2 -right-2 -bottom-2 sm:-top-3 sm:-left-3 sm:-right-3 sm:-bottom-3 rounded-2xl border border-surface-border/60 bg-surface-elevated/30 -z-10" aria-hidden="true" />
        <div class="absolute -top-1 -left-1 -right-1 -bottom-1 sm:-top-1.5 sm:-left-1.5 sm:-right-1.5 sm:-bottom-1.5 rounded-xl border border-accent/15 -z-10" aria-hidden="true" style="box-shadow: inset 0 0 40px color-mix(in oklab, var(--color-accent) 4%, transparent);" />

        <div class="p-4 sm:p-8 rounded-xl border border-surface-border bg-surface-elevated" style="box-shadow: 0 1px 3px rgb(0 0 0 / 0.06), 0 4px 20px rgb(0 0 0 / 0.04), inset 0 0 0 1px color-mix(in oklab, var(--color-accent) 5%, transparent);">
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}
