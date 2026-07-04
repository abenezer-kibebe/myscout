// src/lib/analysis/calculateOverallQuality.ts
// Capped anchor. Uses FC overall when matched; for unmatched players it falls
// back to the estimated rating (so every player still gets a quality read),
// at reduced confidence. Weight in analyzeTransfer keeps it from dominating.
import type { MergedPlayer, FactorResult } from "@/lib/types";
import { clamp } from "./utils";

export function calculateOverallQuality(player: MergedPlayer): FactorResult {
  const rating = player.fc?.overall ?? player.displayRating;
  if (rating === null || rating === undefined || !Number.isFinite(rating)) {
    return {
      score: 50,
      confidence: "low",
      explanation: "No rating available; neutral score.",
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
  };
}
