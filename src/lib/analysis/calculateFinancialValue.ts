// src/lib/analysis/calculateFinancialValue.ts
// SEPARATE badge, NOT part of suitability. Value efficiency vs the median market
// value of Top-5 players at the same rating. Uses FC overall when matched, else
// the estimated rating. No wages, no budgets.
import type { MergedPlayer, FinancialBadge, ValueBenchmark } from "@/lib/types";
import { clamp, num, eurM } from "./utils";

function benchmarkFor(overall: number, benchmark: ValueBenchmark): number | null {
  const exact = benchmark[String(overall)];
  if (exact) return exact;
  for (let d = 1; d <= 5; d++) {
    const up = benchmark[String(overall + d)];
    const down = benchmark[String(overall - d)];
    if (up && down) return (up + down) / 2;
    if (up) return up;
    if (down) return down;
  }
  return null;
}

export function calculateFinancialValue(
  player: MergedPlayer,
  benchmark: ValueBenchmark
): FinancialBadge {
  const value = num(player.marketValue);
  const rating = player.fc?.overall ?? player.displayRating;

  if (!value || rating === null || rating === undefined || !Number.isFinite(rating)) {
    return {
      score: 50,
      label: "Unknown",
      confidence: "low",
      explanation: "Not enough data (market value or rating) to assess value.",
    };
  }

  const expected = benchmarkFor(Math.round(rating), benchmark);
  if (!expected) {
    return {
      score: 50,
      label: "Unknown",
      confidence: "low",
      explanation: `No benchmark for rating ${Math.round(rating)}; cannot compare value.`,
    };
  }

  const ratio = value / expected;
  let score: number;
  let labelText: string;
  if (ratio <= 0.6) {
    score = 92;
    labelText = "Great value";
  } else if (ratio <= 0.9) {
    score = 80;
    labelText = "Good value";
  } else if (ratio <= 1.2) {
    score = 66;
    labelText = "Fair";
  } else if (ratio <= 1.8) {
    score = 48;
    labelText = "Pricey";
  } else {
    score = 32;
    labelText = "Expensive";
  }

  return {
    score: clamp(score),
    label: labelText,
    confidence: player.fc && player.matchConfidence === "high" ? "high" : "medium",
    explanation:
      `${eurM(value)} vs ${eurM(expected)} typical for a rating-${Math.round(rating)} Top-5 player ` +
      `(${ratio.toFixed(2)}x). Does not affect the suitability score.`,
  };
}
