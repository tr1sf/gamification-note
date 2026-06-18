import { describe, it, expect } from "vitest";
import { calculateLevel, getLevelTitle } from "../../../src/lib/gamification/calculators/level-calculator";

describe("Level Calculator", () => {
  it("starts at level 1 with 0 XP", () => {
    expect(calculateLevel(0)).toBe(1);
  });

  it("stays at level 1 with 100 XP", () => {
    expect(calculateLevel(100)).toBe(1);
  });

  it("reaches level 2 at 400 XP", () => {
    expect(calculateLevel(400)).toBe(2);
  });

  it("reaches level 5 at 2500 XP", () => {
    const level = calculateLevel(2500);
    expect(level).toBeGreaterThanOrEqual(4);
  });

  it("scale formula is consistent", () => {
    const level10xp = calculateLevel(10000);
    const level20xp = calculateLevel(40000);
    expect(level20xp).toBeGreaterThan(level10xp);
  });

  it("returns correct title for level 1", () => {
    expect(getLevelTitle(1)).toBe("Novice Scribe");
  });

  it("returns highest title for very high levels", () => {
    expect(getLevelTitle(200)).toBe("Tavern Sage");
  });
});
