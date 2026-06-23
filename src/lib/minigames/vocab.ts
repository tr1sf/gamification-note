export interface VocabPair {
  emoji: string;
  word: string;
  category: string;
  difficulty: number;
}

export const VOCAB_SETS: Record<string, VocabPair[]> = {
  kitchen: [
    { emoji: "🍎", word: "apple", category: "kitchen", difficulty: 1 },
    { emoji: "🍞", word: "bread", category: "kitchen", difficulty: 1 },
    { emoji: "🍯", word: "honey", category: "kitchen", difficulty: 1 },
    { emoji: "🥛", word: "milk", category: "kitchen", difficulty: 1 },
    { emoji: "🧀", word: "cheese", category: "kitchen", difficulty: 1 },
    { emoji: "🍇", word: "grape", category: "kitchen", difficulty: 1 },
    { emoji: "🥚", word: "egg", category: "kitchen", difficulty: 1 },
    { emoji: "🧂", word: "salt", category: "kitchen", difficulty: 1 },
    { emoji: "🍖", word: "meat", category: "kitchen", difficulty: 1 },
    { emoji: "🐟", word: "fish", category: "kitchen", difficulty: 1 },
    { emoji: "🧅", word: "onion", category: "kitchen", difficulty: 1 },
    { emoji: "🥕", word: "carrot", category: "kitchen", difficulty: 1 },
    { emoji: "🧄", word: "garlic", category: "kitchen", difficulty: 2 },
    { emoji: "🍋", word: "lemon", category: "kitchen", difficulty: 2 },
    { emoji: "🌶", word: "pepper", category: "kitchen", difficulty: 2 },
    { emoji: "🥩", word: "steak", category: "kitchen", difficulty: 2 },
    { emoji: "🍄", word: "mushroom", category: "kitchen", difficulty: 2 },
    { emoji: "🍫", word: "chocolate", category: "kitchen", difficulty: 2 },
    { emoji: "🧁", word: "cupcake", category: "kitchen", difficulty: 2 },
    { emoji: "🥧", word: "pie", category: "kitchen", difficulty: 2 },
    { emoji: "🫒", word: "olive", category: "kitchen", difficulty: 3 },
    { emoji: "🥑", word: "avocado", category: "kitchen", difficulty: 3 },
    { emoji: "🥦", word: "broccoli", category: "kitchen", difficulty: 3 },
    { emoji: "🫘", word: "beans", category: "kitchen", difficulty: 3 },
    { emoji: "🍣", word: "sushi", category: "kitchen", difficulty: 3 },
    { emoji: "🥜", word: "peanut", category: "kitchen", difficulty: 3 },
  ],
  forest: [
    { emoji: "🦅", word: "eagle", category: "forest", difficulty: 1 },
    { emoji: "🦉", word: "owl", category: "forest", difficulty: 1 },
    { emoji: "🦊", word: "fox", category: "forest", difficulty: 1 },
    { emoji: "🐺", word: "wolf", category: "forest", difficulty: 1 },
    { emoji: "🦌", word: "deer", category: "forest", difficulty: 1 },
    { emoji: "🐻", word: "bear", category: "forest", difficulty: 1 },
    { emoji: "🌿", word: "vine", category: "forest", difficulty: 1 },
    { emoji: "🌲", word: "pine", category: "forest", difficulty: 1 },
    { emoji: "🌸", word: "blossom", category: "forest", difficulty: 1 },
    { emoji: "🌊", word: "wave", category: "forest", difficulty: 1 },
    { emoji: "🪨", word: "stone", category: "forest", difficulty: 1 },
    { emoji: "🍃", word: "leaf", category: "forest", difficulty: 1 },
    { emoji: "🐍", word: "snake", category: "forest", difficulty: 2 },
    { emoji: "🦎", word: "lizard", category: "forest", difficulty: 2 },
    { emoji: "🐗", word: "boar", category: "forest", difficulty: 2 },
    { emoji: "🦇", word: "bat", category: "forest", difficulty: 2 },
    { emoji: "🕷", word: "spider", category: "forest", difficulty: 2 },
    { emoji: "🦜", word: "parrot", category: "forest", difficulty: 2 },
    { emoji: "🐿", word: "squirrel", category: "forest", difficulty: 2 },
    { emoji: "🌵", word: "cactus", category: "forest", difficulty: 3 },
    { emoji: "🍂", word: "autumn", category: "forest", difficulty: 3 },
    { emoji: "🌾", word: "wheat", category: "forest", difficulty: 3 },
    { emoji: "🪵", word: "timber", category: "forest", difficulty: 3 },
  ],
  workshop: [
    { emoji: "🧭", word: "compass", category: "workshop", difficulty: 1 },
    { emoji: "🔨", word: "hammer", category: "workshop", difficulty: 1 },
    { emoji: "🔑", word: "key", category: "workshop", difficulty: 1 },
    { emoji: "⚓", word: "anchor", category: "workshop", difficulty: 1 },
    { emoji: "⚙️", word: "gear", category: "workshop", difficulty: 1 },
    { emoji: "⏳", word: "hourglass", category: "workshop", difficulty: 1 },
    { emoji: "🕯️", word: "candle", category: "workshop", difficulty: 1 },
    { emoji: "📜", word: "scroll", category: "workshop", difficulty: 1 },
    { emoji: "🗝️", word: "lock", category: "workshop", difficulty: 1 },
    { emoji: "🎯", word: "target", category: "workshop", difficulty: 1 },
    { emoji: "🪜", word: "ladder", category: "workshop", difficulty: 1 },
    { emoji: "🔍", word: "lens", category: "workshop", difficulty: 1 },
    { emoji: "🪓", word: "axe", category: "workshop", difficulty: 2 },
    { emoji: "🔗", word: "chain", category: "workshop", difficulty: 2 },
    { emoji: "🛡", word: "shield", category: "workshop", difficulty: 2 },
    { emoji: "🧲", word: "magnet", category: "workshop", difficulty: 2 },
    { emoji: "⚖️", word: "scale", category: "workshop", difficulty: 2 },
    { emoji: "🪚", word: "saw", category: "workshop", difficulty: 3 },
    { emoji: "🔧", word: "wrench", category: "workshop", difficulty: 3 },
    { emoji: "🧵", word: "thread", category: "workshop", difficulty: 3 },
  ],
  scholar: [
    { emoji: "📐", word: "theory", category: "scholar", difficulty: 1 },
    { emoji: "🔮", word: "prism", category: "scholar", difficulty: 1 },
    { emoji: "⚛️", word: "atom", category: "scholar", difficulty: 1 },
    { emoji: "📊", word: "graph", category: "scholar", difficulty: 1 },
    { emoji: "📏", word: "formula", category: "scholar", difficulty: 1 },
    { emoji: "📖", word: "volume", category: "scholar", difficulty: 1 },
    { emoji: "🗺️", word: "atlas", category: "scholar", difficulty: 1 },
    { emoji: "🧪", word: "potion", category: "scholar", difficulty: 1 },
    { emoji: "💡", word: "concept", category: "scholar", difficulty: 1 },
    { emoji: "🧮", word: "abacus", category: "scholar", difficulty: 2 },
    { emoji: "🔬", word: "microscope", category: "scholar", difficulty: 2 },
    { emoji: "🌡️", word: "thermometer", category: "scholar", difficulty: 2 },
    { emoji: "🧬", word: "dna", category: "scholar", difficulty: 2 },
    { emoji: "🔭", word: "telescope", category: "scholar", difficulty: 2 },
    { emoji: "📡", word: "antenna", category: "scholar", difficulty: 2 },
    { emoji: "🧫", word: "culture", category: "scholar", difficulty: 3 },
    { emoji: "⚗️", word: "flask", category: "scholar", difficulty: 3 },
    { emoji: "🕳", word: "void", category: "scholar", difficulty: 3 },
    { emoji: "🌌", word: "galaxy", category: "scholar", difficulty: 3 },
    { emoji: "🪐", word: "orbit", category: "scholar", difficulty: 3 },
  ],
  ocean: [
    { emoji: "🐋", word: "whale", category: "ocean", difficulty: 1 },
    { emoji: "🦀", word: "crab", category: "ocean", difficulty: 1 },
    { emoji: "🐙", word: "octopus", category: "ocean", difficulty: 1 },
    { emoji: "🦈", word: "shark", category: "ocean", difficulty: 1 },
    { emoji: "🐚", word: "shell", category: "ocean", difficulty: 1 },
    { emoji: "🪸", word: "coral", category: "ocean", difficulty: 1 },
    { emoji: "🐠", word: "fish", category: "ocean", difficulty: 1 },
    { emoji: "🦞", word: "lobster", category: "ocean", difficulty: 1 },
    { emoji: "🐡", word: "puffer", category: "ocean", difficulty: 1 },
    { emoji: "🐳", word: "splash", category: "ocean", difficulty: 1 },
    { emoji: "🧜", word: "mermaid", category: "ocean", difficulty: 2 },
    { emoji: "🦭", word: "seal", category: "ocean", difficulty: 2 },
    { emoji: "🐊", word: "crocodile", category: "ocean", difficulty: 2 },
    { emoji: "🦑", word: "squid", category: "ocean", difficulty: 2 },
    { emoji: "🐬", word: "dolphin", category: "ocean", difficulty: 2 },
    { emoji: "🪼", word: "jellyfish", category: "ocean", difficulty: 3 },
    { emoji: "🌪", word: "tornado", category: "ocean", difficulty: 3 },
    { emoji: "🧊", word: "iceberg", category: "ocean", difficulty: 3 },
  ],
  cosmos: [
    { emoji: "☀️", word: "sun", category: "cosmos", difficulty: 1 },
    { emoji: "🌙", word: "moon", category: "cosmos", difficulty: 1 },
    { emoji: "⭐", word: "star", category: "cosmos", difficulty: 1 },
    { emoji: "🌍", word: "earth", category: "cosmos", difficulty: 1 },
    { emoji: "🪐", word: "saturn", category: "cosmos", difficulty: 1 },
    { emoji: "☄️", word: "comet", category: "cosmos", difficulty: 1 },
    { emoji: "🌑", word: "eclipse", category: "cosmos", difficulty: 1 },
    { emoji: "💫", word: "comet", category: "cosmos", difficulty: 1 },
    { emoji: "🌠", word: "meteor", category: "cosmos", difficulty: 2 },
    { emoji: "🚀", word: "rocket", category: "cosmos", difficulty: 2 },
    { emoji: "🛸", word: "ufo", category: "cosmos", difficulty: 2 },
    { emoji: "🛰", word: "satellite", category: "cosmos", difficulty: 2 },
    { emoji: "🌌", word: "nebula", category: "cosmos", difficulty: 2 },
    { emoji: "🕳", word: "blackhole", category: "cosmos", difficulty: 2 },
    { emoji: "☀️", word: "solar", category: "cosmos", difficulty: 2 },
    { emoji: "🌓", word: "crescent", category: "cosmos", difficulty: 3 },
    { emoji: "🪐", word: "gravity", category: "cosmos", difficulty: 3 },
    { emoji: "💥", word: "supernova", category: "cosmos", difficulty: 3 },
  ],
};

export const CATEGORY_NAMES: Record<string, string> = {
  kitchen: "Tavern Kitchen",
  forest: "Forest Trail",
  workshop: "Workshop",
  scholar: "Scholar's Study",
  ocean: "Ocean Depths",
  cosmos: "Cosmos",
};

export interface Theme {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  category: string;
  unlockLevel: number;
  color: string;
}

export const THEMES: Theme[] = [
  { id: "kitchen",  name: "Tavern Kitchen",   emoji: "🍎", desc: "Food, drinks & cooking",       category: "kitchen",  unlockLevel: 1,  color: "from-amber-500 to-orange-600" },
  { id: "forest",   name: "Forest Trail",      emoji: "🌿", desc: "Animals, plants & wilderness",  category: "forest",   unlockLevel: 1,  color: "from-emerald-500 to-green-600" },
  { id: "workshop", name: "Workshop",          emoji: "⚙️", desc: "Tools, gears & crafting",      category: "workshop", unlockLevel: 3,  color: "from-gray-500 to-slate-600" },
  { id: "scholar",  name: "Scholar's Study",   emoji: "📚", desc: "Science, math & discovery",     category: "scholar",  unlockLevel: 5,  color: "from-violet-500 to-purple-600" },
  { id: "ocean",    name: "Ocean Depths",      emoji: "🌊", desc: "Sea creatures & marine life",   category: "ocean",    unlockLevel: 7,  color: "from-cyan-500 to-blue-600" },
  { id: "cosmos",   name: "Cosmos",            emoji: "🚀", desc: "Stars, planets & galaxies",     category: "cosmos",   unlockLevel: 10, color: "from-indigo-500 to-pink-600" },
];

export interface DifficultyParams {
  tier: string;
  pairCount: number;
  timeLimit: number;
  minDifficulty: number;
  maxDifficulty: number;
  rewardMultiplier: number;
}

export function getDifficultyForLevel(level: number): DifficultyParams {
  if (level >= 15) return { tier: "Master", pairCount: 10, timeLimit: 40, minDifficulty: 1, maxDifficulty: 3, rewardMultiplier: 2.5 };
  if (level >= 10) return { tier: "Adept", pairCount: 8, timeLimit: 45, minDifficulty: 1, maxDifficulty: 3, rewardMultiplier: 2.0 };
  if (level >= 5)  return { tier: "Journeyman", pairCount: 6, timeLimit: 50, minDifficulty: 1, maxDifficulty: 2, rewardMultiplier: 1.5 };
  return { tier: "Apprentice", pairCount: 4, timeLimit: 60, minDifficulty: 1, maxDifficulty: 1, rewardMultiplier: 1.0 };
}

export function getThemesForLevel(level: number): Theme[] {
  return THEMES.filter((t) => t.unlockLevel <= level);
}

export function getThemeById(id: string): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}

export function selectWords(category: string, pairCount: number, maxDifficulty: number): VocabPair[] {
  const pool = (VOCAB_SETS[category] || VOCAB_SETS.kitchen)
    .filter((w) => w.difficulty <= maxDifficulty);

  if (pool.length < pairCount) {
    const backup = (VOCAB_SETS[category] || VOCAB_SETS.kitchen);
    const shuffled = [...backup].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(pairCount, backup.length));
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, pairCount);
}

export function getPairsForGame(category: string, pairCount: number): VocabPair[] {
  return selectWords(category, pairCount, 3);
}
