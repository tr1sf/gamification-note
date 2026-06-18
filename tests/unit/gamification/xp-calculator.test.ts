import { describe, it, expect } from "vitest";
import { calculateXP } from "../../../src/lib/gamification/calculators/xp-calculator";

describe("XP Calculator", () => {
  it("awards 10 XP for first note of the day", () => {
    const xp = calculateXP("create_note", { wordCount: 50, structureScore: 5 }, 1);
    expect(xp).toBe(10);
  });

  it("awards diminishing XP for 7th note", () => {
    const xp = calculateXP("create_note", { wordCount: 50, structureScore: 5 }, 7);
    expect(xp).toBe(5);
  });

  it("awards 1 XP for 20th note", () => {
    const xp = calculateXP("create_note", { wordCount: 50, structureScore: 5 }, 20);
    expect(xp).toBe(1);
  });

  it("awards 0 XP for low quality notes (structureScore < 3)", () => {
    const xp = calculateXP("create_note", { wordCount: 10, structureScore: 2 }, 1);
    expect(xp).toBe(0);
  });

  it("awards bonus XP for high quality notes (structureScore >= 7)", () => {
    const xp = calculateXP("create_note", { wordCount: 50, structureScore: 7 }, 1);
    expect(xp).toBe(15);
  });

  it("awards 0 XP for spam notes", () => {
    const xp = calculateXP("create_note", { wordCount: 50, structureScore: 5, isSpam: true }, 1);
    expect(xp).toBe(0);
  });

  it("awards XP for making note public", () => {
    const xp = calculateXP("make_public", {});
    expect(xp).toBeGreaterThan(0);
  });

  it("awards streak-based XP for daily login", () => {
    const xp3 = calculateXP("daily_login", { streak: 3 }, 0);
    const xp10 = calculateXP("daily_login", { streak: 10 }, 0);
    expect(xp10).toBeGreaterThan(xp3);
  });
});
