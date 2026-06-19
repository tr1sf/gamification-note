import { createSignal, For, Show } from "solid-js";
import { authFetch, fetchMe } from "~/stores/auth";
import { addToast } from "~/stores/ui";
import { PATH_DESCRIPTIONS, type UserPath } from "~/lib/path-unlocks";
import { applyLanguage, getCurrentLang, t } from "~/lib/i18n";

type Motivation = "adventurer" | "scholar" | "collaborator";

const PATH_OPTIONS: Array<{ id: UserPath; icon: string; title: string; subtitle: string; style: string }> = [
  {
    id: "student",
    icon: "\uD83C\uDF93",
    title: "Student",
    subtitle: "I'm here to study and learn",
    style: "balanced",
  },
  {
    id: "professional",
    icon: "\uD83D\uDCBC",
    title: "Professional",
    subtitle: "I'm here for work and productivity",
    style: "minimal",
  },
  {
    id: "journaler",
    icon: "\uD83D\uDCD4",
    title: "Journaler",
    subtitle: "I'm here for daily reflection",
    style: "solo",
  },
];

const MOTIVATION_OPTIONS: Array<{ id: Motivation; icon: string; title: string; subtitle: string; gamificationStyle: string; preview: string }> = [
  {
    id: "adventurer",
    icon: "\u2694\uFE0F",
    title: "Adventurer",
    subtitle: "I love quests, boss fights, and leveling up!",
    gamificationStyle: "competitive",
    preview: "Boss Fight \u2022 HP \u2022 Damage",
  },
  {
    id: "scholar",
    icon: "\uD83C\uDF31",
    title: "Scholar",
    subtitle: "I prefer growth, milestones, and knowledge journeys",
    gamificationStyle: "balanced",
    preview: "Challenges \u2022 Constellation \u2022 Growth",
  },
  {
    id: "collaborator",
    icon: "\uD83E\uDD1D",
    title: "Collaborator",
    subtitle: "I'm here for community and shared goals",
    gamificationStyle: "collaborative",
    preview: "Circles \u2022 Encouragement \u2022 Shared Goals",
  },
];

const FIRST_QUEST_TASKS = [
  { id: "scroll", label: "Write your first scroll", href: "/notes/new", button: "Open New Note" },
  { id: "profile", label: "View your character sheet", href: "/profile", button: "View Profile" },
  { id: "gift", label: "Claim your welcome gift", href: null, button: "Claim Gift" },
];

export default function OnboardingWizard(props: { onComplete: () => void }) {
  const [step, setStep] = createSignal(0);
  const [path, setPath] = createSignal<UserPath>("student");
  const [motivation, setMotivation] = createSignal<Motivation>("adventurer");
  const [submitting, setSubmitting] = createSignal(false);
  const [giftClaimed, setGiftClaimed] = createSignal(false);
  const [completedTasks, setCompletedTasks] = createSignal<string[]>([]);
  const [consentAccepted, setConsentAccepted] = createSignal(false);

  const totalSteps = 5; // 0=Lang, 1=Consent, 2=Path, 3=Motivation, 4=Gift

  function nextStep() {
    if (step() < totalSteps) setStep((s) => s + 1);
  }

  function prevStep() {
    if (step() > 0) setStep((s) => s - 1);
  }

  function markTask(taskId: string) {
    setCompletedTasks((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));
  }

  async function claimGift() {
    if (giftClaimed()) return;
    setSubmitting(true);
    try {
      const style =
        motivation() === "adventurer"
          ? "competitive"
          : motivation() === "scholar"
            ? "balanced"
            : "collaborative";

      const res = await authFetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gamificationStyle: style, path: path() }),
      });
      const json = await res.json();
      if (json.success) {
        setGiftClaimed(true);
        markTask("gift");
        addToast(`Welcome gift claimed! +${json.data.coinsGained} coins`, "success");
        // Refresh user state so onboardingCompleted is true on the auth signal
        await fetchMe();
        setTimeout(() => props.onComplete(), 1500);
      } else {
        addToast("Failed to claim gift. Try again.", "error");
      }
    } catch {
      addToast("Failed to claim gift. Try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const canProceed = () => {
    if (step() === 1) return consentAccepted();
    if (step() === 4) return giftClaimed();
    return true;
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-surface p-4">
      <div class="w-full max-w-xl">
        {/* Step indicators */}
        <div class="flex items-center justify-center gap-2 mb-8">
          <For each={[0, 1, 2, 3, 4]}>
            {(i) => (
              <div class="flex items-center gap-2">
                <div
                  class={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    i <= step()
                      ? "bg-accent text-surface-overlay shadow-md shadow-accent/20"
                      : "bg-surface-border text-ink-secondary"
                  }`}
                >
                  {i < step() ? "\u2713" : i + 1}
                </div>
                {i < 4 && (
                  <div
                    class={`w-10 h-0.5 transition-colors duration-300 ${
                      i < step() ? "bg-accent" : "bg-surface-border"
                    }`}
                  />
                )}
              </div>
            )}
          </For>
        </div>

        {/* Step content */}
        <div
          class="rounded-2xl border border-surface-border bg-surface-elevated p-4 sm:p-6 shadow-md"
          style={`animation: fade-up 0.35s ease-out`}
        >
          <Show when={step() === 0}>
            <StepLanguage />
          </Show>
          <Show when={step() === 1}>
            <StepConsent accepted={consentAccepted} setAccepted={setConsentAccepted} />
          </Show>
          <Show when={step() === 2}>
            <StepChoosePath path={path} setPath={setPath} />
          </Show>
          <Show when={step() === 3}>
            <StepMotivation motivation={motivation} setMotivation={setMotivation} />
          </Show>
          <Show when={step() === 4}>
            <StepFirstQuest
              completedTasks={completedTasks}
              markTask={markTask}
              giftClaimed={giftClaimed}
              claimGift={claimGift}
              submitting={submitting}
            />
          </Show>

          {/* Navigation */}
          <div class="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-surface-border">
            <Show when={step() > 0} fallback={<div class="hidden sm:block" />}>
              <button
                onClick={prevStep}
                class="w-full sm:w-auto px-4 py-2 text-sm text-ink-secondary hover:text-ink-primary transition-colors order-2 sm:order-1"
              >
                &larr; {t("Back")}
              </button>
            </Show>

            <Show when={step() < 4}>
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                class={`ml-auto px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-[0.98] ${
                  canProceed()
                    ? "bg-accent text-surface-overlay hover:bg-accent-hover"
                    : "bg-surface-border text-ink-secondary cursor-not-allowed"
                }`}
              >
                {t("Continue →")}
              </button>
            </Show>

            <Show when={step() === 4}>
              <button
                onClick={() => props.onComplete()}
                disabled={!giftClaimed()}
                class={`ml-auto px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-[0.98] ${
                  giftClaimed()
                    ? "bg-accent text-surface-overlay hover:bg-accent-hover"
                    : "bg-surface-border text-ink-secondary cursor-not-allowed"
                }`}
              >
                {t("Enter the Tavern →")}
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepLanguage() {
  const lang = () => getCurrentLang();
  const select = (l: "en" | "vi") => applyLanguage(l);
  return (
    <div>
      <h2 class="text-xl font-display font-bold text-ink-primary mb-1">{t("Language / Ngôn Ngữ")}</h2>
      <p class="text-sm text-ink-secondary mb-5">{t("Choose your preferred language")}</p>
      <div class="grid grid-cols-2 gap-3">
        <button onClick={() => select("en")} class={`p-4 rounded-xl border-2 text-left transition-all ${lang() === "en" ? "border-accent bg-accent/5 shadow-sm" : "border-surface-border hover:border-accent/30"}`}>
          <p class="text-2xl mb-1">🇬🇧</p>
          <p class="font-semibold text-ink-primary">{t("English")}</p>
          <p class="text-xs text-ink-secondary">{t("Default")}</p>
        </button>
        <button onClick={() => select("vi")} class={`p-4 rounded-xl border-2 text-left transition-all ${lang() === "vi" ? "border-accent bg-accent/5 shadow-sm" : "border-surface-border hover:border-accent/30"}`}>
          <p class="text-2xl mb-1">🇻🇳</p>
          <p class="font-semibold text-ink-primary">{t("Tiếng Việt")}</p>
          <p class="text-xs text-ink-secondary">{t("Beta")}</p>
        </button>
      </div>
    </div>
  );
}

function StepConsent(props: { accepted: () => boolean; setAccepted: (v: boolean) => void }) {
  return (
    <div>
      <h2 class="text-xl font-display font-bold text-ink-primary mb-1">{t("Privacy & Data Usage")}</h2>
      <p class="text-sm text-ink-secondary mb-5">{t("Your notes are private. AI processing is anonymous.")}</p>
      <div class="bg-surface rounded-xl p-4 border border-surface-border text-sm text-ink-secondary space-y-2 mb-4">
        <p>• Your notes are <span class="font-medium text-ink-primary">private by default</span> — only you can see them</p>
        <p>• AI features process your notes <span class="font-medium text-ink-primary">anonymously</span> to generate quizzes and summaries</p>
        <p>• Analytics data (XP, quests) is collected only to improve your experience</p>
        <p>\u2022 You can request data deletion anytime by contacting the developer.</p>
        <p>\u2022 <span class="text-accent underline cursor-pointer" onClick={() => window.open("/privacy", "_blank")}>Full Privacy Policy</span></p>
      </div>
      <label class="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-surface-border hover:border-accent/30 transition-colors">
        <input type="checkbox" checked={props.accepted()} onChange={(e) => props.setAccepted(e.currentTarget.checked)}
          class="mt-0.5 w-4 h-4 rounded border-surface-border accent-accent" />
        <span class="text-sm text-ink-primary">{t("I understand and agree to the data usage policy.")}</span>
      </label>
    </div>
  );
}

function StepChoosePath(props: { path: () => UserPath; setPath: (p: UserPath) => void }) {
  return (
    <div>
      <h2 class="text-xl font-display font-bold text-ink-primary mb-1">{t("Choose Your Path")}</h2>
      <p class="text-sm text-ink-secondary mb-5">{t("Each path unlocks features at different paces")}</p>
      <div class="grid gap-3">
        <For each={PATH_OPTIONS}>
          {(option) => (
            <button
              onClick={() => props.setPath(option.id)}
              class={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all duration-200 group ${
                props.path() === option.id
                  ? "border-accent bg-accent/5 shadow-sm"
                  : "border-surface-border hover:border-surface-border/80 hover:bg-surface-hover"
              }`}
            >
              <span class="text-3xl shrink-0">{option.icon}</span>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-ink-primary">{t(option.title)}</p>
                <p class="text-sm text-ink-secondary">{t(option.subtitle)}</p>
                <p class="text-[0.65rem] text-accent/50 mt-1 leading-relaxed line-clamp-2" title={PATH_DESCRIPTIONS[option.id]}>
                  {PATH_DESCRIPTIONS[option.id]}
                </p>
              </div>
              <span
                class={`ml-auto shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  props.path() === option.id
                    ? "border-accent bg-accent"
                    : "border-surface-border"
                }`}
              >
                <Show when={props.path() === option.id}>
                  <span class="w-2 h-2 rounded-full bg-white" />
                </Show>
              </span>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

function StepMotivation(props: { motivation: () => Motivation; setMotivation: (m: Motivation) => void }) {
  return (
    <div>
      <h2 class="text-xl font-display font-bold text-ink-primary mb-1">{t("What Motivates You?")}</h2>
      <p class="text-sm text-ink-secondary mb-5">{t("Choose your adventure style")}</p>
      <div class="grid gap-3">
        <For each={MOTIVATION_OPTIONS}>
          {(option) => (
            <button
              onClick={() => props.setMotivation(option.id)}
              class={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                props.motivation() === option.id
                  ? "border-accent bg-accent/5 shadow-sm"
                  : "border-surface-border hover:border-surface-border/80 hover:bg-surface-hover"
              }`}
            >
              <span class="text-3xl shrink-0">{option.icon}</span>
              <div class="min-w-0">
                <p class="font-semibold text-ink-primary">{t(option.title)}</p>
                <p class="text-sm text-ink-secondary">{t(option.subtitle)}</p>
                <p class="text-xs text-accent/70 mt-1 font-mono">{t(option.preview)}</p>
              </div>
              <span
                class={`ml-auto shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  props.motivation() === option.id
                    ? "border-accent bg-accent"
                    : "border-surface-border"
                }`}
              >
                <Show when={props.motivation() === option.id}>
                  <span class="w-2 h-2 rounded-full bg-white" />
                </Show>
              </span>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

function StepFirstQuest(props: {
  completedTasks: () => string[];
  markTask: (id: string) => void;
  giftClaimed: () => boolean;
  claimGift: () => void;
  submitting: () => boolean;
}) {
  return (
    <div>
      <h2 class="text-xl font-display font-bold text-ink-primary mb-1">{t("Your First Quest")}</h2>
      <p class="text-sm text-ink-secondary mb-5">{t("Complete these tasks to begin your journey")}</p>
      <div class="grid gap-3">
        <For each={FIRST_QUEST_TASKS}>
          {(task) => {
            const isDone = () => props.completedTasks().includes(task.id);
            return (
              <div
                class={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${
                  isDone()
                    ? "border-success/30 bg-success/5"
                    : "border-surface-border bg-surface-hover/30"
                }`}
              >
                <span class="text-2xl shrink-0">{isDone() ? "\u2705" : "\u2B55"}</span>
                <p class={`flex-1 text-sm font-medium ${isDone() ? "text-success line-through opacity-70" : "text-ink-primary"}`}>
                  {t(task.label)}
                </p>
                <Show
                  when={task.id === "gift"}
                  fallback={
                    <a
                      href={task.href!}
                      onClick={() => props.markTask(task.id)}
                      class={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        isDone()
                          ? "bg-surface-border text-ink-secondary cursor-default pointer-events-none"
                          : "bg-accent/10 text-accent hover:bg-accent/20"
                      }`}
                    >
                      {t(task.button)}
                    </a>
                  }
                >
                  <button
                    onClick={props.claimGift}
                    disabled={props.giftClaimed() || props.submitting()}
                    class={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      props.giftClaimed()
                        ? "bg-surface-border text-ink-secondary cursor-default"
                        : props.submitting()
                          ? "bg-accent/10 text-accent/60 cursor-wait"
                          : "bg-coin/15 text-coin hover:bg-coin/25"
                    }`}
                  >
                    {props.submitting() ? t("Claiming...") : props.giftClaimed() ? t("Claimed!") : t(task.button)}
                  </button>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
      <Show when={props.giftClaimed()}>
        <div
          class="mt-4 p-3 rounded-lg bg-success/10 border border-success/20 text-sm text-success text-center"
          style="animation: fade-up 0.3s ease-out"
        >
          +50 Coins &amp; Beginner Badge unlocked! Welcome to the tavern!
        </div>
      </Show>
    </div>
  );
}
