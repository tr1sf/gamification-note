import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { authFetch, user } from "~/stores/auth";
import { addToast } from "~/stores/ui";
import { t } from "~/lib/i18n";
import { PATH_DESCRIPTIONS, type UserPath } from "~/lib/path-unlocks";
import Nelar from "~/components/mascot/Nelar";

const PATHS: { id: UserPath; name: string; icon: string; desc: string }[] = [
  { id: "student", name: "Student", icon: "🎓", desc: "Early AI Quiz + Boss Fight. Learn fast, test knowledge." },
  { id: "professional", name: "Professional", icon: "💼", desc: "Early AI Summarize + Guilds. Productivity focus." },
  { id: "journaler", name: "Journaler", icon: "📖", desc: "Daily prompts + mood tracking. Reflection-first." },
];

export default function PathSettings() {
  const current = () => (user()?.path as UserPath | undefined) ?? "student";
  const [saving, setSaving] = createSignal(false);

  const handleSelect = async (pathId: UserPath) => {
    if (saving()) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/users/path", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathId }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(`Path changed to ${PATHS.find((p) => p.id === pathId)?.name}`, "success");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        addToast(json.error?.message || t("Failed to update"), "error");
      }
    } catch {
      addToast(t("Network error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <A href="/profile" class="text-sm text-ink-secondary hover:text-ink-primary transition-colors">
          ← {t("Back to profile")}
        </A>
        <h1 class="text-2xl font-display font-bold text-ink-primary mt-2">🎓 Your Path</h1>
        <p class="text-sm text-ink-secondary mt-1">
          Your path determines which features unlock first and what quests you receive.
          Switch anytime — your notes and progress are always safe.
        </p>
      </div>

      <div class="space-y-3">
        <For each={PATHS}>
          {(path) => {
            const isSelected = () => current() === path.id;
            return (
              <button
                type="button"
                onClick={() => handleSelect(path.id)}
                disabled={saving()}
                class={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                  isSelected()
                    ? "border-accent bg-accent/5 shadow-md"
                    : "border-surface-border bg-surface-elevated hover:border-accent/30"
                } ${saving() ? "opacity-70 cursor-wait" : "cursor-pointer"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2`}
                aria-pressed={isSelected()}
              >
                <div class="flex items-start gap-4">
                  <span class="text-3xl shrink-0" aria-hidden="true">{path.icon}</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <h3 class="font-semibold text-ink-primary">{path.name}</h3>
                      <Show when={isSelected()}>
                        <span class="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">Current</span>
                      </Show>
                    </div>
                    <p class="text-sm text-ink-secondary mt-1">{path.desc}</p>
                    <p class="text-xs text-ink-tertiary mt-2">{PATH_DESCRIPTIONS[path.id]}</p>
                  </div>
                </div>
              </button>
            );
          }}
        </For>
      </div>

      <div class="flex items-center gap-2 text-xs text-ink-tertiary">
        <Nelar state="curious" size={24} />
        <span>Changing path affects quest recommendations and feature unlock order.</span>
      </div>
    </div>
  );
}
