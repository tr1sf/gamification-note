import { createSignal, For, Show, createEffect, onCleanup, on } from "solid-js";
import type { Block, BlockType } from "~/lib/blocks";
import { createBlock } from "~/lib/blocks";

const BLOCK_META: Record<BlockType, { label: string; icon: string; placeholder: string }> = {
  text:          { label: "Text",           icon: "Tt",  placeholder: "Type '/' for commands..." },
  heading1:      { label: "Heading 1",       icon: "H1",  placeholder: "Heading 1" },
  heading2:      { label: "Heading 2",       icon: "H2",  placeholder: "Heading 2" },
  heading3:      { label: "Heading 3",       icon: "H3",  placeholder: "Heading 3" },
  quote:         { label: "Quote",           icon: '"',   placeholder: "Quote..." },
  divider:       { label: "Divider",         icon: "—",   placeholder: "" },
  bullet_list:   { label: "Bullet List",     icon: "•",   placeholder: "• Item 1\n• Item 2" },
  numbered_list: { label: "Numbered List",   icon: "1.",  placeholder: "1. Item 1\n2. Item 2" },
  code:          { label: "Code",            icon: "</>", placeholder: "// code..." },
  callout:       { label: "Callout",         icon: "💡",  placeholder: "Callout text..." },
  todo:          { label: "Todo",            icon: "☐",   placeholder: "To-do item..." },
};

const BLOCK_TYPES: BlockType[] = [
  "text", "heading1", "heading2", "heading3", "quote", "divider",
  "bullet_list", "numbered_list", "code", "callout", "todo",
];

function isContentless(type: BlockType): boolean {
  return type === "divider";
}

const DragHandle = () => (
  <svg width="9" height="17" viewBox="0 0 9 17" aria-hidden="true">
    <circle cx="2" cy="3.5" r="0.9" fill="currentColor"/>
    <circle cx="7" cy="3.5" r="0.9" fill="currentColor"/>
    <circle cx="2" cy="8.5" r="0.9" fill="currentColor"/>
    <circle cx="7" cy="8.5" r="0.9" fill="currentColor"/>
    <circle cx="2" cy="13.5" r="0.9" fill="currentColor"/>
    <circle cx="7" cy="13.5" r="0.9" fill="currentColor"/>
  </svg>
);

function BlockRow(props: {
  block: Block;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  totalBlocks: number;
  onChange: (content: string) => void;
  onChangeType: (type: BlockType) => void;
  onToggleCheck?: () => void;
  onAddBelow: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateLanguage?: (lang: string) => void;
  onUpdateCalloutIcon?: (icon: string) => void;
}) {
  const [showMenu, setShowMenu] = createSignal(false);
  const [localContent, setLocalContent] = createSignal(props.block.content);
  let textareaRef!: HTMLTextAreaElement;
  let menuRef!: HTMLDivElement;

  const flushToParent = () => {
    const v = localContent();
    if (v !== props.block.content) props.onChange(v);
  };

  createEffect(on(() => props.block.content, (parentVal) => {
    if (parentVal !== localContent()) setLocalContent(parentVal);
  }));

  const meta = () => BLOCK_META[props.block.type] ?? BLOCK_META.text;
  const hideTextarea = () => isContentless(props.block.type);

  const resize = () => {
    const ta = textareaRef;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  };

  createEffect(() => {
    void localContent();
    queueMicrotask(resize);
  });

  const handleOutsideClick = (e: MouseEvent) => {
    if (menuRef && !menuRef.contains(e.target as Node)) setShowMenu(false);
  };
  createEffect(() => {
    if (showMenu()) document.addEventListener("click", handleOutsideClick);
    else document.removeEventListener("click", handleOutsideClick);
  });
  onCleanup(() => document.removeEventListener("click", handleOutsideClick));

  const handleKeyDown = (e: KeyboardEvent) => {
    const ta = textareaRef;
    if (!ta || hideTextarea()) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      flushToParent();
      props.onAddBelow();
      return;
    }

    if (e.key === "Backspace" && ta.value === "") {
      e.preventDefault();
      if (props.isFirst) return;
      props.onDelete();
      return;
    }

    if (e.key === "ArrowUp" && e.ctrlKey && !props.isFirst) {
      e.preventDefault();
      props.onMoveUp();
    }
    if (e.key === "ArrowDown" && e.ctrlKey && !props.isLast) {
      e.preventDefault();
      props.onMoveDown();
    }

    if (e.key === "/" && ta.value === "") {
      queueMicrotask(() => setShowMenu(true));
    }
  };

  const handleChange = (value: string) => {
    setLocalContent(value);
    if (value.startsWith("/") && props.block.type === "text") {
      const cmd = value.slice(1).toLowerCase();
      const commandMap: Record<string, BlockType> = {
        h1: "heading1", h2: "heading2", h3: "heading3",
        quote: "quote", blockquote: "quote",
        divider: "divider", hr: "divider", "---": "divider",
        ul: "bullet_list", list: "bullet_list", bullet: "bullet_list",
        ol: "numbered_list", numbered: "numbered_list",
        code: "code", pre: "code",
        callout: "callout",
        todo: "todo", task: "todo", check: "todo",
      };
      if (commandMap[cmd]) {
        flushToParent();
        props.onChangeType(commandMap[cmd]);
        return;
      }
    }
  };

  const textareaClass = () => {
    const t = props.block.type;
    if (t === "heading1") return "font-display font-bold text-2xl";
    if (t === "heading2") return "font-display font-bold text-xl";
    if (t === "heading3") return "font-display font-semibold text-lg";
    if (t === "quote") return "italic text-ink-secondary";
    if (t === "code") return "font-mono text-sm";
    return "text-sm leading-relaxed";
  };

  return (
    <div class="group flex items-start gap-2 py-1 relative">
      <div class="flex-shrink-0 pt-1.5 cursor-grab text-ink-secondary/20 group-hover:text-ink-secondary/40 transition-colors select-none" aria-hidden="true">
        <DragHandle />
      </div>

      <div class="flex-shrink-0 pt-0.5">
        <button
          type="button"
          onClick={() => setShowMenu(!showMenu())}
          class="w-7 h-6 flex items-center justify-center rounded border border-transparent hover:border-surface-border hover:bg-surface-elevated text-[10px] font-semibold text-ink-secondary/50 hover:text-ink-secondary transition-all duration-150"
          title={`${meta().label} — click to change`}
        >
          {meta().icon}
        </button>
      </div>

      <div class="flex-1 min-w-0">
        <Show when={hideTextarea()} fallback={
          <Show when={props.block.type === "todo"} fallback={
            <Show when={props.block.type === "code"} fallback={
              <Show when={props.block.type === "callout"} fallback={
                <textarea
                  ref={(el) => { textareaRef = el; queueMicrotask(resize); }}
                  value={localContent()}
                  onInput={(e) => handleChange(e.currentTarget.value)}
                  onBlur={flushToParent}
                  onKeyDown={handleKeyDown}
                  placeholder={meta().placeholder}
                  rows={1}
                  class={`w-full resize-none bg-transparent text-ink-primary placeholder:text-ink-secondary/30 focus:outline-none ${textareaClass()}`}
                />
              }>
                <div class="flex items-start gap-2 bg-accent/5 border border-accent/15 rounded-lg px-3 py-2">
                  <input
                    type="text"
                    value={props.block.calloutIcon ?? "💡"}
                    onInput={(e) => props.onUpdateCalloutIcon?.(e.currentTarget.value)}
                    class="w-7 text-center bg-transparent text-base border-0 outline-none shrink-0"
                    maxLength={4}
                    title="Callout icon"
                  />
                  <textarea
                    ref={(el) => { textareaRef = el; queueMicrotask(resize); }}
                    value={localContent()}
                    onInput={(e) => handleChange(e.currentTarget.value)}
                    onBlur={flushToParent}
                    onKeyDown={handleKeyDown}
                    placeholder="Callout text..."
                    rows={1}
                    class="flex-1 resize-none bg-transparent text-sm text-ink-primary placeholder:text-ink-secondary/30 focus:outline-none py-0.5"
                  />
                </div>
              </Show>
            }>
              <div class="space-y-1">
                <textarea
                  ref={(el) => { textareaRef = el; queueMicrotask(resize); }}
                  value={localContent()}
                  onInput={(e) => handleChange(e.currentTarget.value)}
                  onBlur={flushToParent}
                  onKeyDown={handleKeyDown}
                  placeholder={`// ${props.block.language || "code"}...`}
                  rows={3}
                  spellcheck={false}
                  class="w-full resize-y bg-surface-elevated border border-surface-border rounded-md px-3 py-2 font-mono text-sm text-ink-primary placeholder:text-ink-secondary/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 min-h-[50px]"
                />
                <input
                  type="text"
                  value={props.block.language ?? ""}
                  onInput={(e) => props.onUpdateLanguage?.(e.currentTarget.value)}
                  placeholder="language"
                  class="w-full text-xs bg-transparent border-0 outline-none text-ink-secondary/50 placeholder:text-ink-secondary/30 px-1"
                />
              </div>
            </Show>
          }>
            <div class="flex items-start gap-2">
              <button
                type="button"
                onClick={() => props.onToggleCheck?.()}
                class="mt-1 text-sm shrink-0 hover:scale-110 transition-transform"
              >
                {props.block.checked ? "☑" : "☐"}
              </button>
              <textarea
                ref={(el) => { textareaRef = el; queueMicrotask(resize); }}
                value={localContent()}
                onInput={(e) => handleChange(e.currentTarget.value)}
                onBlur={flushToParent}
                onKeyDown={handleKeyDown}
                placeholder={meta().placeholder}
                rows={1}
                class={`w-full resize-none bg-transparent text-sm leading-relaxed focus:outline-none placeholder:text-ink-secondary/30 ${props.block.checked ? "line-through text-ink-secondary/50" : "text-ink-primary"}`}
              />
            </div>
          </Show>
        }>
          <hr class="my-2 border-surface-border" />
        </Show>
      </div>

      <div class="flex-shrink-0 flex items-center gap-0.5 pt-0.5 transition-all duration-150 opacity-0 group-hover:opacity-100">
        <Show when={!props.isFirst}>
          <button type="button" onClick={() => props.onMoveUp()} title="Move up" class="p-1 rounded hover:bg-surface-border text-ink-secondary/40 hover:text-ink-primary transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>
          </button>
        </Show>
        <Show when={!props.isLast}>
          <button type="button" onClick={() => props.onMoveDown()} title="Move down" class="p-1 rounded hover:bg-surface-border text-ink-secondary/40 hover:text-ink-primary transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </Show>
        <button type="button" onClick={() => props.onDelete()} title="Delete" class="p-1 rounded hover:bg-error-bg text-ink-secondary/40 hover:text-error transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>

      <Show when={showMenu()}>
        <div
          ref={(el) => { menuRef = el; }}
          class="absolute left-14 top-full mt-1 z-50 bg-surface-elevated border border-surface-border rounded-lg shadow-lg p-1 min-w-[180px] max-h-[300px] overflow-y-auto"
        >
          <For each={BLOCK_TYPES}>
            {(type) => (
              <button
                type="button"
                onClick={() => { props.onChangeType(type); setShowMenu(false); }}
                class={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors text-left ${
                  props.block.type === type
                    ? "bg-accent/10 text-accent"
                    : "text-ink-primary hover:bg-surface-hover"
                }`}
              >
                <span class="w-6 text-center text-[10px] font-semibold opacity-50">{BLOCK_META[type].icon}</span>
                <span>{BLOCK_META[type].label}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export default function BlockEditor(props: {
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
}) {
  let containerRef!: HTMLDivElement;

  const blocks = () => props.blocks;
  const setBlocks = (v: Block[]) => props.onBlocksChange(v);

  const updateBlock = (index: number, content: string) => {
    setBlocks(blocks().map((b, i) => (i === index ? { ...b, content } : b)));
  };

  const changeBlockType = (index: number, type: BlockType) => {
    setBlocks(
      blocks().map((b, i) =>
        i === index
          ? { ...b, type, content: isContentless(type) ? "" : b.content, checked: type === "todo" ? (b.checked ?? false) : undefined }
          : b,
      ),
    );
    queueMicrotask(() => {
      const textareas = containerRef.querySelectorAll("textarea");
      const ta = textareas[index] || textareas[0];
      ta?.focus();
    });
  };

  const toggleTodoCheck = (index: number) => {
    setBlocks(
      blocks().map((b, i) =>
        i === index && b.type === "todo" ? { ...b, checked: !b.checked } : b,
      ),
    );
  };

  const addBlockAfter = (index: number) => {
    const current = blocks()[index];
    const nextType: BlockType = current?.type === "divider" ? "text" : (current?.type ?? "text");
    const newBlock = createBlock(nextType);
    const next = [...blocks()];
    next.splice(index + 1, 0, newBlock);
    setBlocks(next);
    queueMicrotask(() => {
      const textareas = containerRef.querySelectorAll("textarea");
      textareas[index + 1]?.focus();
    });
  };

  const deleteBlock = (index: number) => {
    if (blocks().length <= 1) {
      setBlocks([createBlock("text")]);
      return;
    }
    const prev = blocks()[index - 1];
    const current = blocks()[index];
    if (index > 0 && prev && current && prev.type === current.type && !isContentless(prev.type)) {
      const merged = [...blocks()];
      merged[index - 1] = { ...prev, content: prev.content + current.content };
      merged.splice(index, 1);
      setBlocks(merged);
      queueMicrotask(() => {
        const textareas = containerRef.querySelectorAll("textarea");
        const ta = textareas[index - 1];
        if (ta) { ta.focus(); ta.selectionStart = prev.content.length; }
      });
      return;
    }
    setBlocks(blocks().filter((_, i) => i !== index));
    queueMicrotask(() => {
      const textareas = containerRef.querySelectorAll("textarea");
      textareas[Math.max(0, index - 1)]?.focus();
    });
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= blocks().length) return;
    const next = [...blocks()];
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
  };

  const updateLanguage = (index: number, lang: string) => {
    setBlocks(
      blocks().map((b, i) =>
        i === index ? { ...b, language: lang || undefined } : b,
      ),
    );
  };

  const updateCalloutIcon = (index: number, icon: string) => {
    setBlocks(
      blocks().map((b, i) =>
        i === index ? { ...b, calloutIcon: icon || "💡" } : b,
      ),
    );
  };

  return (
    <div ref={(el) => { containerRef = el; }} class="block-editor min-h-[300px]">
      <Show
        when={blocks().length > 0}
        fallback={
          <p class="text-ink-secondary/30 text-sm italic p-3">No blocks. Click to add content.</p>
        }
      >
        <For each={blocks()}>
          {(block, idx) => {
            const i = idx();
            return (
            <BlockRow
              block={block}
              index={i}
              isFirst={i === 0}
              isLast={i === blocks().length - 1}
              totalBlocks={blocks().length}
              onChange={(c) => updateBlock(i, c)}
              onChangeType={(t) => changeBlockType(i, t)}
              onToggleCheck={() => toggleTodoCheck(i)}
              onAddBelow={() => addBlockAfter(i)}
              onDelete={() => deleteBlock(i)}
              onMoveUp={() => moveBlock(i, -1)}
              onMoveDown={() => moveBlock(i, 1)}
              onUpdateLanguage={(l) => updateLanguage(i, l)}
              onUpdateCalloutIcon={(ic) => updateCalloutIcon(i, ic)}
            />
          )}}
        </For>
      </Show>
    </div>
  );
}
