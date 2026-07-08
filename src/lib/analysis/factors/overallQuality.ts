// src/lib/analysis/factors/overallQuality.ts
import type { FactorModule, FactorContext, FactorComputation } from "@/lib/types";
import { clamp } from "../utils";
import { realQualityScore, minutesConfidence } from "@/lib/pl/quality";

function compute(ctx: FactorContext): FactorComputation {
  const { player } = ctx;

  // Premier League: measure current quality on REAL match performance, not FC.
  const real = realQualityScore(player, ctx.leagueBaselines);
  if (real !== null) {
    const mins = player.advanced!.minutes;
    const rating = player.advanced!.rating!;
    const tier = real >= 80 ? "elite" : real >= 62 ? "very good" : real >= 42 ? "solid top-flight" : "squad-level";
    return {
      score: real,
      confidence: minutesConfidence(mins),
      explanation:
        `Real Premier League form: average match rating ${rating.toFixed(2)} — ${tier} for the role ` +
        `(${Math.round(real)}/100)${mins < 600 ? ", small sample" : ""}.`,
      evidence: { source: "sofascore", rating: +rating.toFixed(2), minutes: mins, roleQuality: Math.round(real) },
    };
  }

  // Fallback (non-PL / no real data): FC overall or estimated rating.
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
  weight: 0.1,
  compute,
};
