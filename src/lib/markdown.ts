// ── Compact inline markdown → HTML renderer ───────────────────
// Shared across note create & detail pages.
export function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Inline code (before bold/italic to avoid conflicts)
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-surface-border px-1 py-0.5 rounded text-sm font-mono">$1</code>',
  );
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-accent hover:underline" target="_blank" rel="noopener">$1</a>',
  );
  // Images
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" class="rounded-md max-w-full my-2" />',
  );

  // Block-level processing
  const lines = html.split("\n");
  const out: string[] = [];
  let inList = false;

  for (const line of lines) {
    // Headings h1–h6
    const hm = line.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      if (inList) { out.push("</ul>"); inList = false; }
      const sizes = [
        "text-2xl font-bold", "text-xl font-bold", "text-lg font-semibold",
        "text-base font-semibold", "text-sm font-semibold", "text-xs font-semibold",
      ];
      const lvl = hm[1].length;
      out.push(
        `<h${lvl} class="${sizes[lvl - 1]} mt-4 mb-2 text-ink-primary">${hm[2]}</h${lvl}>`,
      );
      continue;
    }
    // Unordered list (- or *)
    const lm = line.match(/^[-*]\s+(.+)/);
    if (lm) {
      if (!inList) {
        out.push('<ul class="list-disc pl-5 space-y-1 my-2 text-ink-primary">');
        inList = true;
      }
      out.push(`<li>${lm[1]}</li>`);
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    // Blockquote
    const bq = line.match(/^>\s?(.*)/);
    if (bq) {
      out.push(
        `<blockquote class="border-l-3 border-accent pl-4 my-2 text-ink-secondary italic">${bq[1] || "&nbsp;"}</blockquote>`,
      );
      continue;
    }
    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line)) {
      out.push('<hr class="my-4 border-surface-border" />');
      continue;
    }
    // Empty line
    if (line.trim() === "") {
      out.push("<br />");
      continue;
    }
    out.push(
      `<p class="my-1 text-ink-primary leading-relaxed">${line || "&nbsp;"}</p>`,
    );
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}
