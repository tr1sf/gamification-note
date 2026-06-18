// Applies a theme by setting CSS custom properties on :root.
// Variable names MUST match those defined in src/app.css @theme block.
export function applyThemeVariables(variables: Record<string, string>): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(variables)) {
    root.style.setProperty(key, `rgb(${value})`);
  }
  localStorage.setItem("equippedTheme", JSON.stringify(variables));
  localStorage.setItem("equippedThemeActive", "true");
}

// Remove all custom theme inline styles (for light mode)
export function clearThemeVariables(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // Theme variables that could be set
  const themeVars = [
    "--color-surface", "--color-surface-elevated", "--color-surface-border", "--color-surface-hover",
    "--color-ink-primary", "--color-ink-secondary", "--color-accent", "--color-accent-hover",
    "--color-xp", "--color-coin", "--color-error", "--color-success",
  ];
  for (const key of themeVars) {
    root.style.removeProperty(key);
  }
}

// Restore previously equipped theme from localStorage
export function restoreThemeVariables(): void {
  if (typeof document === "undefined") return;
  try {
    const saved = localStorage.getItem("equippedTheme");
    const active = localStorage.getItem("equippedThemeActive");
    const mode = localStorage.getItem("theme"); // "dark" or "light"
    // Only apply custom theme in dark mode
    if (saved && active === "true" && mode !== "light") {
      applyThemeVariables(JSON.parse(saved));
    }
  } catch {}
}

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
    coinCost: 0, rarity: "common", isDefault: true,
    cssVariables: {
      "--color-surface": "26 20 14",
      "--color-surface-elevated": "38 29 19",
      "--color-surface-border": "74 58 38",
      "--color-surface-hover": "52 40 26",
      "--color-ink-primary": "247 246 243",
      "--color-ink-secondary": "202 194 182",
      "--color-accent": "224 174 86",
      "--color-accent-hover": "240 196 116",
      "--color-xp": "126 184 104",
      "--color-coin": "232 184 80",
      "--color-error": "232 132 116",
      "--color-success": "120 188 120",
    },
  },
  {
    name: "Scholar",
    description: "Clean academic theme — bright and focused",
    coinCost: 0, rarity: "common", isDefault: false,
    cssVariables: {
      "--color-surface": "250 248 242",
      "--color-surface-elevated": "255 255 255",
      "--color-surface-border": "220 215 205",
      "--color-surface-hover": "242 240 235",
      "--color-ink-primary": "30 41 59",
      "--color-ink-secondary": "100 116 139",
      "--color-accent": "44 82 130",
      "--color-accent-hover": "56 100 156",
      "--color-xp": "34 197 94",
      "--color-coin": "234 179 8",
      "--color-error": "220 38 38",
      "--color-success": "22 163 74",
    },
  },
  {
    name: "Journey",
    description: "Adventurer's path — wanderlust tones",
    coinCost: 50, rarity: "rare", isDefault: false,
    cssVariables: {
      "--color-surface": "13 27 42",
      "--color-surface-elevated": "27 40 56",
      "--color-surface-border": "52 73 100",
      "--color-surface-hover": "34 48 68",
      "--color-ink-primary": "224 225 221",
      "--color-ink-secondary": "119 141 169",
      "--color-accent": "226 185 111",
      "--color-accent-hover": "240 200 130",
      "--color-xp": "74 222 128",
      "--color-coin": "234 179 8",
      "--color-error": "248 113 113",
      "--color-success": "74 222 128",
    },
  },
  {
    name: "Night Owl",
    description: "Dark minimalist — for late-night focus",
    coinCost: 50, rarity: "rare", isDefault: false,
    cssVariables: {
      "--color-surface": "15 15 35",
      "--color-surface-elevated": "30 30 58",
      "--color-surface-border": "55 55 90",
      "--color-surface-hover": "40 40 72",
      "--color-ink-primary": "226 232 240",
      "--color-ink-secondary": "148 163 184",
      "--color-accent": "124 58 237",
      "--color-accent-hover": "139 92 246",
      "--color-xp": "52 211 153",
      "--color-coin": "250 204 21",
      "--color-error": "248 113 113",
      "--color-success": "52 211 153",
    },
  },
  {
    name: "Forest",
    description: "Nature's tranquility — green sanctuary",
    coinCost: 100, rarity: "epic", isDefault: false,
    cssVariables: {
      "--color-surface": "22 30 22",
      "--color-surface-elevated": "34 44 34",
      "--color-surface-border": "58 75 55",
      "--color-surface-hover": "42 54 42",
      "--color-ink-primary": "226 235 220",
      "--color-ink-secondary": "140 170 145",
      "--color-accent": "74 222 128",
      "--color-accent-hover": "96 240 150",
      "--color-xp": "163 230 53",
      "--color-coin": "234 179 8",
      "--color-error": "248 113 113",
      "--color-success": "74 222 128",
    },
  },
  {
    name: "Ember",
    description: "Fire and warmth — blazing inspiration",
    coinCost: 100, rarity: "epic", isDefault: false,
    cssVariables: {
      "--color-surface": "42 24 14",
      "--color-surface-elevated": "58 38 22",
      "--color-surface-border": "90 58 38",
      "--color-surface-hover": "70 46 28",
      "--color-ink-primary": "245 235 220",
      "--color-ink-secondary": "180 150 120",
      "--color-accent": "249 115 22",
      "--color-accent-hover": "251 146 60",
      "--color-xp": "251 191 36",
      "--color-coin": "250 204 21",
      "--color-error": "248 113 113",
      "--color-success": "251 191 36",
    },
  },
  {
    name: "Royal",
    description: "Regal purple and gold — premium experience",
    coinCost: 200, rarity: "legendary", isDefault: false,
    cssVariables: {
      "--color-surface": "24 10 42",
      "--color-surface-elevated": "38 22 58",
      "--color-surface-border": "68 44 96",
      "--color-surface-hover": "48 30 70",
      "--color-ink-primary": "240 225 255",
      "--color-ink-secondary": "160 140 200",
      "--color-accent": "251 191 36",
      "--color-accent-hover": "253 224 71",
      "--color-xp": "168 85 247",
      "--color-coin": "250 204 21",
      "--color-error": "248 113 113",
      "--color-success": "168 85 247",
    },
  },
];
