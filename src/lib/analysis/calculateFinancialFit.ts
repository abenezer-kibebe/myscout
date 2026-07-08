// src/lib/analysis/calculateFinancialFit.ts
import type { Player, Factor } from "@/lib/types";
import { num, average } from "./utils";

// Heuristic: is the player's value in line with the club's squad?
// Compared to the club's AVERAGE player value (more meaningful than total, and
// robust to clubs.csv's often-empty total_market_value column).
// Near/below average => compatible; far above => a financial stretch.
// NOTE: dataset has NO real wages or transfer budgets — this is value-based only.
export function calculateFinancialFit(
  targetPlayer: Player,
  clubSquad: Player[]
): Factor {
  const playerValue = num(targetPlayer.market_value_in_eur);
  const avgValue = average(
    clubSquad.map((p) => num(p.market_value_in_eur)).filter((v) => v > 0)
  );

  if (playerValue <= 0 || avgValue === null || avgValue <= 0) {
    return {
      score: 50,
      explanation: "Market value data insufficient; using a neutral score.",
    };
  }

  const ratio = playerValue / avgValue; // 1 = exactly squad-average value

  let score: number;
  if (ratio <= 0.75) score = 92;
  else if (ratio <= 1.25) score = 82;
  else if (ratio <= 2) score = 65;
  else if (ratio <= 3.5) score = 45;
  else score = 28;

  return {
    score,
    explanation:
      `Player €${(playerValue / 1e6).toFixed(1)}M vs squad average ` +
      `€${(avgValue / 1e6).toFixed(1)}M (${ratio.toFixed(2)}x). ` +
      `Values near/below the squad norm score higher (heuristic; no wage data).`,
  };
}
