import { onMount, Show, createSignal } from "solid-js";
import { dailyLimits, fetchDailyLimits } from "~/stores/user";

export default function DailyRewardBar(props: { compact?: boolean }) {
  const [open, setOpen] = createSignal(false);

  onMount(() => {
    fetchDailyLimits();
  });

  const limits = () => dailyLimits();

  const xpPct = () => {
    const l = limits();
    if (!l) return 0;
    return Math.min(100, Math.round((l.xpEarned / l.effectiveXpCap) * 100));
  };

  const coinPct = () => {
    const l = limits();
    if (!l) return 0;
    return Math.min(100, Math.round((l.coinsEarned / l.effectiveCoinCap) * 100));
  };

  const xpFull = () => xpPct() >= 100;
  const coinFull = () => coinPct() >= 100;
  const anyFull = () => xpFull() || coinFull();
  const streakPct = () => Math.round((limits()?.streakBonus ?? 0) * 100);

  const resetLabel = () => {
    const r = limits()?.resetAt;
    if (!r) return "";
    const ms = new Date(r).getTime() - Date.now();
    if (ms <= 0) return "Now";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const fullContent = () => (
    <div class="space-y-2 min-w-[180px]">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-semibold text-ink-secondary tracking-wide uppercase">
          Daily Rewards
        </span>
        <span class="text-[10px] text-ink-muted">
          Resets in {resetLabel()}
        </span>
      </div>

      {/* XP row */}
      <div class="flex items-center gap-2">
        <span class="text-sm shrink-0">⚡</span>
        <div class="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            class={`h-full rounded-full transition-all duration-700 ease-out ${
              xpFull() ? "bg-red-500/60" : "bg-amber-500/40"
            }`}
            style={{ width: `${xpPct()}%` }}
          />
        </div>
        <span
          class={`text-[10px] tabular-nums shrink-0 w-14 text-right ${
            xpFull() ? "text-red-400" : "text-ink-muted"
          }`}
        >
          {limits()!.xpEarned}/{limits()!.effectiveXpCap}
        </span>
      </div>

      {/* Coins row */}
      <div class="flex items-center gap-2">
        <span class="text-sm shrink-0">🪙</span>
        <div class="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            class={`h-full rounded-full transition-all duration-700 ease-out ${
              coinFull() ? "bg-red-500/60" : "bg-amber-400/40"
            }`}
            style={{ width: `${coinPct()}%` }}
          />
        </div>
        <span
          class={`text-[10px] tabular-nums shrink-0 w-14 text-right ${
            coinFull() ? "text-red-400" : "text-ink-muted"
          }`}
        >
          {limits()!.coinsEarned}/{limits()!.effectiveCoinCap}
        </span>
      </div>

      {/* Footer */}
      <div class="flex items-center justify-between min-h-[14px]">
        <Show when={streakPct() > 0}>
          <span class="text-[10px] text-amber-400/80">🔥 +{streakPct()}% streak</span>
        </Show>
        <Show when={anyFull()}>
          <span class="text-[10px] text-red-400/80 animate-pulse ml-auto">Daily cap reached</span>
        </Show>
      </div>
    </div>
  );

  return (
    <Show when={limits()}>
      <Show
        when={props.compact}
        fallback={<div class="p-3">{fullContent()}</div>}
      >
        {/* Compact: button + dropdown */}
        <div class="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            class="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            classList={{
              "border-surface-border text-ink-secondary hover:border-amber-500/30 hover:text-amber-400": !anyFull(),
              "border-red-500/30 text-red-400 hover:border-red-500/50": anyFull(),
            }}
            title="Daily reward progress"
          >
            <span class="text-sm">{anyFull() ? "🏆" : "🎁"}</span>
            <span class="tabular-nums">{xpPct()}%</span>
          </button>

          <Show when={open()}>
            <div class="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div class="absolute top-full right-0 mt-2 z-50 p-3 bg-surface-elevated border border-surface-border rounded-xl shadow-xl">
              {fullContent()}
            </div>
          </Show>
        </div>
      </Show>
    </Show>
  );
}
