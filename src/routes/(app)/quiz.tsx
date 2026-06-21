import { createResource, For, Show, createSignal, createEffect } from "solid-js";
import { A } from "@solidjs/router";
import { authFetch, user } from "~/stores/auth";
import { addToast } from "~/stores/ui";
import Nelar from "~/components/mascot/Nelar";
import { playSound } from "~/lib/sound";

export default function QuizPage() {
  const [pending, { refetch }] = createResource(async () => {
    const res = await authFetch("/api/quiz/pending");
    const json = await res.json();
    // Let .error propagate so the UI distinguishes a fetch failure from a
    // legitimate "no quizzes pending". Masking errors as `[]` previously
    // showed "Write longer notes" to users who were simply offline.
    if (!json.success) throw new Error(json.error?.message ?? "Failed to load quizzes");
    return json.data ?? [];
  });

  const [currentQuiz, setCurrentQuiz] = createSignal<any>(null);
  const [answers, setAnswers] = createSignal<number[]>([]);
  const [score, setScore] = createSignal<number | null>(null);
  const [feedback, setFeedback] = createSignal<string | null>(null);
  const [difficultyMap, setDifficultyMap] = createSignal<Record<string, number>>({});

  createEffect(() => {
    const items = pending();
    if (items && items.length > 0) {
      const ids = items.map((q: any) => q.id);
      authFetch("/api/quiz/difficulty-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizIds: ids }),
      }).then(r => r.json()).then(j => {
        if (j.success) setDifficultyMap(j.data);
      }).catch(() => {});
    }
  });

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
      playSound(json.data.score >= 70 ? "quizCorrect" : "quizWrong");
      addToast(
        `Quiz completed! Score: ${json.data.score}%`,
        json.data.score >= 70 ? "success" : "info"
      );
      refetch();
    }
  };

  const submitFeedback = async (type: "good" | "bad") => {
    setFeedback(type);
    const currentQuizId = currentQuiz()?.id;
    if (currentQuizId) {
      await authFetch(`/api/quiz/${currentQuizId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: type }),
      });
    }
  };

  return (
    <div class="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 class="text-xl sm:text-2xl font-display font-bold text-ink-primary">
        Quiz Review
      </h1>
      <Show
        when={!pending.loading && !currentQuiz() && !pending.error}
        fallback={
          <Show
            when={!pending.error}
            fallback={
              <div class="text-center py-12">
                <p class="text-3xl mb-3 text-error">⚠</p>
                <p class="text-ink-primary font-medium mb-1">Couldn't load your quizzes</p>
                <p class="text-sm text-ink-secondary mb-4">Check your connection and try again.</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  class="px-4 py-2 bg-accent text-surface-overlay rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
                >
                  Try again
                </button>
              </div>
            }
          >
            <div class="h-32 bg-surface-border rounded-xl animate-pulse" />
          </Show>
        }
      >
        <Show
          when={(pending()?.length ?? 0) > 0 && !currentQuiz()}
          fallback={
            currentQuiz() ? null : (
              <div class="text-center py-12 text-ink-secondary">
                <Nelar state="curious" size={56} class="mx-auto mb-2" />
                <p>No quizzes pending review</p>
                <p class="text-sm mb-4">
                  Write longer notes (100+ words) to generate quizzes!
                </p>
                <A
                  href="/notes/new"
                  class="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-surface-overlay rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
                >
                  ✍️ Write a note
                </A>
              </div>
            )
          }
        >
          <div class="space-y-3">
            <For each={pending()}>
              {(q: any) => {
                const badge = () => {
                  const d = difficultyMap()[q.id];
                  if (d === undefined) return null;
                  if (d > 70) return { label: "Challenging", color: "text-error" };
                  if (d > 40) return { label: "Moderate", color: "text-accent" };
                  return { label: "Easy", color: "text-success" };
                };

                return (
                  <button
                    type="button"
                    class="w-full text-left bg-surface-elevated rounded-xl p-4 border border-surface-border hover:border-accent/30 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                    onClick={() => startQuiz(q)}
                    aria-label={`Review quiz ${q.reviewCount + 1} of 4${badge() ? `, ${badge()!.label}` : ""}`}
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
                      <span class="text-accent text-sm" aria-hidden="true">Start →</span>
                    </div>
                  </button>
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
                  <Show when={!feedback()}>
                    <div class="flex items-center justify-center gap-4 mt-4">
                      <p class="text-xs text-ink-secondary">Quiz quality:</p>
                      <button onClick={() => submitFeedback("good")} class="px-3 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 text-sm">👍 Good questions</button>
                      <button onClick={() => submitFeedback("bad")} class="px-3 py-1.5 rounded-lg bg-error/10 text-error hover:bg-error/20 text-sm">👎 Needs improvement</button>
                    </div>
                  </Show>
                  <Show when={feedback()}>
                    <p class="text-xs text-ink-secondary/60 text-center mt-4">Thanks for your feedback!</p>
                  </Show>
                  <button
                    onClick={() => {
                      setCurrentQuiz(null);
                      setScore(null);
                      setFeedback(null);
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
                      <p class="font-medium text-ink-primary mb-3 text-sm sm:text-base">
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
