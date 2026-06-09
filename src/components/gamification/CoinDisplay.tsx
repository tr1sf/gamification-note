interface CoinDisplayProps {
  coins: number;
  compact?: boolean;
}

export default function CoinDisplay(props: CoinDisplayProps) {
  return (
    <div class="inline-flex items-center gap-1" aria-live="polite" aria-label={`${props.coins} coins`}>
      <span aria-hidden="true" class="text-base">🪙</span>
      <span class={`font-mono font-bold text-coin ${props.compact ? "text-xs" : "text-sm"}`}>
        {props.coins.toLocaleString()}
      </span>
    </div>
  );
}
