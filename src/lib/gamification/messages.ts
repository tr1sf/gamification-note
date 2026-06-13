const MESSAGES: Record<string, (meta?: Record<string, unknown>) => string> = {
  create_note: (m) =>
    `New scroll added to your collection! +${m?.xp ?? 0} XP`,
  write_words: (m) =>
    `Words flow like ink! +${m?.xp ?? 0} XP`,
  make_public: () =>
    "Your scroll is now visible to fellow adventurers! +5 XP",
  daily_login: (m) => {
    const streak = typeof m?.streak === "number" ? m.streak : 0;
    return streak > 1
      ? `${streak}-day streak! The tavern welcomes you back. +${m?.xp ?? 0} XP`
      : "Welcome to the tavern, adventurer! +5 XP";
  },
  complete_quest: (m) => {
    const title = m?.questTitle ?? "Quest";
    return `Quest complete: ${title}! +${m?.xpReward ?? 0} XP, +${m?.coinReward ?? 0} coins`;
  },
  join_guild: () =>
    "You've joined a new guild!",
  create_guild: () =>
    "A new guild banner has been raised!",
  ai_summarize: () =>
    "AI has extracted the key insights for you! +15 XP",
  unlock_achievement: (m) => {
    const title = m?.achievementTitle ?? "Achievement";
    return `Achievement unlocked: ${title}!`;
  },
  review_note: () =>
    "Reviewing old knowledge keeps the mind sharp! +5 XP",
  structured_note: () =>
    "A well-structured scroll — a true scholar's work! +8 XP",
  export_note: () =>
    "Scroll exported — ready to share with the world! +3 XP",
  share_note: () =>
    "Your knowledge has reached another adventurer! +5 XP",
  add_link: () =>
    "Knowledge connects — link added! +3 XP",
};

export function getActionMessage(
  actionType: string,
  meta?: Record<string, unknown>,
): string {
  const factory = MESSAGES[actionType];
  return factory ? factory(meta) : `+${meta?.xp ?? 0} XP`;
}
