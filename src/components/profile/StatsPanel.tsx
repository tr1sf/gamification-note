interface StatItem {
  label: string;
  value: string | number;
  icon: string;
}

interface StatsPanelProps {
  stats: StatItem[];
}

export default function StatsPanel(props: StatsPanelProps) {
  return (
    <div class="p-6 rounded-xl border border-surface-border bg-surface-elevated">
      <h2 class="text-lg font-display font-bold text-ink-primary mb-4">Stats</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {props.stats.map((stat) => (
          <div class="text-center p-3 rounded-lg bg-surface">
            <span class="text-2xl" aria-hidden="true">{stat.icon}</span>
            <p class="text-xl font-bold text-ink-primary mt-1">{stat.value}</p>
            <p class="text-xs text-ink-secondary">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
