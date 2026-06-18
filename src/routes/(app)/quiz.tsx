import { createResource, For, Show, createSignal } from "solid-js";
import { authFetch, user } from "~/stores/auth";
import { addToast } from "~/stores/ui";

export default function QuizPage() {
  const [pending, { refetch }] = createResource(async () => {
    const res = await authFetch("/api/quiz/pending");
    const json = await res.json();
    return json.success ? json.data : [];
  });

  const [currentQuiz, setCurrentQuiz] = createSignal<any>(null);
  const [answers, setAnswers] = createSignal<number[]>([]);
  const [score, setScore] = createSignal<number | null>(null);

  const startQuiz = (quiz: any) => {
    setCurrentQuiz(quiz);
    setAnswers([]);
    setScore(null);
  };

  const selectAnswer = (qIndex: number, optIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[qIndex] = optIndex;
      return next;
    });
  };

  const submitQuiz = async () => {
    const res = await authFetch(`/api/quiz/${currentQuiz().id}/attempt`, {
      method: "POST",
      body: JSON.stringify({
        answers: answers().map((selectedIndex, questionIndex) => ({
          questionIndex,
          selectedIndex,
        })),
      }),
    });
    const json = await res.json();
    if (json.success) {
      setScore(json.data.score);
      addToast(
        `Quiz completed! Score: ${json.data.score}%`,
        json.data.score >= 70 ? "success" : "info"
      );
      refetch();
    }
  };

  return (
    <div class="max-w-2xl mx-auto p-6 space-y-6">
      <h1 class="text-2xl font-display font-bold text-ink-primary">
        Quiz Review
      </h1>
      <Show
        when={!pending.loading && !currentQuiz()}
        fallback={
          <div class="h-32 bg-surface-border rounded-xl animate-pulse" />
        }
      >
        <Show
          when={(pending()?.length ?? 0) > 0 && !currentQuiz()}
          fallback={
            currentQuiz() ? null : (
              <div class="text-center py-12 text-ink-secondary">
                <p class="text-4xl mb-3">🧠</p>
                <p>No quizzes pending review</p>
                <p class="text-sm">
                  Write longer notes (100+ words) to generate quizzes!
                </p>
              </div>
            )
          }
        >
          <div class="space-y-3">
            <For each={pending()}>
              {(q: any) => {
                const [difficulty, setDifficulty] = createSignal<number | null>(null);
                const currentUser = user();
                if (currentUser && typeof document !== "undefined") {
                  authFetch("/api/quiz/difficulty", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ quizId: q.id }),
                  }).then(r => r.json()).then(j => { if (j.success) setDifficulty(j.data.difficulty); }).catch(() => {});
                }

                const badge = () => {
                  if (difficulty() === null) return null;
                  const d = difficulty()!;
                  if (d > 70) return { label: "Challenging", color: "text-error" };
                  if (d > 40) return { label: "Moderate", color: "text-accent" };
                  return { label: "Easy", color: "text-success" };
                };

                return (
                  <div
                    class="bg-surface-elevated rounded-xl p-4 border border-surface-border hover:border-accent/30 cursor-pointer"
                    onClick={() => startQuiz(q)}
                  >
                    <div class="flex items-center gap-3">
                      <span class="text-2xl">🧠</span>
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <p class="font-medium text-ink-primary">
                            Quiz #{q.reviewCount + 1}
                          </p>
                          {badge() && (
                            <span class={`text-xs font-medium ${badge()!.color} bg-surface px-2 py-0.5 rounded-full`}>
                              {badge()!.label}
                            </span>
                          )}
                        </div>
                        <p class="text-xs text-ink-secondary">
                          {(q.questions as any)?.length ?? 3} questions · Review{" "}
                          {q.reviewCount + 1} of 4
                        </p>
                      </div>
                      <span class="text-accent text-sm">Start →</span>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </Show>
      <Show when={currentQuiz()}>
        {(q) => (
          <div class="bg-surface-elevated rounded-xl p-6 border border-surface-border space-y-4">
            <Show
              when={score() === null}
              fallback={
                <div class="text-center py-6">
                  <p class="text-3xl font-bold text-ink-primary mb-2">
                    {score()}%
                  </p>
                  <p class="text-sm text-ink-secondary">
                    {score()! >= 70
                      ? "Great job! Your knowledge is strong!"
                      : "Keep studying! Review your notes and try again."}
                  </p>
                  <button
                    onClick={() => {
                      setCurrentQuiz(null);
                      setScore(null);
                    }}
                    class="mt-4 text-accent hover:underline text-sm"
                  >
                    Back to quizzes
                  </button>
                </div>
              }
            >
              <div>
                <For each={(q().questions as any[]) ?? []}>
                  {(question: any, i: () => number) => (
                    <div class="mb-6">
                      <p class="font-medium text-ink-primary mb-3">
                        {i() + 1}. {question.question}
                      </p>
                      <div class="space-y-2">
                        <For each={question.options as string[]}>
                          {(opt: string, oi: () => number) => (
                            <button
                              onClick={() => selectAnswer(i(), oi())}
                              class={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                                answers()[i()] === oi()
                                  ? "border-accent bg-accent/10 text-accent"
                                  : "border-surface-border text-ink-secondary hover:border-surface-border/80"
                              }`}
                            >
                              {opt}
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </For>
              </div>
              <button
                onClick={submitQuiz}
                disabled={
                  answers().filter((a) => a !== undefined).length !==
                  (q().questions as any[])?.length
                }
                class="w-full py-3 bg-accent text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Answers
              </button>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
