import { For, Show } from "solid-js";
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

export default function BlockRenderer(props: { blocks: Block[] }) {
  return (
    <div class="space-y-1">
      <For each={props.blocks}>
        {(block) => <BlockView block={block} />}
      </For>
    </div>
  );
}

function BlockView(props: { block: Block }) {
  const b = props.block;

  return (
    <Show when={b.type === "heading1"} fallback={
      <Show when={b.type === "heading2"} fallback={
        <Show when={b.type === "heading3"} fallback={
          <Show when={b.type === "quote"} fallback={
            <Show when={b.type === "divider"} fallback={
              <Show when={b.type === "bullet_list"} fallback={
                <Show when={b.type === "numbered_list"} fallback={
                  <Show when={b.type === "code"} fallback={
                    <Show when={b.type === "callout"} fallback={
                      <Show when={b.type === "todo"} fallback={
                        <Show when={b.content.trim()}>
                          <p class="my-1 text-ink-primary leading-relaxed" innerHTML={renderInline(b.content)} />
                        </Show>
                      }>
                        <div class="flex items-start gap-2 my-1">
                          <span class="mt-0.5 text-sm">{b.checked ? "☑" : "☐"}</span>
                          <span
                            class={`text-sm text-ink-primary ${b.checked ? "line-through text-ink-secondary/50" : ""}`}
                            innerHTML={renderInline(b.content)}
                          />
                        </div>
                      </Show>
                    }>
                      <div class="flex items-start gap-3 bg-accent/10 border border-accent/20 rounded-lg p-3 my-2">
                        <span class="text-lg shrink-0">{b.calloutIcon || "💡"}</span>
                        <div class="text-sm text-ink-primary" innerHTML={renderInline(b.content)} />
                      </div>
                    </Show>
                  }>
                    <pre class="bg-surface-hover rounded-lg p-3 my-2 overflow-x-auto text-sm font-mono">
                      <code>{b.content}</code>
                    </pre>
                  </Show>
                }>
                  <ol class="list-decimal pl-5 space-y-1 my-2 text-ink-primary">
                    <For each={b.content.split("\n").filter(l => l.trim())}>
                      {(item) => <li innerHTML={renderInline(item.trim())} />}
                    </For>
                  </ol>
                </Show>
              }>
                <ul class="list-disc pl-5 space-y-1 my-2 text-ink-primary">
                  <For each={b.content.split("\n").filter(l => l.trim())}>
                    {(item) => <li innerHTML={renderInline(item.trim())} />}
                  </For>
                </ul>
              </Show>
            }>
              <hr class="my-4 border-surface-border" />
            </Show>
          }>
            <blockquote class="border-l-3 border-accent pl-4 my-2 text-ink-secondary italic">
              <Show when={b.content} fallback={<span>&nbsp;</span>}>
                <For each={b.content.split("\n")}>
                  {(line) => <div innerHTML={renderInline(line)} />}
                </For>
              </Show>
            </blockquote>
          </Show>
        }>
          <h3 class="text-lg font-display font-semibold text-ink-primary mt-4 mb-1" innerHTML={renderInline(b.content)} />
        </Show>
      }>
        <h2 class="text-xl font-display font-bold text-ink-primary mt-5 mb-1" innerHTML={renderInline(b.content)} />
      </Show>
    }>
      <h1 class="text-2xl font-display font-bold text-ink-primary mt-6 mb-2" innerHTML={renderInline(b.content)} />
    </Show>
  );
}
