// src/lib/analysis/analyzeTransfer.ts
import type {
  MergedPlayer,
  MergedClub,
  ValueBenchmark,
  AnalysisResult,
  FactorResult,
  Confidence,
} from "@/lib/types";
import { calculateSquadUpgrade } from "./calculateSquadUpgrade";
import { calculateAttributeFit } from "./calculateAttributeFit";
import { calculateDevelopmentValue } from "./calculateDevelopmentValue";
import { calculateAgeProfile } from "./calculateAgeProfile";
import { calculateOverallQuality } from "./calculateOverallQuality";
import { calculateFinancialValue } from "./calculateFinancialValue";
import { calculateTacticalCompatibility } from "./calculateTacticalCompatibility";
import { clamp, num } from "./utils";

const WEIGHTS = {
  squadUpgrade: 0.4,
  attributeFit: 0.22,
  overallQuality: 0.15,
  developmentValue: 0.13,
  ageProfile: 0.1,
  tactical: 0.0,
} as const;

const CONF_VALUE: Record<Confidence, number> = { high: 1, medium: 0.6, low: 0.25 };

function labelConfidence(x: number): Confidence {
  if (x >= 0.8) return "high";
  if (x >= 0.5) return "medium";
  return "low";
}

export function analyzeTransfer(
  player: MergedPlayer,
  club: MergedClub,
  squad: MergedPlayer[],
  benchmark: ValueBenchmark
): AnalysisResult {
  const squadUpgrade = calculateSquadUpgrade(player, squad);
  const attributeFit = calculateAttributeFit(player);
  const developmentValue = calculateDevelopmentValue(player);
  const ageProfile = calculateAgeProfile(player, squad);
  const overallQuality = calculateOverallQuality(player);
  const tactical = calculateTacticalCompatibility(player, squad);
  const financialValue = calculateFinancialValue(player, benchmark);

  const weighted: Array<[FactorResult, number]> = [
    [squadUpgrade, WEIGHTS.squadUpgrade],
    [attributeFit, WEIGHTS.attributeFit],
    [overallQuality, WEIGHTS.overallQuality],
    [developmentValue, WEIGHTS.developmentValue],
    [ageProfile, WEIGHTS.ageProfile],
    [tactical, WEIGHTS.tactical],
  ];

  const suitability = clamp(weighted.reduce((sum, [f, w]) => sum + f.score * w, 0));

  let confAcc = 0;
  let confW = 0;
  for (const [f, w] of weighted) {
    if (w > 0) {
      confAcc += CONF_VALUE[f.confidence] * w;
      confW += w;
    }
  }
  let confidence = labelConfidence(confW > 0 ? confAcc / confW : 0.25);
  if (player.matchConfidence === "none" || player.matchConfidence === "low") {
    confidence = "low";
  }

  const confidenceNote =
    player.fc === null
      ? "This player could not be matched to FC 26 ability data; rating is estimated and quality factors run at low confidence."
      : confidence === "high"
      ? "Strong data coverage across factors."
      : "Some factors rely on partial data; treat the score as indicative.";

  return {
    suitability,
    confidence,
    confidenceNote,
    breakdown: {
      squadUpgrade,
      attributeFit,
      developmentValue,
      ageProfile,
      overallQuality,
      tactical,
    },
    financialValue,
    meta: {
      playerName: player.name,
      role: player.role,
      playerRating: player.displayRating,
      ratingEstimated: player.ratingIsEstimated,
      playerAge: player.age,
      playerValue: num(player.marketValue),
      playerMinutes: player.minutesLastSeason,
      clubName: club.name,
      clubLeagueId: club.leagueId,
      matchConfidence: player.matchConfidence,
    },
  };
}
