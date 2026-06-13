import { isAiAvailable, getModel } from "./openai";
import { isBlockContent, parseBlocks, blocksToMarkdown } from "../blocks";

function extractText(content: string): string {
  if (isBlockContent(content)) {
    const blocks = parseBlocks(content);
    return blocksToMarkdown(blocks);
  }
  return content;
}

export async function summarizeNote(content: string): Promise<string> {
  if (!isAiAvailable()) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const text = extractText(content);
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount < 30) {
    throw new Error("NOTE_TOO_SHORT");
  }

  const prompt = `Summarize the following note in 3-5 concise bullet points. Capture only the key ideas. Write in English. Keep each bullet under 20 words.

Note content:
${text.slice(0, 6000)}`;

  const model = getModel()!;
  const result = await model.generateContent(prompt);
  const response = result.response;
  const summary = response.text().trim();

  if (!summary) {
    throw new Error("AI_EMPTY_RESPONSE");
  }

  return summary;
}
