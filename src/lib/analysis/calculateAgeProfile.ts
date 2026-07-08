// src/lib/analysis/calculateAgeProfile.ts
// Squad balance — a DIFFERENT question from Development Value. Does the player's
// age suit the club's current age curve in this role? An ageing unit benefits
// from youth; a very young unit can benefit from a peak-age leader. So this is
// NOT a flat "younger is better".
import type { MergedPlayer, FactorResult } from "@/lib/types";
import { average, clamp } from "./utils";

export function calculateAgeProfile(
  player: MergedPlayer,
  squad: MergedPlayer[]
): FactorResult {
  const playerAge = player.age;

  // Prefer the role unit's ages; fall back to whole-squad ages.
  const roleAges = squad
    .filter((p) => p.role === player.role && p.playerId !== player.playerId)
    .map((p) => p.age)
    .filter((a): a is number => a !== null);
  const allAges = squad
    .filter((p) => p.playerId !== player.playerId)
    .map((p) => p.age)
    .filter((a): a is number => a !== null);
  const unitAges = roleAges.length >= 2 ? roleAges : allAges;
  const squadAvg = average(unitAges);

  if (playerAge === null || squadAvg === null) {
    return {
      score: 50,
      confidence: "low",
      explanation: "Age data unavailable for the player or squad; neutral score.",
    };
  }

  let score: number;
  let need: string;
  if (squadAvg >= 29) {
    // Ageing unit: reward youth.
    need = "ageing unit — youth is valuable";
    score = playerAge <= 24 ? 92 : playerAge <= 27 ? 78 : playerAge <= 30 ? 60 : 42;
  } else if (squadAvg <= 24) {
    // Very young unit: reward peak-age experience, mild penalty for adding more youth.
    need = "young unit — some experience adds balance";
    score = playerAge >= 25 && playerAge <= 30 ? 88 : playerAge < 25 ? 66 : playerAge <= 33 ? 62 : 45;
  } else {
    // Balanced unit: reward at/below average, gentle penalty for much older.
    need = "balanced unit";
    const diff = playerAge - squadAvg;
    score = diff <= -2 ? 88 : diff <= 1 ? 80 : diff <= 3 ? 66 : diff <= 5 ? 52 : 40;
  }

  return {
    score: clamp(score),
    confidence: unitAges.length >= 3 ? "high" : "medium",
    explanation:
      `Player is ${playerAge}; the ${
        roleAges.length >= 2 ? "role unit" : "squad"
      } averages ${squadAvg.toFixed(1)} (${need}).`,
  };
}
