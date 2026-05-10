import { LoginForm } from "~/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main class="min-h-screen flex items-center justify-center bg-surface">
      <div class="w-full max-w-md p-8 bg-surface-elevated rounded-lg shadow-sm border border-surface-border">
        <LoginForm />
      </div>
    </main>
  );
}
