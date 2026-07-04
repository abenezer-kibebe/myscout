// src/lib/analysis/calculatePositionNeed.ts
import type { Player, Factor } from "@/lib/types";

// Heuristic: how much does the club need another player in the target's line?
// Fewer players already in that broad position => higher need.
// IMPORTANT: clubSquad is already filtered to the selected club (the old code
// filtered the whole dataset by position and ignored the club entirely).
export function calculatePositionNeed(
  targetPlayer: Player,
  clubSquad: Player[]
): Factor {
  const position = targetPlayer.position || "Unknown";

  const depth = clubSquad.filter(
    (p) => p.position === position && p.player_id !== targetPlayer.player_id
  ).length;

  let score: number;
  if (depth <= 1) score = 95;
  else if (depth === 2) score = 80;
  else if (depth === 3) score = 65;
  else if (depth === 4) score = 50;
  else score = 35;

  return {
    score,
    explanation:
      `Club has ${depth} player(s) in the ${position} line. ` +
      `Fewer players implies greater need (heuristic on squad depth).`,
  };
}
