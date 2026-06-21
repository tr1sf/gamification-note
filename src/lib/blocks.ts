export type BlockType = 'text' | 'heading1' | 'heading2' | 'heading3' | 'quote' | 'divider' | 'bullet_list' | 'numbered_list' | 'code' | 'callout' | 'todo';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  language?: string;
  calloutIcon?: string;
}

// Fallback for non-secure contexts (HTTP non-localhost) where
// crypto.randomUUID is unavailable.
function uuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `b-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createBlock(type: BlockType = 'text'): Block {
  return { id: uuid(), type, content: '' };
}

export function isBlockContent(content: string): boolean {
  return content.trim().startsWith('[{');
}

const VALID_BLOCK_TYPES: ReadonlySet<string> = new Set<BlockType>([
  'text', 'heading1', 'heading2', 'heading3', 'quote', 'divider',
  'bullet_list', 'numbered_list', 'code', 'callout', 'todo',
]);

// Coerce a single untrusted value into a safe Block. Block `content` is rendered
// via innerHTML downstream, so we must guarantee it is a string and the type is
// one we know how to render — never trust the stored JSON shape blindly.
function sanitizeBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const type = (typeof o.type === 'string' && VALID_BLOCK_TYPES.has(o.type)) ? (o.type as BlockType) : 'text';
  const block: Block = {
    id: typeof o.id === 'string' ? o.id : crypto.randomUUID(),
    type,
    content: typeof o.content === 'string' ? o.content : '',
  };
  if (typeof o.checked === 'boolean') block.checked = o.checked;
  if (typeof o.language === 'string') block.language = o.language;
  if (typeof o.calloutIcon === 'string') block.calloutIcon = o.calloutIcon;
  return block;
}

export function parseBlocks(content: string): Block[] {
  if (!isBlockContent(content)) return [createBlock('text')];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      const blocks = parsed.map(sanitizeBlock).filter((b): b is Block => b !== null);
      return blocks.length > 0 ? blocks : [createBlock('text')];
    }
  } catch {}
  return [createBlock('text')];
}

const exportLines = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean);

type ExportGroup =
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'block'; block: Block };

// Group consecutive bullet/numbered list blocks (each block is one item) so
// exports render a single, correctly-numbered list instead of many 1-item lists.
function groupForExport(blocks: Block[]): ExportGroup[] {
  const groups: ExportGroup[] = [];
  for (const b of blocks) {
    if (b.type === 'bullet_list' || b.type === 'numbered_list') {
      const kind: 'ul' | 'ol' = b.type === 'bullet_list' ? 'ul' : 'ol';
      const items = exportLines(b.content);
      const last = groups[groups.length - 1];
      if (last && last.kind === kind) last.items.push(...items);
      else groups.push(kind === 'ul' ? { kind: 'ul', items } : { kind: 'ol', items });
    } else {
      groups.push({ kind: 'block', block: b });
    }
  }
  return groups;
}

export function blocksToMarkdown(blocks: Block[]): string {
  return groupForExport(blocks).map((g) => {
    if (g.kind === 'ul') return g.items.map((l) => `- ${l}`).join('\n');
    if (g.kind === 'ol') return g.items.map((l, i) => `${i + 1}. ${l}`).join('\n');
    const b = g.block;
    switch (b.type) {
      case 'heading1': return `# ${b.content}`;
      case 'heading2': return `## ${b.content}`;
      case 'heading3': return `### ${b.content}`;
      case 'quote': return b.content.split('\n').map(l => `> ${l}`).join('\n');
      case 'divider': return '---';
      case 'code': return '```' + (b.language || '') + '\n' + b.content + '\n```';
      case 'callout': return `> **${b.calloutIcon || '💡'} ${b.content}**`;
      case 'todo': return `- [${b.checked ? 'x' : ' '}] ${b.content}`;
      default: return b.content;
    }
  }).join('\n\n');
}

export function blocksToHtml(blocks: Block[]): string {
  return groupForExport(blocks).map((g) => {
    if (g.kind === 'ul') return `<ul class="list-disc pl-6 space-y-1 my-2 text-ink-primary">${g.items.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`;
    if (g.kind === 'ol') return `<ol class="list-decimal pl-6 space-y-1 my-2 text-ink-primary">${g.items.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ol>`;
    const b = g.block;
    const c = escapeHtml(b.content).replace(/\n/g, '<br/>');
    switch (b.type) {
      case 'heading1': return `<h1 class="text-2xl font-display font-bold text-ink-primary mt-6 mb-2">${c}</h1>`;
      case 'heading2': return `<h2 class="text-xl font-display font-bold text-ink-primary mt-5 mb-1">${c}</h2>`;
      case 'heading3': return `<h3 class="text-lg font-display font-semibold text-ink-primary mt-4 mb-1">${c}</h3>`;
      case 'quote': return `<blockquote class="border-l-3 border-accent pl-4 my-2 text-ink-secondary italic">${c}</blockquote>`;
      case 'divider': return '<hr class="my-4 border-surface-border" />';
      case 'code': return `<pre class="bg-surface-hover rounded-lg p-3 my-2 overflow-x-auto text-sm font-mono"><code>${c}</code></pre>`;
      case 'callout': return `<div class="flex items-start gap-3 bg-accent/10 border border-accent/20 rounded-lg p-3 my-2"><span class="text-lg shrink-0">${escapeHtml(b.calloutIcon || '💡')}</span><div class="text-sm text-ink-primary">${c}</div></div>`;
      case 'todo': return `<div class="flex items-start gap-2 my-1"><span class="mt-0.5 text-sm">${b.checked ? '☑' : '☐'}</span><span class="text-sm text-ink-primary ${b.checked ? 'line-through text-ink-secondary/50' : ''}">${c}</span></div>`;
      default: return `<p class="my-1 text-ink-primary leading-relaxed">${c || '<br/>'}</p>`;
    }
  }).join('\n');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function markdownToBlocks(md: string): Block[] {
  if (!md.trim()) return [createBlock('text')];
  const blocks: Block[] = [];
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const hm = line.match(/^(#{1,3})\s+(.+)/);
    if (hm) { blocks.push({ id: crypto.randomUUID(), type: `heading${hm[1].length}` as BlockType, content: hm[2] }); i++; continue; }
    if (/^[-*_]{3,}\s*$/.test(line)) { blocks.push(createBlock('divider')); i++; continue; }
    if (line.startsWith('> ') && !line.match(/^>\s+\*\*(.+?)\*\*/)) { const qLines = []; while (i < lines.length && lines[i].startsWith('> ') && !lines[i].match(/^>\s+\*\*(.+?)\*\*/)) { qLines.push(lines[i].slice(2)); i++; } blocks.push({ id: crypto.randomUUID(), type: 'quote', content: qLines.join('\n') }); continue; }
    if (line.startsWith('```')) { const lang = line.slice(3).trim(); i++; const codeLines = []; while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; } i++; blocks.push({ id: crypto.randomUUID(), type: 'code', content: codeLines.join('\n'), language: lang || undefined }); continue; }
    const todoM = line.match(/^-\s+\[(.)\]\s+(.+)/);
    if (todoM) { blocks.push({ id: crypto.randomUUID(), type: 'todo', content: todoM[2], checked: todoM[1] === 'x' }); i++; continue; }
    if (line.startsWith('- ') && !line.startsWith('- [')) { const bLines = []; while (i < lines.length && lines[i].startsWith('- ') && !lines[i].startsWith('- [')) { bLines.push(lines[i].slice(2)); i++; } blocks.push({ id: crypto.randomUUID(), type: 'bullet_list', content: bLines.join('\n') }); continue; }
    const nlM = line.match(/^\d+\.\s+(.+)/);
    if (nlM) { const nLines = []; while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { nLines.push(lines[i].replace(/^\d+\.\s+/, '')); i++; } blocks.push({ id: crypto.randomUUID(), type: 'numbered_list', content: nLines.join('\n') }); continue; }
    const coM = line.match(/^>\s+\*\*(.+?)\*\*\s+(.+)/);
    if (coM) { blocks.push({ id: crypto.randomUUID(), type: 'callout', content: coM[2], calloutIcon: coM[1] }); i++; continue; }
    if (line.trim() === '') { i++; continue; }
    blocks.push({ id: crypto.randomUUID(), type: 'text', content: line }); i++;
  }
  if (blocks.length === 0) blocks.push(createBlock('text'));
  return blocks;
}

export function computeBlockWordCount(blocks: Block[]): number {
  return blocks.reduce((c, b) => c + (b.type === 'divider' ? 0 : b.content.split(/\s+/).filter(Boolean).length), 0);
}

export function blockExcerpt(blocks: Block[], len = 200): string {
  let result = '';
  for (const b of blocks) {
    if (b.type === 'divider') continue;
    result += (result ? ' ' : '') + b.content;
    if (result.length >= len) break;
  }
  return result.slice(0, len);
}

export function computeWordCount(content: string): number {
  if (isBlockContent(content)) {
    return computeBlockWordCount(parseBlocks(content));
  }
  return content.split(/\s+/).filter(Boolean).length;
}

// Notion-style editing treats each list item as its own block. Legacy notes
// stored an entire list as one multiline `bullet_list`/`numbered_list` block,
// so split those into per-item blocks when loading into the editor. Idempotent
// and safe for the renderer (which already splits multiline content too).
const LIST_TYPES: ReadonlySet<BlockType> = new Set<BlockType>(['bullet_list', 'numbered_list']);

export function normalizeBlocks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    if (LIST_TYPES.has(b.type) && b.content.includes('\n')) {
      const lines = b.content.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        out.push({ ...b, content: '' });
      } else {
        for (const line of lines) {
          out.push({ id: crypto.randomUUID(), type: b.type, content: line.trim() });
        }
      }
    } else {
      out.push(b);
    }
  }
  return out.length > 0 ? out : [createBlock('text')];
}
