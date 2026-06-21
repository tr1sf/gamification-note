import { createResource, createSignal, createEffect, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { authFetch } from "~/stores/auth";
import { addToast } from "~/stores/ui";
import { t } from "~/lib/i18n";

const PRESET_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was the name of your first school?",
  "What is your mother's maiden name?",
  "What was the make of your first phone?",
  "What is your favorite book?",
  "What was your childhood nickname?",
];

const CUSTOM = "__custom__";

async function fetchSecurityQuestion() {
  const res = await authFetch("/api/auth/security-question");
  const json = await res.json();
  return json.success ? json.data : { hasQuestion: false, question: null };
}

export default function SecuritySettings() {
  const [data, { refetch }] = createResource(fetchSecurityQuestion);

  const [selected, setSelected] = createSignal(PRESET_QUESTIONS[0]);
  const [custom, setCustom] = createSignal("");
  const [answer, setAnswer] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [initialized, setInitialized] = createSignal(false);

  // Seed the form from the existing question once, on first load.
  createEffect(() => {
    const d = data();
    if (!d || initialized()) return;
    if (d.question) {
      if (PRESET_QUESTIONS.includes(d.question)) {
        setSelected(d.question);
      } else {
        setSelected(CUSTOM);
        setCustom(d.question);
      }
    }
    setInitialized(true);
  });

  const effectiveQuestion = () => (selected() === CUSTOM ? custom().trim() : selected());

  const handleSave = async (e: Event) => {
    e.preventDefault();
    const question = effectiveQuestion();
    if (question.length < 5) {
      addToast(t("Please enter a question (at least 5 characters)"), "error");
      return;
    }
    if (!answer().trim()) {
      addToast(t("Please enter an answer"), "error");
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch("/api/auth/security-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer: answer() }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(t("Security question saved"), "success");
        setAnswer("");
        refetch();
      } else {
        addToast(json.error?.message || t("Failed to save"), "error");
      }
    } catch {
      addToast(t("Network error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-surface-border px-3 py-2.5 text-sm text-ink-primary bg-surface focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <div class="max-w-xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <A href="/profile" class="text-sm text-ink-secondary hover:text-ink-primary transition-colors">
          ← {t("Back to profile")}
        </A>
        <h1 class="text-2xl font-display font-bold text-ink-primary mt-2">{t("Account Security")}</h1>
        <p class="text-sm text-ink-secondary mt-1">
          {t("Set a security question so you can recover your account if you forget your password.")}
        </p>
      </div>

      <Show
        when={!data.loading}
        fallback={<div class="h-48 bg-surface-border rounded-xl animate-pulse" />}
      >
        <div class="p-4 rounded-xl border border-surface-border bg-surface-elevated">
          <div class="flex items-center gap-2 mb-4">
            <span aria-hidden="true">🔐</span>
            <span class={`text-xs px-2 py-0.5 rounded ${data()?.hasQuestion ? "bg-success-bg text-success" : "bg-surface-border text-ink-secondary"}`}>
              {data()?.hasQuestion ? t("Recovery enabled") : t("Not set up yet")}
            </span>
          </div>

          <form onSubmit={handleSave} class="space-y-4">
            <div>
              <label for="sec-question" class="block text-xs text-ink-secondary mb-1.5">{t("Security question")}</label>
              <select id="sec-question" value={selected()} onChange={(e) => setSelected(e.currentTarget.value)} class={inputClass}>
                <For each={PRESET_QUESTIONS}>{(q) => <option value={q}>{q}</option>}</For>
                <option value={CUSTOM}>{t("Write my own question…")}</option>
              </select>
            </div>

            <Show when={selected() === CUSTOM}>
              <div>
                <label for="sec-custom" class="block text-xs text-ink-secondary mb-1.5">{t("Your question")}</label>
                <input id="sec-custom" type="text" value={custom()} onInput={(e) => setCustom(e.currentTarget.value)}
                  maxLength={150} placeholder={t("e.g. What street did you grow up on?")} class={inputClass} />
              </div>
            </Show>

            <div>
              <label for="sec-answer" class="block text-xs text-ink-secondary mb-1.5">{t("Answer")}</label>
              <input id="sec-answer" type="text" value={answer()} onInput={(e) => setAnswer(e.currentTarget.value)}
                maxLength={100} autocomplete="off" placeholder={data()?.hasQuestion ? t("Enter a new answer to update") : t("Your answer")} class={inputClass} />
              <p class="mt-1 text-xs text-ink-secondary/60">
                {t("Not case-sensitive. Remember it exactly — you'll need it to reset your password.")}
              </p>
            </div>

            <button type="submit" disabled={saving()}
              class="px-4 py-2 bg-accent text-surface-overlay rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50">
              {saving() ? t("Saving...") : data()?.hasQuestion ? t("Update security question") : t("Save security question")}
            </button>
          </form>
        </div>
      </Show>
    </div>
  );
}
