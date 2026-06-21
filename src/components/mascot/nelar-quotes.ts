import type { NelarState } from "./Nelar";

/** Maps a Nelar state to a localized quote the mascot might "say."
 *  Values are i18n keys looked up via `t()`. */
export const NELAR_QUOTES: Record<NelarState, string> = {
  idle: "Nelar greets you warmly.",
  sleeping: "Nelar is dozing by the hearth...",
  happy: "Nelar purrs with delight!",
  curious: "Nelar tilts their head curiously.",
  worried: "Nelar looks worried for you...",
  wave: "Nelar waves hello!",
};

/** Context-specific quotes for empty states. */
export const NELAR_EMPTY_QUOTES: Record<string, string> = {
  notes: "No scrolls? Nelar suggests you write your first one!",
  quests: "No quests yet? Nelar hears adventures calling!",
  quiz: "No quizzes? Nelar says: write 100+ word notes to generate some!",
  shop: "The shop is quiet. Nelar naps by the coin chest.",
  guilds: "No guilds found. Nelar says: create the first fellowship!",
  guildNotFound: "This tavern room is empty... Nelar can't find it.",
  boss: "No bosses active. Nelar says: keep writing to summon them!",
  habits: "No habits yet. Nelar suggests starting a daily ritual!",
  chat: "No messages yet. Nelar says: be the first to speak!",
  tasks: "No tasks assigned. Nelar rests contentedly.",
  goals: "No goals set. Nelar wonders what the guild will chase.",
  notesGuild: "No shared scrolls. Nelar awaits contributions.",
  radar: "Nelar says: write your first scroll to begin your adventure!",
};
