export interface VocabPair {
  emoji: string;
  word: string;
  category: string;
}

export const VOCAB_SETS: Record<string, VocabPair[]> = {
  kitchen: [
    { emoji: "🍎", word: "apple", category: "kitchen" },
    { emoji: "🍞", word: "bread", category: "kitchen" },
    { emoji: "🍯", word: "honey", category: "kitchen" },
    { emoji: "🥛", word: "milk", category: "kitchen" },
    { emoji: "🧀", word: "cheese", category: "kitchen" },
    { emoji: "🍇", word: "grape", category: "kitchen" },
    { emoji: "🥚", word: "egg", category: "kitchen" },
    { emoji: "🧂", word: "salt", category: "kitchen" },
    { emoji: "🍖", word: "meat", category: "kitchen" },
    { emoji: "🐟", word: "fish", category: "kitchen" },
    { emoji: "🧅", word: "onion", category: "kitchen" },
    { emoji: "🥕", word: "carrot", category: "kitchen" },
  ],
  forest: [
    { emoji: "🦅", word: "eagle", category: "forest" },
    { emoji: "🦉", word: "owl", category: "forest" },
    { emoji: "🦊", word: "fox", category: "forest" },
    { emoji: "🍄", word: "mushroom", category: "forest" },
    { emoji: "🌿", word: "vine", category: "forest" },
    { emoji: "🐺", word: "wolf", category: "forest" },
    { emoji: "🦌", word: "deer", category: "forest" },
    { emoji: "🐻", word: "bear", category: "forest" },
    { emoji: "🌲", word: "pine", category: "forest" },
    { emoji: "🪨", word: "stone", category: "forest" },
    { emoji: "🌸", word: "blossom", category: "forest" },
    { emoji: "🌊", word: "wave", category: "forest" },
  ],
  workshop: [
    { emoji: "🧭", word: "compass", category: "workshop" },
    { emoji: "🔨", word: "hammer", category: "workshop" },
    { emoji: "🔍", word: "lens", category: "workshop" },
    { emoji: "⚓", word: "anchor", category: "workshop" },
    { emoji: "⚙️", word: "gear", category: "workshop" },
    { emoji: "🔑", word: "key", category: "workshop" },
    { emoji: "⏳", word: "hourglass", category: "workshop" },
    { emoji: "🕯️", word: "candle", category: "workshop" },
    { emoji: "📜", word: "scroll", category: "workshop" },
    { emoji: "🗝️", word: "lock", category: "workshop" },
    { emoji: "🪜", word: "ladder", category: "workshop" },
    { emoji: "🎯", word: "target", category: "workshop" },
  ],
  scholar: [
    { emoji: "📐", word: "theory", category: "scholar" },
    { emoji: "🔮", word: "prism", category: "scholar" },
    { emoji: "⚛️", word: "atom", category: "scholar" },
    { emoji: "📊", word: "graph", category: "scholar" },
    { emoji: "📏", word: "formula", category: "scholar" },
    { emoji: "🔬", word: "microscope", category: "scholar" },
    { emoji: "🌡️", word: "thermometer", category: "scholar" },
    { emoji: "🧲", word: "magnet", category: "scholar" },
    { emoji: "💡", word: "concept", category: "scholar" },
    { emoji: "📖", word: "volume", category: "scholar" },
    { emoji: "🗺️", word: "atlas", category: "scholar" },
    { emoji: "🧪", word: "potion", category: "scholar" },
  ],
};

export const CATEGORY_NAMES: Record<string, string> = {
  kitchen: "Tavern Kitchen",
  forest: "Forest Trail",
  workshop: "Workshop",
  scholar: "Scholar's Study",
};

export function getPairsForGame(category: string, pairCount: number): VocabPair[] {
  const pool = VOCAB_SETS[category] || VOCAB_SETS.kitchen;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, pairCount);
}
