// src/lib/analysis/factors/overallQuality.ts
import type { FactorModule, FactorContext, FactorComputation } from "@/lib/types";
import { clamp } from "../utils";

function compute(ctx: FactorContext): FactorComputation {
  const { player } = ctx;
  const rating = player.fc?.overall ?? player.displayRating;
  if (rating === null || rating === undefined || !Number.isFinite(rating)) {
    return {
      score: 50,
      confidence: "low",
      explanation: "No rating available; neutral score.",
      evidence: { reason: "no-rating" },
    };
  }

  const score = clamp(((rating - 40) / (94 - 40)) * 100);
  const tier =
    rating >= 87 ? "elite" : rating >= 82 ? "very good" : rating >= 76 ? "solid top-flight" : "squad-level";
  const est = player.fc ? "" : " (estimated from market value)";

  return {
    score,
    confidence: player.fc && player.matchConfidence === "high" ? "high" : player.fc ? "medium" : "low",
    explanation: `Rating ${Math.round(rating)}${est} — ${tier} quality.`,
    evidence: { rating: Math.round(rating), estimated: !player.fc, tier },
  };
}

export const overallQuality: FactorModule = {
  key: "overallQuality",
  label: "Overall Quality",
  weight: 0.12,
  compute,
};
