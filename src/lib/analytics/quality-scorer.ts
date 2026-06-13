import type { AuditMetadata } from "./types";
import type { Block } from "~/lib/blocks";

export function calculateStructureScore(
  blocks: Block[],
  tags: string[],
  category: string | null,
): { score: number; metadata: AuditMetadata } {
  let score = 0;

  const allTypes = new Set(blocks.map((b) => b.type));
  const hasH1 = allTypes.has("heading1") || allTypes.has("heading2");
  const hasH2 = allTypes.has("heading3");
  const hasList = allTypes.has("bullet_list") || allTypes.has("numbered_list");
  const hasCode = allTypes.has("code");
  // Note: this project's Block stores content as a plain string,
  // so image/attachment detection is not possible at the block-type level.
  const hasImage = false;
  const linkCount = blocks.reduce((count, b) => {
    const mdLinks = (b.content.match(/\[.*?\]\(.*?\)/g) || []).length;
    return count + mdLinks;
  }, 0);
  const wordCount = blocks.reduce((total, b) => {
    return total + b.content.split(/\s+/).filter(Boolean).length;
  }, 0);

  if (hasH1) score += 1;
  if (hasH2) score += 1;
  if (hasList) score += 1;
  if (hasCode) score += 1;
  if (linkCount > 0) score += Math.min(linkCount, 2);
  if (wordCount > 50) score += 1;
  if (wordCount > 200) score += 1;
  if (tags.length > 0) score += 1;
  if (category) score += 1;

  return {
    score: Math.min(10, score),
    metadata: {
      structureScore: Math.min(10, score),
      hasH1,
      hasH2,
      hasList,
      hasCode,
      hasImage,
      linkCount,
      tagCount: tags.length,
      hasCategory: !!category,
      wordCount,
      isBlockContent: true,
    },
  };
}

export function scorePlainText(
  content: string,
  tags: string[],
  category: string | null,
): { score: number; metadata: AuditMetadata } {
  let score = 0;
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const hasH1 = /^#\s/m.test(content);
  const hasH2 = /^##\s/m.test(content);
  const hasList = /^[-*]\s/m.test(content);
  const hasCode = /```/.test(content);
  const hasImage = /!\[/.test(content);
  const linkCount = (content.match(/\[.*?\]\(.*?\)/g) || []).length;

  if (hasH1) score += 1;
  if (hasH2) score += 1;
  if (hasList) score += 1;
  if (hasCode) score += 1;
  if (linkCount > 0) score += Math.min(linkCount, 2);
  if (wordCount > 50) score += 1;
  if (wordCount > 200) score += 1;
  if (tags.length > 0) score += 1;
  if (category) score += 1;

  return {
    score: Math.min(10, score),
    metadata: {
      structureScore: Math.min(10, score),
      hasH1,
      hasH2,
      hasList,
      hasCode,
      hasImage,
      linkCount,
      tagCount: tags.length,
      hasCategory: !!category,
      wordCount,
      isBlockContent: false,
    },
  };
}
