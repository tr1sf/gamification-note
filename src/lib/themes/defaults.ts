export interface ThemeDefinition {
  name: string;
  description: string;
  coinCost: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  isDefault: boolean;
  cssVariables: Record<string, string>;
}

export const DEFAULT_THEMES: ThemeDefinition[] = [
  {
    name: "Tavern",
    description: "Classic medieval tavern — warm parchment tones",
    coinCost: 0,
    rarity: "common",
    isDefault: true,
    cssVariables: {
      "--color-bg": "26 26 46",
      "--color-bg-elevated": "45 45 63",
      "--color-bg-overlay": "20 15 5",
      "--color-text-primary": "240 230 211",
      "--color-text-secondary": "160 147 125",
      "--color-accent": "212 165 116",
      "--color-accent-hover": "196 149 95",
      "--color-xp": "251 191 36",
      "--color-coin": "226 185 111",
      "--font-display": "'Cinzel', serif",
      "--font-body": "'Crimson Text', serif",
    },
  },
  {
    name: "Scholar",
    description: "Clean academic theme — bright and focused",
    coinCost: 0,
    rarity: "common",
    isDefault: false,
    cssVariables: {
      "--color-bg": "250 248 242",
      "--color-bg-elevated": "255 255 255",
      "--color-bg-overlay": "15 23 42",
      "--color-text-primary": "30 41 59",
      "--color-text-secondary": "100 116 139",
      "--color-accent": "44 82 130",
      "--color-accent-hover": "37 67 108",
      "--color-xp": "34 197 94",
      "--color-coin": "234 179 8",
      "--font-display": "'Inter', sans-serif",
      "--font-body": "'Inter', sans-serif",
    },
  },
  {
    name: "Journey",
    description: "Adventurer's path — wanderlust tones",
    coinCost: 50,
    rarity: "rare",
    isDefault: false,
    cssVariables: {
      "--color-bg": "13 27 42",
      "--color-bg-elevated": "27 40 56",
      "--color-bg-overlay": "5 10 15",
      "--color-text-primary": "224 225 221",
      "--color-text-secondary": "119 141 169",
      "--color-accent": "226 185 111",
      "--color-accent-hover": "240 200 130",
      "--color-xp": "74 222 128",
      "--color-coin": "234 179 8",
      "--font-display": "'Cinzel', serif",
      "--font-body": "'Crimson Text', serif",
    },
  },
  {
    name: "Night Owl",
    description: "Dark minimalist — for late-night focus",
    coinCost: 50,
    rarity: "rare",
    isDefault: false,
    cssVariables: {
      "--color-bg": "15 15 35",
      "--color-bg-elevated": "30 30 58",
      "--color-bg-overlay": "5 5 15",
      "--color-text-primary": "226 232 240",
      "--color-text-secondary": "148 163 184",
      "--color-accent": "124 58 237",
      "--color-accent-hover": "139 92 246",
      "--color-xp": "52 211 153",
      "--color-coin": "250 204 21",
      "--font-display": "'JetBrains Mono', monospace",
      "--font-body": "'Inter', sans-serif",
    },
  },
  {
    name: "Forest",
    description: "Nature's tranquility — green sanctuary",
    coinCost: 100,
    rarity: "epic",
    isDefault: false,
    cssVariables: {
      "--color-bg": "26 37 24",
      "--color-bg-elevated": "36 51 34",
      "--color-bg-overlay": "10 15 8",
      "--color-text-primary": "226 232 220",
      "--color-text-secondary": "132 169 140",
      "--color-accent": "74 222 128",
      "--color-accent-hover": "96 240 150",
      "--color-xp": "163 230 53",
      "--color-coin": "234 179 8",
      "--font-display": "'Crimson Text', serif",
      "--font-body": "'Inter', sans-serif",
    },
  },
  {
    name: "Ember",
    description: "Fire and warmth — blazing inspiration",
    coinCost: 100,
    rarity: "epic",
    isDefault: false,
    cssVariables: {
      "--color-bg": "45 26 14",
      "--color-bg-elevated": "61 42 24",
      "--color-bg-overlay": "15 8 4",
      "--color-text-primary": "245 235 220",
      "--color-text-secondary": "180 150 120",
      "--color-accent": "249 115 22",
      "--color-accent-hover": "251 146 60",
      "--color-xp": "251 191 36",
      "--color-coin": "250 204 21",
      "--font-display": "'Cinzel', serif",
      "--font-body": "'Crimson Text', serif",
    },
  },
  {
    name: "Royal",
    description: "Regal purple and gold — premium experience",
    coinCost: 200,
    rarity: "legendary",
    isDefault: false,
    cssVariables: {
      "--color-bg": "26 10 46",
      "--color-bg-elevated": "42 26 62",
      "--color-bg-overlay": "10 5 20",
      "--color-text-primary": "240 225 255",
      "--color-text-secondary": "160 140 200",
      "--color-accent": "251 191 36",
      "--color-accent-hover": "253 224 71",
      "--color-xp": "168 85 247",
      "--color-coin": "250 204 21",
      "--font-display": "'Cinzel', serif",
      "--font-body": "'Crimson Text', serif",
    },
  },
];

export function applyThemeVariables(variables: Record<string, string>): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(variables)) {
    root.style.setProperty(key, value);
  }
}

export function clearThemeVariables(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const theme of DEFAULT_THEMES) {
    for (const key of Object.keys(theme.cssVariables)) {
      root.style.removeProperty(key);
    }
  }
}
