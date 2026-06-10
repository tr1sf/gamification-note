import { For } from "solid-js";

export interface RadarStat {
  /** Axis label, e.g. "Intel" */
  label: string;
  /** Value on a 0–100 scale */
  value: number;
  /** Accent color for the vertex dot (hex) */
  color: string;
}

interface RadarChartProps {
  /** Exactly 5 stats, ordered clockwise from the top vertex. */
  stats: RadarStat[];
  /** Pixel size of the square SVG viewport. */
  size?: number;
}

/**
 * A self-contained inline-SVG pentagon "stats radar" / spider chart.
 * No chart library — vertices are computed with Math.cos / Math.sin.
 * The data polygon is a translucent lime-green fill with a brighter stroke.
 */
export default function RadarChart(props: RadarChartProps) {
  const size = () => props.size ?? 320;
  const cx = () => size() / 2;
  const cy = () => size() / 2;
  const radius = () => size() / 2 - 44; // leave room for axis labels

  const count = () => Math.max(1, props.stats.length);

  // Angle for axis i — start at the top (-90°) and go clockwise.
  const angleFor = (i: number) => (-Math.PI / 2) + (i * 2 * Math.PI) / count();

  // Point on a given axis at a 0..1 fraction of the radius.
  const pointAt = (i: number, fraction: number) => {
    const a = angleFor(i);
    return {
      x: cx() + Math.cos(a) * radius() * fraction,
      y: cy() + Math.sin(a) * radius() * fraction,
    };
  };

  const ringFractions = [0.25, 0.5, 0.75, 1];

  const ringPoints = (fraction: number) =>
    props.stats.map((_, i) => pointAt(i, fraction)).map((p) => `${p.x},${p.y}`).join(" ");

  const dataPoints = () =>
    props.stats
      .map((s, i) => pointAt(i, Math.max(0, Math.min(100, s.value)) / 100))
      .map((p) => `${p.x},${p.y}`)
      .join(" ");

  const summary = () =>
    props.stats.map((s) => `${s.label} ${Math.round(s.value)} out of 100`).join(", ");

  // Nudge labels slightly outward from the outer vertex.
  const labelPos = (i: number) => {
    const a = angleFor(i);
    return {
      x: cx() + Math.cos(a) * (radius() + 24),
      y: cy() + Math.sin(a) * (radius() + 24),
    };
  };

  const anchorFor = (i: number) => {
    const x = Math.cos(angleFor(i));
    if (Math.abs(x) < 0.3) return "middle";
    return x > 0 ? "start" : "end";
  };

  return (
    <div role="img" aria-label={`Stats radar chart. ${summary()}.`}>
      <svg
        viewBox={`0 0 ${size()} ${size()}`}
        width="100%"
        height="100%"
        class="overflow-visible"
        aria-hidden="true"
      >
        {/* concentric pentagon grid rings */}
        <For each={ringFractions}>
          {(f) => (
            <polygon
              points={ringPoints(f)}
              fill="none"
              stroke="#1f2a1f"
              stroke-width="1"
            />
          )}
        </For>

        {/* spokes */}
        <For each={props.stats}>
          {(_, i) => {
            const outer = pointAt(i(), 1);
            return (
              <line
                x1={cx()}
                y1={cy()}
                x2={outer.x}
                y2={outer.y}
                stroke="#1f2a1f"
                stroke-width="1"
              />
            );
          }}
        </For>

        {/* data polygon */}
        <polygon
          points={dataPoints()}
          fill="rgba(74, 222, 128, 0.18)"
          stroke="#4ade80"
          stroke-width="2"
          stroke-linejoin="round"
        />

        {/* vertex dots */}
        <For each={props.stats}>
          {(s, i) => {
            const p = pointAt(i(), Math.max(0, Math.min(100, s.value)) / 100);
            return <circle cx={p.x} cy={p.y} r="3.5" fill={s.color} />;
          }}
        </For>

        {/* axis labels */}
        <For each={props.stats}>
          {(s, i) => {
            const lp = labelPos(i());
            return (
              <text
                x={lp.x}
                y={lp.y}
                fill="#86efac"
                font-size="12"
                font-family="'JetBrains Mono', monospace"
                text-anchor={anchorFor(i())}
                dominant-baseline="middle"
              >
                {s.label}
              </text>
            );
          }}
        </For>
      </svg>
    </div>
  );
}
