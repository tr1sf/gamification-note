import type { AuditMetadata } from "./types";
import type { Block } from "~/lib/blocks";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "this", "that", "it", "its", "i", "you", "he", "she", "we", "they",
  "my", "your", "his", "her", "our", "their", "me", "us", "him", "them",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "not", "no", "so", "if", "then", "than",
  "also", "very", "just", "now", "about", "into", "over", "such", "only",
  "other", "new", "some", "any", "each", "all", "both", "few", "more",
  "most", "one", "two", "too", "well", "even", "here", "there", "when",
]);

const MIN_WORD_COUNT = 20;

interface ScoreBreakdown {
  heading: number;
  subheading: number;
  list: number;
  code: number;
  links: number;
  tagsCategory: number;
  words50: number;
  words200: number;
  words500: number;
  vocabDiversity: number;
  penalty: number;
  total: number;
}

export function calculateStructureScore(
  blocks: Block[],
  tags: string[],
  category: string | null,
): { score: number; metadata: AuditMetadata; breakdown: ScoreBreakdown } {
  const allTypes = new Set(blocks.map((b) => b.type));
  const hasH1 = allTypes.has("heading1") || allTypes.has("heading2");
  const hasH2 = allTypes.has("heading3");
  const hasList = allTypes.has("bullet_list") || allTypes.has("numbered_list");
  const hasCode = allTypes.has("code");
  const linkCount = blocks.reduce((count, b) => {
    return count + (b.content.match(/\[.*?\]\(.*?\)/g) || []).length;
  }, 0);
  const wordCount = blocks.reduce((total, b) => {
    return total + b.content.split(/\s+/).filter(Boolean).length;
  }, 0);

  return computeScore({
    wordCount, hasH1, hasH2, hasList, hasCode,
    linkCount, tags, category, isBlock: true,
    content: blocks.map((b) => b.content).join(" "),
  });
}

export function scorePlainText(
  content: string,
  tags: string[],
  category: string | null,
): { score: number; metadata: AuditMetadata; breakdown: ScoreBreakdown } {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  // Detect Markdown structure (also handle HTML tags)
  const hasH1 = /^#\s/m.test(content) || /<h1[>\s]/i.test(content);
  const hasH2 = /^##\s/m.test(content) || /<h2[>\s]/i.test(content);
  const hasList = /^[-*]\s/m.test(content) || /<[uo]l[>\s]/i.test(content);
  const hasCode = /```/.test(content) || /<pre[>\s]/i.test(content);
  const hasImage = /!\[/.test(content) || /<img[>\s]/i.test(content);
  const linkCount = (content.match(/\[.*?\]\(.*?\)/g) || []).length + (content.match(/<a[>\s]/gi) || []).length;

  return computeScore({
    wordCount, hasH1, hasH2, hasList, hasCode,
    linkCount, tags, category, isBlock: false,
    content,
  });
}

function vocabularyDiversity(content: string): number {
  const words = content.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  if (words.length < 10) return 0;
  const uniqueWords = new Set(words);
  const ratio = uniqueWords.size / words.length;
  if (ratio < 0.25) return 0;
  if (ratio < 0.4) return 1;
  return 2;
}

function computeScore(params: {
  wordCount: number;
  hasH1: boolean;
  hasH2: boolean;
  hasList: boolean;
  hasCode: boolean;
  linkCount: number;
  tags: string[];
  category: string | null;
  isBlock: boolean;
  content: string;
}): { score: number; metadata: AuditMetadata; breakdown: ScoreBreakdown } {
  const { wordCount, hasH1, hasH2, hasList, hasCode, linkCount, tags, category, isBlock, content } = params;

  const breakdown: ScoreBreakdown = {
    heading: hasH1 ? 1 : 0,
    subheading: hasH2 ? 1 : 0,
    list: hasList ? 1 : 0,
    code: hasCode ? 1 : 0,
    links: linkCount > 0 ? 1 : 0,
    tagsCategory: (tags.length > 0 || !!category) ? 1 : 0,
    words50: wordCount > 50 ? 2 : 0,
    words200: wordCount > 200 ? 3 : 0,
    words500: wordCount > 500 ? 2 : 0,
    vocabDiversity: vocabularyDiversity(content),
    penalty: 0,
    total: 0,
  };

  // Minimum word count penalty — auto-zero if too short
  if (wordCount < MIN_WORD_COUNT) {
    breakdown.penalty = -999;
    breakdown.total = 0;
    return {
      score: 0,
      metadata: {
        structureScore: 0,
        hasH1, hasH2, hasList, hasCode,
        hasImage: isBlock ? false : /!\[/.test(content),
        linkCount,
        tagCount: tags.length,
        hasCategory: !!category,
        wordCount,
        isBlockContent: isBlock,
      },
      breakdown,
    };
  }

  breakdown.total =
    breakdown.heading +
    breakdown.subheading +
    breakdown.list +
    breakdown.code +
    breakdown.links +
    breakdown.tagsCategory +
    breakdown.words50 +
    breakdown.words200 +
    breakdown.words500 +
    breakdown.vocabDiversity +
    breakdown.penalty;

  const score = Math.min(15, Math.max(0, breakdown.total));

  return {
    score,
    metadata: {
      structureScore: score,
      hasH1, hasH2, hasList, hasCode,
      hasImage: isBlock ? false : /!\[/.test(content),
      linkCount,
      tagCount: tags.length,
      hasCategory: !!category,
      wordCount,
      isBlockContent: isBlock,
    },
    breakdown,
  };
}

export function getImprovementTips(bd: ScoreBreakdown): string[] {
  const tips: string[] = [];
  if (bd.penalty < 0) tips.push("Write at least 20 words to get a score");
  if (bd.heading === 0) tips.push("Add a heading (# Title) — +1 score");
  if (bd.subheading === 0) tips.push("Add a subheading (## Section) — +1 score");
  if (bd.list === 0) tips.push("Use bullet or numbered lists — +1 score");
  if (bd.code === 0) tips.push("Add a code block for examples — +1 score");
  if (bd.links === 0) tips.push("Add a reference link — +1 score");
  if (bd.tagsCategory === 0) tips.push("Add tags or a category — +1 score");
  if (bd.words50 === 0) tips.push("Write more than 50 words — +2 score");
  if (bd.words200 === 0) tips.push("Write more than 200 words — +3 score");
  if (bd.words500 === 0) tips.push("Write 500+ words for deep content — +2 score");
  if (bd.vocabDiversity < 2) tips.push("Use more diverse vocabulary (avoid repetition) — up to +2 score");
  return tips;
}
