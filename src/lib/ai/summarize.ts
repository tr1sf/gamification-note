import { isAiAvailable, getClient, SUMMARIZE_MODEL } from "./openai";

export async function summarizeNote(content: string): Promise<string> {
  if (!isAiAvailable()) throw new Error("AI_NOT_CONFIGURED");

  // Extract text from content (handles block-based format)
  let text = content;
  if (content.trim().startsWith("[{")) {
    try {
      const blocks = JSON.parse(content) as Array<{ type: string; content: string }>;
      text = blocks.map((b) => b.content || "").join("\n\n");
    } catch {
      // Not valid JSON, use as-is
    }
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 30) throw new Error("NOTE_TOO_SHORT");

  const openai = getClient();
  const response = await openai.chat.completions.create({
    model: SUMMARIZE_MODEL,
    messages: [
      {
        role: "system",
        content: `You are a helpful note summarizer. Summarize the following note in 3-5 concise bullet points. Capture only the key ideas. Keep each bullet under 20 words. Respond in the same language as the input.

IMPORTANT: Each bullet MUST start with "- " (dash + space) and each bullet MUST be on its own line. No numbering, no bold, no extra formatting. Just plain text with "- " prefix per line.

Example format:
- First key idea here
- Second key idea here
- Third key idea here`,
      },
      { role: "user", content: text.slice(0, 6000) },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  const summary = response.choices[0]?.message?.content?.trim();
  if (!summary) throw new Error("AI_EMPTY_RESPONSE");
  return summary;
}
