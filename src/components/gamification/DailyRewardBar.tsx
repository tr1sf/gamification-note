import { onMount, Show } from "solid-js";
import { dailyLimits, fetchDailyLimits } from "~/stores/user";

const BAR_COLORS = {
  normal: "from-accent to-accent/70",
  warning: "from-amber-500 to-orange-500",
  full: "from-error to-red-600",
};

function getBarColor(pct: number): string {
  if (pct >= 100) return BAR_COLORS.full;
  if (pct >= 70) return BAR_COLORS.warning;
  return BAR_COLORS.normal;
}

export default function DailyRewardBar() {
  let tooltipRef: HTMLDivElement | undefined;

  onMount(() => {
    fetchDailyLimits();
  });

  const xpPct = () => {
    const limits = dailyLimits();
    if (!limits) return 0;
    return Math.min(100, Math.round((limits.xpEarned / limits.effectiveXpCap) * 100));
  };

  const coinPct = () => {
    const limits = dailyLimits();
    if (!limits) return 0;
    return Math.min(100, Math.round((limits.coinsEarned / limits.effectiveCoinCap) * 100));
  };

  const xpColor = () => getBarColor(xpPct());
  const coinColor = () => getBarColor(coinPct());

  return (
    <Show when={dailyLimits()}>
      <div
        class="relative group"
        onMouseEnter={() => tooltipRef?.classList.remove("hidden")}
        onMouseLeave={() => tooltipRef?.classList.add("hidden")}
      >
        {/* XP Bar */}
        <div class="mb-1.5">
          <div class="flex items-center justify-between mb-0.5">
            <span class="text-[10px] text-ink-secondary font-medium">
              ⚡ Daily XP
            </span>
            <span class="text-[10px] text-ink-secondary">
              {dailyLimits()!.xpEarned} / {dailyLimits()!.effectiveXpCap}
            </span>
          </div>
          <div class="h-1.5 bg-surface-border rounded-full overflow-hidden">
            <div
              class={`h-full bg-gradient-to-r ${xpColor()} rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${xpPct()}%` }}
            />
          </div>
        </div>

        {/* Coin Bar */}
        <div class="mb-1">
          <div class="flex items-center justify-between mb-0.5">
            <span class="text-[10px] text-ink-secondary font-medium">
              🪙 Coins
            </span>
            <span class="text-[10px] text-ink-secondary">
              {dailyLimits()!.coinsEarned} / {dailyLimits()!.effectiveCoinCap}
            </span>
          </div>
          <div class="h-1.5 bg-surface-border rounded-full overflow-hidden">
            <div
              class={`h-full bg-gradient-to-r ${coinColor()} rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${coinPct()}%` }}
            />
          </div>
        </div>

        {/* Streak bonus indicator */}
        <Show when={dailyLimits()!.streakBonus > 0}>
          <div class="text-[10px] text-amber-500 text-center">
            🔥 Streak bonus: +{Math.round(dailyLimits()!.streakBonus * 100)}%
          </div>
        </Show>

        {/* Cap reached warning */}
        <Show when={xpPct() >= 100 || coinPct() >= 100}>
          <div class="text-[10px] text-error text-center mt-0.5 animate-pulse">
            Daily limit reached — come back tomorrow!
          </div>
        </Show>

        {/* Tooltip with breakdown */}
        <div
          ref={tooltipRef}
          class="hidden absolute left-full top-0 ml-2 z-50 w-48 p-2 bg-surface-elevated border border-surface-border rounded-lg shadow-lg text-xs"
        >
          <div class="font-medium text-ink-primary mb-1">Today's Rewards</div>
          <div class="space-y-0.5 text-ink-secondary">
            <div class="flex justify-between">
              <span>XP earned:</span>
              <span>{dailyLimits()!.xpEarned} / {dailyLimits()!.effectiveXpCap}</span>
            </div>
            <div class="flex justify-between">
              <span>Coins earned:</span>
              <span>{dailyLimits()!.coinsEarned} / {dailyLimits()!.effectiveCoinCap}</span>
            </div>
            <div class="border-t border-surface-border mt-1 pt-1">
              <div class="flex justify-between">
                <span>Resets at:</span>
                <span>{new Date(dailyLimits()!.resetAt).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
