import { For, Show, createMemo } from "solid-js";
import type { Block } from "~/lib/blocks";
import { safeUrl } from "~/lib/markdown";

// ── Inline markdown renderer ──────────────────────────────────
function renderInline(text: string): string {
  let html = String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-surface-border px-1 py-0.5 rounded text-sm font-mono">$1</code>',
  );
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Sanitize link href — blocks javascript:/data: URLs (stored XSS on public notes)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, label: string, url: string) =>
      `<a href="${safeUrl(url)}" class="text-accent hover:underline" target="_blank" rel="noopener">${label}</a>`,
  );
  return html;
}

// Split a block's content into individual lines (legacy blocks may be multiline).
const itemLines = (content: string) => content.split("\n").map((l) => l.trim()).filter(Boolean);

type Group =
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "block"; block: Block };

// Group consecutive bullet/numbered list blocks so they render as a single list.
function groupBlocks(blocks: Block[]): Group[] {
  const groups: Group[] = [];
  for (const b of blocks) {
    if (b.type === "bullet_list" || b.type === "numbered_list") {
      const kind = b.type === "bullet_list" ? "ul" : "ol";
      const last = groups[groups.length - 1];
      if (last && last.kind === kind) last.items.push(...itemLines(b.content));
      else groups.push({ kind, items: itemLines(b.content) });
    } else {
      groups.push({ kind: "block", block: b });
    }
  }
  return groups;
}

export default function BlockRenderer(props: { blocks: Block[] }) {
  const groups = createMemo(() => groupBlocks(props.blocks));
  return (
    <div class="space-y-1">
      <For each={groups()}>
        {(g) => (
          <Show when={g.kind === "block"} fallback={
            <Show when={g.kind === "ul"} fallback={
              <ol class="list-decimal pl-6 space-y-1 my-2 text-ink-primary marker:text-ink-secondary">
                <For each={(g as { items: string[] }).items}>{(item) => <li innerHTML={renderInline(item)} />}</For>
              </ol>
            }>
              <ul class="list-disc pl-6 space-y-1 my-2 text-ink-primary marker:text-ink-secondary">
                <For each={(g as { items: string[] }).items}>{(item) => <li innerHTML={renderInline(item)} />}</For>
              </ul>
            </Show>
          }>
            <BlockView block={(g as { block: Block }).block} />
          </Show>
        )}
      </For>
    </div>
  );
}

function BlockView(props: { block: Block }) {
  const b = props.block;
  switch (b.type) {
    case "heading1":
      return <h1 class="text-2xl font-display font-bold text-ink-primary mt-6 mb-2" innerHTML={renderInline(b.content)} />;
    case "heading2":
      return <h2 class="text-xl font-display font-bold text-ink-primary mt-5 mb-1" innerHTML={renderInline(b.content)} />;
    case "heading3":
      return <h3 class="text-lg font-display font-semibold text-ink-primary mt-4 mb-1" innerHTML={renderInline(b.content)} />;
    case "quote":
      return (
        <blockquote class="border-l-2 border-accent/40 pl-4 my-2 text-ink-secondary italic">
          <Show when={b.content} fallback={<span>&nbsp;</span>}>
            <For each={b.content.split("\n")}>{(line) => <div innerHTML={renderInline(line)} />}</For>
          </Show>
        </blockquote>
      );
    case "divider":
      return <hr class="my-4 border-surface-border" />;
    case "code":
      return (
        <pre class="bg-surface-elevated border border-surface-border rounded-lg p-3 my-2 overflow-x-auto text-sm font-mono text-ink-primary">
          <Show when={b.language}>
            <div class="text-[10px] uppercase tracking-wide text-ink-secondary/60 mb-1.5">{b.language}</div>
          </Show>
          <code>{b.content}</code>
        </pre>
      );
    case "callout":
      return (
        <div class="flex items-start gap-3 bg-accent/10 border border-accent/20 rounded-lg p-3 my-2">
          <span class="text-lg shrink-0" aria-hidden="true">{b.calloutIcon || "💡"}</span>
          <div class="text-[0.95rem] text-ink-primary" innerHTML={renderInline(b.content)} />
        </div>
      );
    case "todo":
      return (
        <div class="flex items-start gap-2 my-1">
          <span class="mt-0.5 text-sm" aria-hidden="true">{b.checked ? "☑" : "☐"}</span>
          <span
            class={`text-[0.95rem] text-ink-primary ${b.checked ? "line-through text-ink-secondary/50" : ""}`}
            innerHTML={renderInline(b.content)}
          />
        </div>
      );
    default:
      return (
        <Show when={b.content.trim()}>
          <p class="my-1 text-ink-primary leading-relaxed" innerHTML={renderInline(b.content)} />
        </Show>
      );
  }
}
