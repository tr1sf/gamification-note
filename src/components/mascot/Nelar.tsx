import { Show } from "solid-js";

export type NelarState = "idle" | "sleeping" | "happy" | "curious" | "worried" | "wave";

interface NelarProps {
  state?: NelarState;
  size?: number;
  class?: string;
  float?: boolean;
  animated?: boolean;
  ariaLabel?: string;
}

/**
 * Nelar — the TavernoteX tavern cat mascot.
 * Round cartoon cat with a medieval scarf. All fills use CSS variables so
 * Nelar adapts to the equipped theme automatically.
 *
 * States:
 *  - idle:     eyes open, gentle smile, tail wagging
 *  - sleeping: eyes closed, floating Zz, tail still
 *  - happy:    eyes as happy arcs, big grin, sparkles
 *  - curious:  head tilt, big eyes, question mark
 *  - worried:  ears flat, worried brows, small frown
 *  - wave:      one paw raised in greeting, friendly smile
 */
export default function Nelar(props: NelarProps) {
  const state = () => props.state ?? "idle";
  const size = () => props.size ?? 64;
  const label = () =>
    props.ariaLabel ?? `Nelar the tavern cat, ${state()}`;

  const stateClass = () => {
    if (props.float) return "nelar-float";
    switch (state()) {
      case "idle": return props.animated !== false ? "nelar-tail-wag" : "";
      case "happy": return "nelar-bounce";
      default: return "";
    }
  };

  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class={`${stateClass()} ${props.class ?? ""}`}
      role="img"
      aria-label={label()}
    >
      <title>{label()}</title>

      {/* ── Tail (behind body) ── */}
      <g class={state() === "idle" ? "nelar-tail-part" : ""}>
        <path
          d="M78 62 C88 56 92 44 86 36 C84 33 80 32 77 34"
          stroke="var(--color-accent)"
          stroke-width="8"
          stroke-linecap="round"
          fill="none"
        />
        <path
          d="M78 62 C88 56 92 44 86 36 C84 33 80 32 77 34"
          stroke="var(--color-surface-elevated)"
          stroke-width="3"
          stroke-linecap="round"
          fill="none"
          opacity="0.3"
        />
      </g>

      {/* ── Body (round) ── */}
      <ellipse cx="50" cy="68" rx="24" ry="20" fill="var(--color-accent)" />
      {/* Belly */}
      <ellipse cx="50" cy="72" rx="16" ry="13" fill="var(--color-surface-elevated)" opacity="0.5" />

      {/* ── Scarf (medieval band) ── */}
      <path
        d="M28 56 Q50 50 72 56 L70 62 Q50 57 30 62 Z"
        fill="var(--color-xp)"
      />
      <circle cx="50" cy="59" r="2" fill="var(--color-coin)" opacity="0.8" />

      {/* ── Head ── */}
      {/* Ears */}
      <path
        d="M34 30 L30 14 L44 24 Z"
        fill="var(--color-accent)"
        transform={state() === "curious" ? "rotate(-10 37 22)" : state() === "worried" ? "translate(2 4) rotate(8 37 22)" : ""}
      />
      <path
        d="M66 30 L70 14 L56 24 Z"
        fill="var(--color-accent)"
        transform={state() === "curious" ? "rotate(10 63 22)" : state() === "worried" ? "translate(-2 4) rotate(-8 63 22)" : ""}
      />
      {/* Inner ears */}
      <path d="M34 28 L33 20 L39 25 Z" fill="var(--color-coin)" opacity="0.4"
        transform={state() === "curious" ? "rotate(-10 37 22)" : state() === "worried" ? "translate(2 4) rotate(8 37 22)" : ""}
      />
      <path d="M66 28 L67 20 L61 25 Z" fill="var(--color-coin)" opacity="0.4"
        transform={state() === "curious" ? "rotate(10 63 22)" : state() === "worried" ? "translate(-2 4) rotate(-8 63 22)" : ""}
      />

      {/* Head circle */}
      <circle
        cx="50"
        cy="38"
        r="20"
        fill="var(--color-accent)"
        transform={state() === "curious" ? "rotate(-8 50 38)" : ""}
      />

      {/* ── State-specific face ── */}
      <NelarFace state={state()} />

      {/* ── State-specific extras ── */}
      <Show when={state() === "sleeping"}>
        {/* Zzz */}
        <text x="72" y="18" font-size="10" fill="var(--color-ink-secondary)" font-family="serif" font-weight="bold"
          class="nelar-z-float">z</text>
        <text x="78" y="12" font-size="7" fill="var(--color-ink-secondary)" font-family="serif" font-weight="bold"
          class="nelar-z-float" style="animation-delay:0.5s">z</text>
      </Show>

      <Show when={state() === "curious"}>
        {/* Question mark */}
        <text x="74" y="16" font-size="14" fill="var(--color-ink-secondary)" font-family="serif" font-weight="bold"
          class="nelar-bounce" font-style="italic">?</text>
      </Show>

      <Show when={state() === "happy"}>
        {/* Sparkles */}
        <g class="nelar-bounce">
          <circle cx="22" cy="22" r="1.5" fill="var(--color-coin)" />
          <circle cx="80" cy="20" r="1.5" fill="var(--color-coin)" />
          <circle cx="75" cy="30" r="1" fill="var(--color-rarity-rare)" />
          <circle cx="18" cy="40" r="1" fill="var(--color-coin)" />
        </g>
      </Show>

      <Show when={state() === "wave"}>
        {/* Raised paw */}
        <circle cx="72" cy="52" r="5" fill="var(--color-accent)" class="nelar-wave-paw" />
        <circle cx="72" cy="52" r="2.5" fill="var(--color-surface-elevated)" opacity="0.4" class="nelar-wave-paw" />
      </Show>

      {/* Cheeks (blush) — all states except worried */}
      <Show when={state() !== "worried" && state() !== "sleeping"}>
        <circle cx="38" cy="44" r="3" fill="var(--color-coin)" opacity="0.35" />
        <circle cx="62" cy="44" r="3" fill="var(--color-coin)" opacity="0.35" />
      </Show>
    </svg>
  );
}

/** State-specific eyes + mouth for Nelar's face. */
function NelarFace(props: { state: NelarState }) {
  switch (props.state) {
    case "sleeping":
      return (
        <>
          {/* Closed eyes (curved lines) */}
          <path d="M40 36 Q43 33 46 36" stroke="var(--color-ink-primary)" stroke-width="2" stroke-linecap="round" fill="none" />
          <path d="M54 36 Q57 33 60 36" stroke="var(--color-ink-primary)" stroke-width="2" stroke-linecap="round" fill="none" />
          {/* Nose */}
          <path d="M48 41 L52 41 L50 43 Z" fill="var(--color-ink-primary)" />
          {/* Sleeping mouth */}
          <path d="M50 43 Q50 46 52 45" stroke="var(--color-ink-primary)" stroke-width="1.5" stroke-linecap="round" fill="none" />
        </>
      );

    case "happy":
      return (
        <>
          {/* Happy eyes (^ ^) */}
          <path d="M38 36 L42 33 L42 37" stroke="var(--color-ink-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          <path d="M58 36 L62 33 L62 37" stroke="var(--color-ink-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          {/* Nose */}
          <path d="M48 41 L52 41 L50 43 Z" fill="var(--color-ink-primary)" />
          {/* Big grin */}
          <path d="M43 44 Q50 52 57 44" stroke="var(--color-ink-primary)" stroke-width="2" stroke-linecap="round" fill="none" />
        </>
      );

    case "curious":
      return (
        <>
          {/* Big round eyes */}
          <circle cx="42" cy="36" r="4" fill="var(--color-ink-primary)" />
          <circle cx="58" cy="36" r="4" fill="var(--color-ink-primary)" />
          <circle cx="43" cy="35" r="1.5" fill="var(--color-surface-elevated)" />
          <circle cx="59" cy="35" r="1.5" fill="var(--color-surface-elevated)" />
          {/* Nose */}
          <path d="M48 42 L52 42 L50 44 Z" fill="var(--color-ink-primary)" />
          {/* Small "o" mouth */}
          <circle cx="50" cy="46" r="1.5" fill="var(--color-ink-primary)" />
        </>
      );

    case "worried":
      return (
        <>
          {/* Worried eyes (droopy) */}
          <circle cx="42" cy="37" r="3" fill="var(--color-ink-primary)" />
          <circle cx="58" cy="37" r="3" fill="var(--color-ink-primary)" />
          {/* Worried brows */}
          <path d="M37 32 L45 34" stroke="var(--color-ink-primary)" stroke-width="2" stroke-linecap="round" />
          <path d="M63 32 L55 34" stroke="var(--color-ink-primary)" stroke-width="2" stroke-linecap="round" />
          {/* Nose */}
          <path d="M48 42 L52 42 L50 44 Z" fill="var(--color-ink-primary)" />
          {/* Frown */}
          <path d="M45 48 Q50 44 55 48" stroke="var(--color-ink-primary)" stroke-width="1.5" stroke-linecap="round" fill="none" />
        </>
      );

    case "wave":
      return (
        <>
          {/* Friendly open eyes */}
          <circle cx="42" cy="36" r="3" fill="var(--color-ink-primary)" />
          <circle cx="58" cy="36" r="3" fill="var(--color-ink-primary)" />
          <circle cx="43" cy="35" r="1" fill="var(--color-surface-elevated)" />
          <circle cx="59" cy="35" r="1" fill="var(--color-surface-elevated)" />
          {/* Nose */}
          <path d="M48 41 L52 41 L50 43 Z" fill="var(--color-ink-primary)" />
          {/* Friendly smile */}
          <path d="M44 45 Q50 49 56 45" stroke="var(--color-ink-primary)" stroke-width="2" stroke-linecap="round" fill="none" />
        </>
      );

    default: // idle
      return (
        <>
          {/* Normal eyes (two dots) */}
          <circle cx="42" cy="36" r="2.5" fill="var(--color-ink-primary)" />
          <circle cx="58" cy="36" r="2.5" fill="var(--color-ink-primary)" />
          {/* Eye shine */}
          <circle cx="43" cy="35" r="0.8" fill="var(--color-surface-elevated)" />
          <circle cx="59" cy="35" r="0.8" fill="var(--color-surface-elevated)" />
          {/* Nose */}
          <path d="M48 41 L52 41 L50 43 Z" fill="var(--color-ink-primary)" />
          {/* Gentle smile */}
          <path d="M45 45 Q50 48 55 45" stroke="var(--color-ink-primary)" stroke-width="1.5" stroke-linecap="round" fill="none" />
        </>
      );
  }
}
