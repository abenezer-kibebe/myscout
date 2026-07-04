import type { Player } from "@/lib/loadPlayers";
import type { Club } from "@/lib/loadClubs";

export type TransferAnalysis = {
  suitability: number;
  ageFit: number;
  financialCompatibility: number;
  potential: number;
};

function clamp(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function analyzeTransfer(player: Player, club: Club): TransferAnalysis {
  const playerValue = Number(player.market_value_in_eur || 0);
  const clubValue = Number(club.total_market_value || 0);

  const financialCompatibility =
    clubValue > 0 ? 100 - (playerValue / clubValue) * 100 : 50;

  const ageFit = 75;

  const potential =
    playerValue > 50_000_000 ? 90 :
    playerValue > 20_000_000 ? 80 :
    playerValue > 5_000_000 ? 65 :
    50;

  const suitability =
    0.4 * financialCompatibility +
    0.3 * ageFit +
    0.3 * potential;

  return {
    suitability: clamp(suitability),
    ageFit: clamp(ageFit),
    financialCompatibility: clamp(financialCompatibility),
    potential: clamp(potential),
  };
}