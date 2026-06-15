import { createResource, createSignal, Show, For } from "solid-js";
import { authFetch } from "~/stores/auth";
import { addToast } from "~/stores/ui";

interface SurveyQuestion {
  id: string;
  text: string;
  type: "likert" | "text";
  required: boolean;
}

interface SurveyData {
  id: string;
  title: string;
  questions: SurveyQuestion[];
}

export default function SurveyWidget() {
  const [surveys, { refetch }] = createResource(async () => {
    const res = await authFetch("/api/surveys");
    const json = await res.json();
    return json.success ? (json.data as SurveyData[]) : [];
  });
  const [currentSurvey, setCurrentSurvey] = createSignal<SurveyData | null>(null);
  const [answers, setAnswers] = createSignal<Record<string, any>>({});
  const [comments, setComments] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  const startSurvey = (survey: SurveyData) => {
    setCurrentSurvey(survey);
    setAnswers({});
    setComments("");
  };

  const setAnswer = (questionId: string, score: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { answerScore: score } }));
  };

  const submit = async () => {
    setSubmitting(true);
    const formattedAnswers = currentSurvey()!.questions.map((q) => answers()[q.id] || {});
    const res = await authFetch("/api/surveys", {
      method: "POST",
      body: JSON.stringify({ surveyId: currentSurvey()!.id, answers: formattedAnswers, comments: comments() }),
    });
    const json = await res.json();
    if (json.success) {
      addToast("Survey complete! +50 coins", "success");
      setCurrentSurvey(null);
      refetch();
    }
    setSubmitting(false);
  };

  return (
    <Show when={(surveys()?.length ?? 0) > 0}>
      <div class="fixed bottom-4 right-4 z-40">
        <Show
          when={!currentSurvey()}
          fallback={
            <div class="bg-surface-elevated rounded-xl p-6 border border-surface-border shadow-2xl w-96 max-h-[80vh] overflow-y-auto space-y-4">
              <h3 class="font-semibold text-ink-primary">{currentSurvey()?.title}</h3>
              <For each={currentSurvey()?.questions}>
                {(q, i) => (
                  <div>
                    <p class="text-sm text-ink-primary mb-2">{q.text}</p>
                    <Show
                      when={q.type === "likert"}
                      fallback={
                        <textarea
                          onInput={(e) => setComments(e.currentTarget.value)}
                          rows={2}
                          class="w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-sm resize-none"
                          placeholder="Your thoughts..."
                        />
                      }
                    >
                      <div class="flex gap-1">
                        {[1, 2, 3, 4, 5].map((score) => (
                          <button
                            onClick={() => setAnswer(q.id, score)}
                            class={`w-10 h-10 rounded-lg border text-sm font-medium transition-colors ${
                              answers()[q.id]?.answerScore === score
                                ? "border-accent bg-accent/10 text-accent"
                                : "border-surface-border text-ink-secondary hover:border-accent/30"
                            }`}
                          >
                            {score === 1 ? "\u{1F61E}" : score === 2 ? "\u{1F610}" : score === 3 ? "\u{1F642}" : score === 4 ? "\u{1F60A}" : "\u{1F60D}"}
                          </button>
                        ))}
                      </div>
                    </Show>
                  </div>
                )}
              </For>
              <button
                onClick={submit}
                disabled={submitting()}
                class="w-full py-2 bg-accent text-white rounded-lg text-sm font-medium"
              >
                {submitting() ? "Sending..." : "Submit Survey (+50 coins)"}
              </button>
            </div>
          }
        >
          <button
            onClick={() => startSurvey(surveys()![0])}
            class="bg-accent text-white px-4 py-3 rounded-xl shadow-lg hover:bg-accent/90 transition-colors flex items-center gap-2 animate-bounce"
          >
            <span class="text-lg">📋</span>
            <div class="text-left">
              <p class="text-sm font-semibold">Quick Survey</p>
              <p class="text-xs opacity-80">
                {surveys()!.length} pending · +50 coins
              </p>
            </div>
          </button>
        </Show>
      </div>
    </Show>
  );
}
