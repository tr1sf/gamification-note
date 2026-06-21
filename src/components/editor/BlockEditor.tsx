import { createSignal, createMemo, For, Show, createEffect, onCleanup, on } from "solid-js";
import type { Block, BlockType } from "~/lib/blocks";
import { createBlock } from "~/lib/blocks";

interface BlockMeta { label: string; icon: string; placeholder: string; keywords: string[] }

const BLOCK_META: Record<BlockType, BlockMeta> = {
  text:          { label: "Text",         icon: "Tt",  placeholder: "Type '/' for commands…",  keywords: ["text", "paragraph", "p"] },
  heading1:      { label: "Heading 1",     icon: "H1",  placeholder: "Heading 1",               keywords: ["h1", "heading", "title", "#"] },
  heading2:      { label: "Heading 2",     icon: "H2",  placeholder: "Heading 2",               keywords: ["h2", "heading", "subtitle", "##"] },
  heading3:      { label: "Heading 3",     icon: "H3",  placeholder: "Heading 3",               keywords: ["h3", "heading", "###"] },
  quote:         { label: "Quote",         icon: '"',   placeholder: "Empty quote",             keywords: ["quote", "blockquote", "cite"] },
  divider:       { label: "Divider",       icon: "—",   placeholder: "",                        keywords: ["divider", "hr", "line", "separator", "---"] },
  bullet_list:   { label: "Bulleted list", icon: "•",   placeholder: "List item",               keywords: ["bullet", "list", "ul", "unordered"] },
  numbered_list: { label: "Numbered list", icon: "1.",  placeholder: "List item",               keywords: ["number", "ordered", "ol", "list"] },
  code:          { label: "Code",          icon: "</>", placeholder: "Enter code…",             keywords: ["code", "snippet", "pre", "```"] },
  callout:       { label: "Callout",       icon: "💡",  placeholder: "Callout text…",           keywords: ["callout", "note", "info", "tip"] },
  todo:          { label: "To-do",         icon: "☐",   placeholder: "To-do",                   keywords: ["todo", "task", "checkbox", "check"] },
};

const SLASH_TYPES: BlockType[] = [
  "text", "heading1", "heading2", "heading3", "todo", "bullet_list",
  "numbered_list", "quote", "code", "callout", "divider",
];

const isContentless = (type: BlockType): boolean => type === "divider";
const isListLike = (type: BlockType): boolean =>
  type === "bullet_list" || type === "numbered_list" || type === "todo";

// ── Markdown auto-shortcuts (typed at the start of a text block) ──────────────
interface ShortcutResult { type: BlockType; content: string; checked?: boolean }
function matchShortcut(value: string): ShortcutResult | null {
  if (value === "```") return { type: "code", content: "" };
  if (value === "---" || value === "***" || value === "___") return { type: "divider", content: "" };
  let m: RegExpMatchArray | null;
  if ((m = value.match(/^# (.*)$/)))        return { type: "heading1", content: m[1] };
  if ((m = value.match(/^## (.*)$/)))       return { type: "heading2", content: m[1] };
  if ((m = value.match(/^### (.*)$/)))      return { type: "heading3", content: m[1] };
  if ((m = value.match(/^> (.*)$/)))        return { type: "quote", content: m[1] };
  if ((m = value.match(/^[-*+] (.*)$/)))    return { type: "bullet_list", content: m[1] };
  if ((m = value.match(/^1\. (.*)$/)))      return { type: "numbered_list", content: m[1] };
  if ((m = value.match(/^\[([ xX]?)\] (.*)$/))) return { type: "todo", content: m[2], checked: m[1].toLowerCase() === "x" };
  return null;
}

const DragHandle = () => (
  <svg width="11" height="17" viewBox="0 0 11 17" aria-hidden="true">
    {[3.5, 8.5, 13.5].map((cy) => (
      <>
        <circle cx="3" cy={cy} r="1" fill="currentColor" />
        <circle cx="8" cy={cy} r="1" fill="currentColor" />
      </>
    ))}
  </svg>
);

type Caret = "start" | "end" | number;

function BlockRow(props: {
  block: Block;
  index: number;
  ordinal: number;
  isFirst: boolean;
  isLast: boolean;
  isDragTarget: boolean;
  registerRef: (id: string, el: HTMLTextAreaElement) => void;
  unregisterRef: (id: string, el: HTMLTextAreaElement) => void;
  onContent: (content: string) => void;
  onChangeType: (type: BlockType) => void;
  onTransform: (r: ShortcutResult) => void;
  onToggleCheck: () => void;
  onEnter: () => void;
  onBackspaceAtStart: () => void;
  onArrow: (dir: -1 | 1) => void;
  onDelete: () => void;
  onAddBelow: () => void;
  onUpdateLanguage: (lang: string) => void;
  onUpdateCalloutIcon: (icon: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [local, setLocal] = createSignal(props.block.content);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [menuSel, setMenuSel] = createSignal(0);
  let textareaRef: HTMLTextAreaElement | undefined;
  let menuRef: HTMLDivElement | undefined;

  // Keep local content in sync when the parent value changes externally.
  createEffect(on(() => props.block.content, (v) => { if (v !== local()) setLocal(v); }));

  const meta = () => BLOCK_META[props.block.type] ?? BLOCK_META.text;

  const resize = () => {
    const ta = textareaRef;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  };
  createEffect(() => { void local(); queueMicrotask(resize); });

  const flush = () => {
    if (local() !== props.block.content) props.onContent(local());
  };

  // Slash-menu candidates filtered by the text typed after "/".
  const slashQuery = () => (local().startsWith("/") ? local().slice(1).toLowerCase() : "");
  const filtered = createMemo<BlockType[]>(() => {
    if (!menuOpen()) return [];
    const q = slashQuery();
    if (!q) return SLASH_TYPES;
    return SLASH_TYPES.filter((t) => {
      const meta = BLOCK_META[t];
      return meta.label.toLowerCase().includes(q) || meta.keywords.some((k) => k.includes(q));
    });
  });

  createEffect(() => { if (menuOpen()) setMenuSel((s) => Math.min(s, Math.max(0, filtered().length - 1))); });

  const closeMenu = () => { setMenuOpen(false); setMenuSel(0); };

  const onOutside = (e: MouseEvent) => { if (menuRef && !menuRef.contains(e.target as Node)) closeMenu(); };
  createEffect(() => {
    if (menuOpen()) document.addEventListener("mousedown", onOutside);
    else document.removeEventListener("mousedown", onOutside);
  });
  onCleanup(() => document.removeEventListener("mousedown", onOutside));

  const pickType = (type: BlockType) => {
    closeMenu();
    setLocal("");
    props.onChangeType(type);
  };

  const handleInput = (value: string) => {
    setLocal(value);

    // Slash command palette — only meaningful from a text block.
    if (props.block.type === "text" && value.startsWith("/")) {
      if (!menuOpen()) { setMenuOpen(true); setMenuSel(0); }
      return; // don't run markdown shortcuts while in command mode
    }
    if (menuOpen()) closeMenu();

    // Markdown auto-shortcuts at the start of a text block.
    if (props.block.type === "text") {
      const r = matchShortcut(value);
      if (r) props.onTransform(r);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const ta = textareaRef;

    if (menuOpen()) {
      const list = filtered();
      if (e.key === "ArrowDown") { e.preventDefault(); setMenuSel((s) => Math.min(s + 1, list.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMenuSel((s) => Math.max(s - 1, 0)); return; }
      if (e.key === "Enter")     { e.preventDefault(); if (list[menuSel()]) pickType(list[menuSel()]); return; }
      if (e.key === "Escape")    { e.preventDefault(); closeMenu(); return; }
      if (e.key === "Backspace" && local() === "/") { closeMenu(); /* fall through to delete */ }
    }

    if (!ta) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      flush();
      props.onEnter();
      return;
    }

    if (e.key === "Backspace" && ta.selectionStart === 0 && ta.selectionEnd === 0) {
      e.preventDefault();
      flush();
      props.onBackspaceAtStart();
      return;
    }

    if (e.key === "ArrowUp" && ta.selectionStart === 0 && ta.selectionEnd === 0) {
      e.preventDefault();
      flush();
      props.onArrow(-1);
      return;
    }
    if (e.key === "ArrowDown" && ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length) {
      e.preventDefault();
      flush();
      props.onArrow(1);
      return;
    }
  };

  const textClass = () => {
    const t = props.block.type;
    if (t === "heading1") return "font-display font-bold text-2xl text-ink-primary";
    if (t === "heading2") return "font-display font-bold text-xl text-ink-primary";
    if (t === "heading3") return "font-display font-semibold text-lg text-ink-primary";
    if (t === "quote") return "italic text-ink-secondary text-[0.95rem]";
    if (t === "code") return "font-mono text-sm text-ink-primary";
    return "text-ink-primary text-[0.95rem] leading-relaxed";
  };

  const registerTextarea = (el: HTMLTextAreaElement) => {
    textareaRef = el;
    props.registerRef(props.block.id, el);
    queueMicrotask(resize);
  };
  onCleanup(() => { if (textareaRef) props.unregisterRef(props.block.id, textareaRef); });

  // NOTE: `value` is bound directly on each <textarea> (not via this spread) so
  // it stays reactive — object-spread properties are evaluated only once in Solid.
  const sharedTextareaProps = () => ({
    onInput: (e: InputEvent & { currentTarget: HTMLTextAreaElement }) => handleInput(e.currentTarget.value),
    onBlur: flush,
    onKeyDown: handleKeyDown,
    rows: 1,
  });

  return (
    <div
      class="group relative flex items-start gap-1"
      classList={{ "border-t-2 border-accent": props.isDragTarget }}
      onDragOver={(e) => { e.preventDefault(); props.onDragOver(); }}
      onDrop={(e) => { e.preventDefault(); props.onDrop(); }}
    >
      {/* Gutter: add + drag handle (visible on hover) */}
      <div class="flex items-center gap-0.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 select-none">
        <button
          type="button"
          onClick={props.onAddBelow}
          class="w-5 h-5 flex items-center justify-center rounded text-ink-secondary/50 hover:text-ink-primary hover:bg-surface-hover transition-colors text-base leading-none"
          title="Add block below"
          aria-label="Add block below"
        >+</button>
        <div
          draggable={true}
          onDragStart={props.onDragStart}
          onDragEnd={props.onDragEnd}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") { e.preventDefault(); props.onMoveUp(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); props.onMoveDown(); }
            else if (e.key === "Enter" || e.key === " ") {
              // Enter/Space on the handle announces "drag mode" — pointer only.
              e.preventDefault();
            }
          }}
          role="button"
          tabIndex={0}
          class="w-4 h-5 flex items-center justify-center rounded cursor-grab active:cursor-grabbing text-ink-secondary/40 hover:text-ink-primary hover:bg-surface-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1"
          title="Drag to reorder, or use Arrow Up/Down to move"
          aria-label={`Drag handle for ${props.block.type} block. Use arrow keys to move up or down.`}
        >
          <DragHandle />
        </div>
      </div>

      <div class="flex-1 min-w-0 py-0.5">
        <Show when={!isContentless(props.block.type)} fallback={<hr class="my-2 border-surface-border" />}>
          {/* Code */}
          <Show when={props.block.type === "code"}>
            <div class="rounded-md border border-surface-border bg-surface-elevated overflow-hidden">
              <input
                type="text"
                value={props.block.language ?? ""}
                onInput={(e) => props.onUpdateLanguage(e.currentTarget.value)}
                placeholder="language"
                aria-label="Code block language"
                class="w-full text-xs bg-transparent border-0 border-b border-surface-border outline-none text-ink-secondary/70 placeholder:text-ink-secondary/30 px-3 py-1"
              />
              <textarea
                value={local()}
                {...sharedTextareaProps()}
                ref={registerTextarea}
                spellcheck={false}
                placeholder={meta().placeholder}
                class="w-full resize-none bg-transparent font-mono text-sm text-ink-primary placeholder:text-ink-secondary/30 focus:outline-none px-3 py-2"
              />
            </div>
          </Show>

          {/* Callout */}
          <Show when={props.block.type === "callout"}>
            <div class="flex items-start gap-2 bg-accent/5 border border-accent/15 rounded-lg px-3 py-2">
              <input
                type="text"
                value={props.block.calloutIcon ?? "💡"}
                onInput={(e) => props.onUpdateCalloutIcon(e.currentTarget.value)}
                class="w-7 text-center bg-transparent text-base border-0 outline-none shrink-0"
                maxLength={4}
                title="Callout icon"
                aria-label="Callout icon"
              />
              <textarea
                value={local()}
                {...sharedTextareaProps()}
                ref={registerTextarea}
                placeholder={meta().placeholder}
                class="flex-1 resize-none bg-transparent text-[0.95rem] text-ink-primary placeholder:text-ink-secondary/30 focus:outline-none py-0.5"
              />
            </div>
          </Show>

          {/* To-do */}
          <Show when={props.block.type === "todo"}>
            <div class="flex items-start gap-2">
              <button
                type="button"
                onClick={props.onToggleCheck}
                class="mt-0.5 text-base shrink-0 hover:scale-110 transition-transform leading-none"
                aria-label={props.block.checked ? "Mark as not done" : "Mark as done"}
                aria-pressed={props.block.checked ?? false}
              >{props.block.checked ? "☑" : "☐"}</button>
              <textarea
                value={local()}
                {...sharedTextareaProps()}
                ref={registerTextarea}
                placeholder={meta().placeholder}
                class={`w-full resize-none bg-transparent text-[0.95rem] leading-relaxed focus:outline-none placeholder:text-ink-secondary/30 ${props.block.checked ? "line-through text-ink-secondary/50" : "text-ink-primary"}`}
              />
            </div>
          </Show>

          {/* Quote */}
          <Show when={props.block.type === "quote"}>
            <div class="border-l-2 border-accent/40 pl-3">
              <textarea
                value={local()}
                {...sharedTextareaProps()}
                ref={registerTextarea}
                placeholder={meta().placeholder}
                class={`w-full resize-none bg-transparent focus:outline-none placeholder:text-ink-secondary/30 ${textClass()}`}
              />
            </div>
          </Show>

          {/* List items */}
          <Show when={isListLike(props.block.type) && props.block.type !== "todo"}>
            <div class="flex items-start gap-2">
              <span class="mt-0.5 shrink-0 text-ink-secondary select-none text-[0.95rem] leading-relaxed tabular-nums" aria-hidden="true">
                {props.block.type === "numbered_list" ? `${props.ordinal}.` : "•"}
              </span>
              <textarea
                value={local()}
                {...sharedTextareaProps()}
                ref={registerTextarea}
                placeholder={meta().placeholder}
                class="w-full resize-none bg-transparent text-[0.95rem] leading-relaxed text-ink-primary placeholder:text-ink-secondary/30 focus:outline-none"
              />
            </div>
          </Show>

          {/* Plain text + headings */}
          <Show when={["text", "heading1", "heading2", "heading3"].includes(props.block.type)}>
            <textarea
              value={local()}
              {...sharedTextareaProps()}
              ref={registerTextarea}
              placeholder={meta().placeholder}
              class={`w-full resize-none bg-transparent focus:outline-none placeholder:text-ink-secondary/30 ${textClass()}`}
            />
          </Show>
        </Show>

        {/* Slash command palette */}
        <Show when={menuOpen()}>
          <div
            ref={(el) => (menuRef = el)}
            class="absolute left-8 z-50 mt-1 w-60 max-h-72 overflow-y-auto rounded-lg border border-surface-border bg-surface-elevated shadow-lg p-1"
            role="listbox"
            aria-label="Block types"
          >
            <Show when={filtered().length > 0} fallback={<p class="px-3 py-2 text-xs text-ink-secondary/60">No matching blocks</p>}>
              <For each={filtered()}>
                {(type, i) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={i() === menuSel()}
                    onMouseEnter={() => setMenuSel(i())}
                    onClick={() => pickType(type)}
                    class={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-sm transition-colors ${
                      i() === menuSel() ? "bg-accent/12 text-accent" : "text-ink-primary hover:bg-surface-hover"
                    }`}
                  >
                    <span class="w-6 h-6 flex items-center justify-center rounded border border-surface-border text-[10px] font-semibold shrink-0">{BLOCK_META[type].icon}</span>
                    <span>{BLOCK_META[type].label}</span>
                  </button>
                )}
              </For>
            </Show>
          </div>
        </Show>
      </div>

      {/* Quick delete */}
      <button
        type="button"
        onClick={props.onDelete}
        class="shrink-0 mt-1 p-1 rounded opacity-0 group-hover:opacity-100 text-ink-secondary/40 hover:text-error hover:bg-error-bg transition-all duration-150"
        title="Delete block"
        aria-label="Delete block"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
      </button>
    </div>
  );
}

export default function BlockEditor(props: {
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
}) {
  const refs = new Map<string, HTMLTextAreaElement>();
  const [dragId, setDragId] = createSignal<string | null>(null);
  const [dragOverId, setDragOverId] = createSignal<string | null>(null);

  const blocks = () => props.blocks;
  const setBlocks = (v: Block[]) => props.onBlocksChange(v.length ? v : [createBlock("text")]);
  const indexOf = (id: string) => blocks().findIndex((b) => b.id === id);

  // Ordinal for each numbered_list block, restarting at 1 after any non-numbered block.
  const numbering = createMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const b of blocks()) {
      if (b.type === "numbered_list") { n += 1; m.set(b.id, n); }
      else n = 0;
    }
    return m;
  });

  // Identity-guarded so a same-id row remount (e.g. on type change) can't have
  // its fresh textarea ref clobbered by the outgoing row's cleanup.
  const registerRef = (id: string, el: HTMLTextAreaElement) => { refs.set(id, el); };
  const unregisterRef = (id: string, el: HTMLTextAreaElement) => { if (refs.get(id) === el) refs.delete(id); };

  const focusBlock = (id: string, caret: Caret = "end") => {
    queueMicrotask(() => {
      const el = refs.get(id);
      if (!el) return;
      el.focus();
      const len = el.value.length;
      const pos = caret === "start" ? 0 : caret === "end" ? len : Math.max(0, Math.min(caret, len));
      try { el.setSelectionRange(pos, pos); } catch { /* noop */ }
    });
  };

  const patch = (id: string, fn: (b: Block) => Block) =>
    setBlocks(blocks().map((b) => (b.id === id ? fn(b) : b)));

  const updateContent = (id: string, content: string) => patch(id, (b) => ({ ...b, content }));

  const changeType = (id: string, type: BlockType) => {
    patch(id, (b) => ({
      ...b,
      type,
      content: isContentless(type) ? "" : b.content,
      checked: type === "todo" ? (b.checked ?? false) : undefined,
      language: type === "code" ? b.language : undefined,
      calloutIcon: type === "callout" ? (b.calloutIcon ?? "💡") : undefined,
    }));
    if (isContentless(type)) {
      // dividers can't hold focus — make sure there's an editable block after it
      const i = indexOf(id);
      const after = blocks()[i + 1];
      if (!after) addAfter(id);
      else focusBlock(after.id, "start");
    } else {
      focusBlock(id, "end");
    }
  };

  const transform = (id: string, r: ShortcutResult) => {
    patch(id, (b) => ({
      ...b,
      type: r.type,
      content: isContentless(r.type) ? "" : r.content,
      checked: r.type === "todo" ? (r.checked ?? false) : undefined,
      calloutIcon: r.type === "callout" ? (b.calloutIcon ?? "💡") : undefined,
    }));
    if (isContentless(r.type)) {
      const i = indexOf(id);
      if (!blocks()[i + 1]) addAfter(id);
      else focusBlock(blocks()[i + 1].id, "start");
    } else {
      focusBlock(id, "start");
    }
  };

  const addAfter = (id: string) => {
    const i = indexOf(id);
    const current = blocks()[i];
    // Continue list/todo sequences; everything else starts a plain text block.
    const nextType: BlockType = current && isListLike(current.type) ? current.type : "text";
    const nb = createBlock(nextType);
    const next = [...blocks()];
    next.splice(i + 1, 0, nb);
    setBlocks(next);
    focusBlock(nb.id, "start");
  };

  const onEnter = (id: string) => {
    const i = indexOf(id);
    const b = blocks()[i];
    if (!b) return;
    // Pressing Enter on an empty list/todo item exits the list (→ text block).
    if (isListLike(b.type) && b.content.trim() === "") {
      patch(id, (x) => ({ ...x, type: "text", checked: undefined }));
      focusBlock(id, "start");
      return;
    }
    addAfter(id);
  };

  const onBackspaceAtStart = (id: string) => {
    const i = indexOf(id);
    const b = blocks()[i];
    if (!b) return;
    // A styled but empty block first degrades to plain text (Notion behaviour).
    if (b.type !== "text" && b.content === "") {
      patch(id, (x) => ({ ...x, type: "text", checked: undefined, language: undefined, calloutIcon: undefined }));
      focusBlock(id, "start");
      return;
    }
    if (i === 0) return;
    const prev = blocks()[i - 1];
    if (prev.type === "divider") {
      // remove the divider above instead of merging into it
      setBlocks(blocks().filter((_, idx) => idx !== i - 1));
      focusBlock(id, "start");
      return;
    }
    const caret = prev.content.length;
    const merged = [...blocks()];
    merged[i - 1] = { ...prev, content: prev.content + b.content };
    merged.splice(i, 1);
    setBlocks(merged);
    focusBlock(prev.id, caret);
  };

  const onArrow = (id: string, dir: -1 | 1) => {
    const i = indexOf(id);
    const target = blocks()[i + dir];
    if (target) focusBlock(target.id, dir === -1 ? "end" : "start");
  };

  const deleteBlock = (id: string) => {
    const i = indexOf(id);
    if (blocks().length <= 1) {
      setBlocks([createBlock("text")]);
      const only = blocks()[0];
      if (only) focusBlock(only.id, "start");
      return;
    }
    const focusTarget = blocks()[i - 1] ?? blocks()[i + 1];
    setBlocks(blocks().filter((b) => b.id !== id));
    if (focusTarget) focusBlock(focusTarget.id, "end");
  };

  const toggleCheck = (id: string) => patch(id, (b) => (b.type === "todo" ? { ...b, checked: !b.checked } : b));
  const setLanguage = (id: string, language: string) => patch(id, (b) => ({ ...b, language: language || undefined }));
  const setCalloutIcon = (id: string, icon: string) => patch(id, (b) => ({ ...b, calloutIcon: icon || "💡" }));

  // ── Drag to reorder ──
  const handleDrop = (targetId: string) => {
    const from = dragId();
    setDragOverId(null);
    setDragId(null);
    if (!from || from === targetId) return;
    const arr = [...blocks()];
    const fromIdx = arr.findIndex((b) => b.id === from);
    const toIdx = arr.findIndex((b) => b.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = arr.splice(fromIdx, 1);
    const insertAt = arr.findIndex((b) => b.id === targetId);
    arr.splice(insertAt, 0, moved);
    setBlocks(arr);
  };

  // Keyboard reorder: ArrowUp/ArrowDown on the drag handle moves the block
  // one position in that direction without needing a pointer drag.
  const moveBlock = (id: string, dir: -1 | 1) => {
    const arr = [...blocks()];
    const idx = arr.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    const [moved] = arr.splice(idx, 1);
    arr.splice(target, 0, moved);
    setBlocks(arr);
  };

  return (
    <div class="block-editor min-h-[200px]">
      <For each={blocks()}>
        {(block, idx) => (
          <BlockRow
            block={block}
            index={idx()}
            ordinal={numbering().get(block.id) ?? 1}
            isFirst={idx() === 0}
            isLast={idx() === blocks().length - 1}
            isDragTarget={dragOverId() === block.id && dragId() !== block.id}
            registerRef={registerRef}
            unregisterRef={unregisterRef}
            onContent={(c) => updateContent(block.id, c)}
            onChangeType={(t) => changeType(block.id, t)}
            onTransform={(r) => transform(block.id, r)}
            onToggleCheck={() => toggleCheck(block.id)}
            onEnter={() => onEnter(block.id)}
            onBackspaceAtStart={() => onBackspaceAtStart(block.id)}
            onArrow={(d) => onArrow(block.id, d)}
            onDelete={() => deleteBlock(block.id)}
            onAddBelow={() => addAfter(block.id)}
            onUpdateLanguage={(l) => setLanguage(block.id, l)}
            onUpdateCalloutIcon={(ic) => setCalloutIcon(block.id, ic)}
            onDragStart={() => setDragId(block.id)}
            onDragEnd={() => { setDragId(null); setDragOverId(null); }}
            onDragOver={() => setDragOverId(block.id)}
            onDrop={() => handleDrop(block.id)}
            onMoveUp={() => moveBlock(block.id, -1)}
            onMoveDown={() => moveBlock(block.id, 1)}
          />
        )}
      </For>
    </div>
  );
}
