// src/lib/analysis/calculatePotential.ts
import type { Player, Factor } from "@/lib/types";
import { num, getAge } from "./utils";

// Heuristic potential: market-value band, adjusted for age and for how current
// value compares to the player's own historical peak (a cheap trajectory proxy
// available in players.csv). Real trend needs player_valuations.csv — added later.
export function calculatePotential(targetPlayer: Player): Factor {
  const value = num(targetPlayer.market_value_in_eur);
  const peak = num(targetPlayer.highest_market_value_in_eur);
  const age = getAge(targetPlayer.date_of_birth);

  let base: number;
  if (value > 50_000_000) base = 88;
  else if (value > 20_000_000) base = 78;
  else if (value > 5_000_000) base = 64;
  else if (value > 1_000_000) base = 52;
  else base = 42;

  let ageAdj = 0;
  if (age !== null) {
    if (age <= 21) ageAdj = 10;
    else if (age <= 24) ageAdj = 5;
    else if (age <= 28) ageAdj = 0;
    else if (age <= 31) ageAdj = -6;
    else ageAdj = -12;
  }

  let trendAdj = 0;
  let trendNote = "no peak data";
  if (peak > 0 && value > 0) {
    const r = value / peak;
    if (r >= 0.98) {
      trendAdj = 4;
      trendNote = "at/near career-high value";
    } else if (r >= 0.75) {
      trendAdj = 0;
      trendNote = "slightly below peak";
    } else {
      trendAdj = -6;
      trendNote = "well below peak (possible decline)";
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(base + ageAdj + trendAdj)));

  return {
    score,
    explanation:
      `Based on €${(value / 1e6).toFixed(1)}M value` +
      (age !== null ? `, age ${age}` : "") +
      `, ${trendNote} (heuristic; true trend needs valuation history).`,
  };
}
