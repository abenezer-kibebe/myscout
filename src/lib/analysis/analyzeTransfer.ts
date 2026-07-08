// src/lib/analysis/analyzeTransfer.ts
// Engine. Runs every registered factor module, combines the weighted football
// factors into suitability, aggregates confidence, and attaches the value badge.
// Weights and per-factor logic now live in the modules (src/lib/analysis/factors).
import type {
  MergedPlayer,
  MergedClub,
  ValueBenchmark,
  LeagueBaselines,
  AnalysisResult,
  FactorContext,
  FactorOutput,
  FactorKey,
  Confidence,
} from "@/lib/types";
import { FACTORS, computeFinancialValue } from "./factors";
import { styleProfile } from "@/lib/pl/quality";
import { clamp, num } from "./utils";

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
  benchmark: ValueBenchmark,
  leagueBaselines: LeagueBaselines
): AnalysisResult {
  const ctx: FactorContext = { player, club, squad, benchmark, leagueBaselines };

  const raw: FactorOutput[] = FACTORS.map((m) => ({
    key: m.key,
    label: m.label,
    weight: m.weight,
    ...m.compute(ctx),
  }));

  // Renormalize weights over APPLICABLE factors so an inapplicable factor
  // (e.g. Tactical Fit outside the PL) doesn't silently deflate the score.
  const applicableWeight = raw.reduce((s, o) => s + (o.applicable === false ? 0 : o.weight), 0) || 1;
  const outputs: FactorOutput[] = raw.map((o) => ({
    ...o,
    weight: o.applicable === false ? 0 : o.weight / applicableWeight,
    score: Math.round(o.score),
  }));
  const byKey = Object.fromEntries(outputs.map((o) => [o.key, o])) as Record<FactorKey, FactorOutput>;

  const suitability = Math.round(clamp(outputs.reduce((sum, o) => sum + o.score * o.weight, 0)));

  let confAcc = 0;
  let confW = 0;
  for (const o of outputs) {
    if (o.weight > 0) {
      confAcc += CONF_VALUE[o.confidence] * o.weight;
      confW += o.weight;
    }
  }
  let confidence = labelConfidence(confW > 0 ? confAcc / confW : 0.25);
  if (player.matchConfidence === "none" || player.matchConfidence === "low") confidence = "low";

  const confidenceNote =
    player.fc === null
      ? "This player could not be matched to FC 26 ability data; rating is estimated and quality factors run at low confidence."
      : confidence === "high"
      ? "Strong data coverage across factors."
      : "Some factors rely on partial data; treat the score as indicative.";

  const financialValue = computeFinancialValue(ctx);

  return {
    suitability,
    potential: suitability, // action recomputes with feasibility
    profile: styleProfile(player, leagueBaselines),
    confidence,
    confidenceNote,
    breakdown: {
      squadUpgrade: byKey.squadUpgrade,
      teamNeed: byKey.teamNeed,
      attributeFit: byKey.attributeFit,
      developmentValue: byKey.developmentValue,
      ageProfile: byKey.ageProfile,
      overallQuality: byKey.overallQuality,
      tactical: byKey.tactical,
    },
    financialValue,
    feasibility: null,
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
