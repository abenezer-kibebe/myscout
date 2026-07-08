// src/lib/analysis/calculateAgeFit.ts
import type { Player, Factor } from "@/lib/types";
import { getAge, average } from "./utils";

// Heuristic: how well does the player's age fit the club's profile?
// Best fit = at or a little below the squad average (adds longevity/upside).
// Notably older than the squad => lower fit.
export function calculateAgeFit(
  targetPlayer: Player,
  clubSquad: Player[]
): Factor {
  const playerAge = getAge(targetPlayer.date_of_birth);
  const clubAvg = average(
    clubSquad
      .map((p) => getAge(p.date_of_birth))
      .filter((a): a is number => a !== null)
  );

  if (playerAge === null || clubAvg === null) {
    return {
      score: 50,
      explanation:
        "Age data unavailable for the player or squad; using a neutral score.",
    };
  }

  const diff = playerAge - clubAvg; // negative = younger than average

  let score: number;
  if (diff <= -3) score = 95;
  else if (diff <= 0) score = 88;
  else if (diff <= 2) score = 72;
  else if (diff <= 4) score = 55;
  else score = 38;

  return {
    score,
    explanation:
      `Player is ${playerAge}; club average is ${clubAvg.toFixed(1)} ` +
      `(${diff >= 0 ? "+" : ""}${diff.toFixed(1)} yrs). ` +
      `Younger-than-average signings score higher (heuristic).`,
  };
}
