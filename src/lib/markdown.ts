// Only allow safe URL schemes in links/images. Blocks javascript:, data:,
// vbscript:, etc. Permits http(s), mailto, and relative/anchor URLs. The
// returned value is also attribute-escaped so it cannot break out of href/src.
export function safeUrl(url: string): string {
  const trimmed = url.trim();
  // If the URL declares an explicit scheme, it must be in the allowlist.
  // A scheme is a leading [a-z][a-z0-9.+-]* followed by ":".
  const scheme = /^([a-z][a-z0-9.+-]*):/i.exec(trimmed)?.[1]?.toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https" && scheme !== "mailto") {
    return "#"; // blocks javascript:, data:, vbscript:, file:, ...
  }
  // No scheme => relative path / anchor, which is safe.
  return trimmed.replace(/"/g, "%22").replace(/</g, "%3C").replace(/>/g, "%3E");
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}

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
  // Images (before links — `![alt](url)` contains a `[alt](url)` link pattern)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_m, alt: string, url: string) =>
      `<img src="${safeUrl(url)}" alt="${escapeAttr(alt)}" class="rounded-md max-w-full my-2" />`,
  );
  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, label: string, url: string) =>
      `<a href="${safeUrl(url)}" class="text-accent hover:underline" target="_blank" rel="noopener">${label}</a>`,
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
