export interface BossAbility {
  type: string;
  name: string;
  description: string;
  icon: string;
  data?: Record<string, number>;
}

/**
 * Safely parse a bossAbility value from the database.
 * Returns null if the value is missing, malformed, or double-stringified.
 */
export function parseBossAbility(raw: unknown): BossAbility | null {
  if (!raw) return null;
  // Handle double-stringified JSON (string within JSON string)
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { return null; }
  }
  if (typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.type !== "string" || typeof obj.name !== "string") return null;
  return raw as BossAbility;
}

interface AbilityResult {
  damage: number;
  blocked: boolean;
  message: string;
  currentHp: number;
}

export const ALL_ABILITIES: BossAbility[] = [
  {
    type: "thick_hide",
    name: "Thick Hide",
    description: "Quiz damage -50%, Note damage +50%",
    icon: "🛡️",
    data: { quizMultiplier: 0.5, noteMultiplier: 1.5 },
  },
  {
    type: "fog_shield",
    name: "Fog Shield",
    description: "First 3 attacks each day deal 0 damage",
    icon: "🌫️",
    data: { shieldCount: 3 },
  },
  {
    type: "blank_curse",
    name: "Blank Curse",
    description: "Each note heals boss 5 HP but empowers your next attack +2",
    icon: "📄",
    data: { healPerNote: 5, empowerBonus: 2 },
  },
  {
    type: "void_immune",
    name: "Void Immune",
    description: "Immune to quiz damage — use notes or habits",
    icon: "🌑",
    data: { quizMultiplier: 0 },
  },
  {
    type: "regen",
    name: "Regeneration",
    description: "Heals 10% max HP at midnight if still alive",
    icon: "♻️",
    data: { regenPct: 0.1 },
  },
  {
    type: "procrastination_aura",
    name: "Procrastination Aura",
    description: "Note damage -50% if you haven't completed a quest today",
    icon: "👻",
    data: { noteMultiplier: 0.5, requiresQuest: 1 },
  },
  {
    type: "dust_cloud",
    name: "Dust Cloud",
    description: "20% chance to miss when attacking with notes",
    icon: "💨",
    data: { missChance: 0.2 },
  },
  {
    type: "colossal",
    name: "Colossal Fortitude",
    description: "Must use all 3 attack types (note+quiz+habit) to deal full damage",
    icon: "🗿",
    data: {},
  },
  // Weakness system
  {
    type: "weak_note",
    name: "Ink Allergy",
    description: "Takes 3x damage from notes",
    icon: "📝",
    data: { noteMultiplier: 3 },
  },
  {
    type: "weak_quiz",
    name: "Quizbane",
    description: "Takes 3x damage from quizzes",
    icon: "🧠",
    data: { quizMultiplier: 3 },
  },
  {
    type: "weak_habit",
    name: "Ritual Vulnerability",
    description: "Takes 3x damage from habits",
    icon: "🔥",
    data: { habitMultiplier: 3 },
  },
];

const DAILY_ABILITIES = ALL_ABILITIES.filter((a) =>
  ["thick_hide", "fog_shield", "dust_cloud", "procrastination_aura", "weak_note", "weak_quiz"].includes(a.type)
);

const WEEKLY_ABILITIES = ALL_ABILITIES.filter((a) => true); // all available for weekly

export function getRandomAbility(bossType: "daily" | "weekly"): BossAbility {
  const pool = bossType === "daily" ? DAILY_ABILITIES : WEEKLY_ABILITIES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getAbilityByName(type: string): BossAbility | undefined {
  return ALL_ABILITIES.find((a) => a.type === type);
}

/**
 * Apply boss ability modifiers to damage. Returns modified damage amount.
 */
export function applyBossAbility(
  ability: BossAbility | null,
  params: {
    actionType: "note" | "quiz" | "habit" | "focus";
    damage: number;
    bossCurrentHp: number;
    bossMaxHp: number;
    attacksToday?: number;
    questCompletedToday?: boolean;
    usedTypesToday?: Set<string>;
  }
): { damage: number; message: string | null } {
  if (!ability) return { damage: params.damage, message: null };

  const { type, data } = ability;
  let damage = params.damage;
  let message: string | null = null;

  switch (type) {
    case "thick_hide":
      if (params.actionType === "quiz" && data?.quizMultiplier) {
        damage = Math.round(damage * data.quizMultiplier);
        message = "Thick Hide resists quiz damage!";
      } else if (params.actionType === "note" && data?.noteMultiplier) {
        damage = Math.round(damage * data.noteMultiplier);
        message = "Thick Hide is weak to notes! Bonus damage!";
      }
      break;

    case "fog_shield":
      if ((params.attacksToday ?? 0) < (data?.shieldCount ?? 3)) {
        damage = 0;
        message = `Fog Shield blocks the attack! (${(data?.shieldCount ?? 3) - (params.attacksToday ?? 0)} hits remain)`;
      }
      break;

    case "void_immune":
      if (params.actionType === "quiz") {
        damage = 0;
        message = "Void Immune: quiz attacks have no effect!";
      }
      break;

    case "dust_cloud":
      if (params.actionType === "note" && Math.random() < (data?.missChance ?? 0.2)) {
        damage = 0;
        message = "Dust Cloud causes your note attack to miss!";
      }
      break;

    case "procrastination_aura":
      if (params.actionType === "note" && !params.questCompletedToday) {
        damage = Math.round(damage * (data?.noteMultiplier ?? 0.5));
        message = "Procrastination Aura weakens your note! Complete a quest first!";
      }
      break;

    case "colossal":
      if (params.usedTypesToday && params.usedTypesToday.size < 3 && params.usedTypesToday.has(params.actionType)) {
        damage = 1;
        message = "Colossal: already used this type today! Try a different attack type.";
      }
      break;

    case "weak_note":
      if (params.actionType === "note" && data?.noteMultiplier) {
        damage = Math.round(damage * data.noteMultiplier);
        message = "Ink Allergy! Notes deal TRIPLE damage!";
      }
      break;

    case "weak_quiz":
      if (params.actionType === "quiz" && data?.quizMultiplier) {
        damage = Math.round(damage * data.quizMultiplier);
        message = "Quizbane! Quizzes deal TRIPLE damage!";
      }
      break;

    case "weak_habit":
      if (params.actionType === "habit" && data?.habitMultiplier) {
        damage = Math.round(damage * data.habitMultiplier);
        message = "Ritual Vulnerability! Habits deal TRIPLE damage!";
      }
      break;
  }

  return { damage: Math.min(damage, 200), message };
}

/**
 * Apply regeneration at midnight (call from spawner or cron)
 */
export function getRegenAmount(ability: BossAbility | null, bossMaxHp: number, bossCurrentHp: number): number {
  if (!ability || ability.type !== "regen") return 0;
  const pct = (ability.data?.regenPct as number) ?? 0.1;
  return Math.round(bossMaxHp * pct);
}
