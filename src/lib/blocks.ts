export type BlockType = 'text' | 'heading1' | 'heading2' | 'heading3' | 'quote' | 'divider' | 'bullet_list' | 'numbered_list' | 'code' | 'callout' | 'todo';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  language?: string;
  calloutIcon?: string;
}

export function createBlock(type: BlockType = 'text'): Block {
  return { id: crypto.randomUUID(), type, content: '' };
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

export function blocksToMarkdown(blocks: Block[]): string {
  return blocks.map(b => {
    switch (b.type) {
      case 'heading1': return `# ${b.content}`;
      case 'heading2': return `## ${b.content}`;
      case 'heading3': return `### ${b.content}`;
      case 'quote': return b.content.split('\n').map(l => `> ${l}`).join('\n');
      case 'divider': return '---';
      case 'bullet_list': return b.content.split('\n').filter(l => l.trim()).map(l => `- ${l}`).join('\n');
      case 'numbered_list': return b.content.split('\n').filter(l => l.trim()).map((l, i) => `${i + 1}. ${l}`).join('\n');
      case 'code': return '```' + (b.language || '') + '\n' + b.content + '\n```';
      case 'callout': return `> **${b.calloutIcon || '💡'} ${b.content}**`;
      case 'todo': return `- [${b.checked ? 'x' : ' '}] ${b.content}`;
      default: return b.content;
    }
  }).join('\n\n');
}

export function blocksToHtml(blocks: Block[]): string {
  return blocks.map(b => {
    const c = escapeHtml(b.content).replace(/\n/g, '<br/>');
    switch (b.type) {
      case 'heading1': return `<h1 class="text-2xl font-display font-bold text-ink-primary mt-6 mb-2">${c}</h1>`;
      case 'heading2': return `<h2 class="text-xl font-display font-bold text-ink-primary mt-5 mb-1">${c}</h2>`;
      case 'heading3': return `<h3 class="text-lg font-display font-semibold text-ink-primary mt-4 mb-1">${c}</h3>`;
      case 'quote': return `<blockquote class="border-l-3 border-accent pl-4 my-2 text-ink-secondary italic">${c}</blockquote>`;
      case 'divider': return '<hr class="my-4 border-surface-border" />';
      case 'bullet_list': return `<ul class="list-disc pl-5 space-y-1 my-2 text-ink-primary">${b.content.split('\n').filter(l => l.trim()).map(l => `<li>${escapeHtml(l.trim())}</li>`).join('')}</ul>`;
      case 'numbered_list': return `<ol class="list-decimal pl-5 space-y-1 my-2 text-ink-primary">${b.content.split('\n').filter(l => l.trim()).map((l, i) => `<li>${escapeHtml(l.trim())}</li>`).join('')}</ol>`;
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
