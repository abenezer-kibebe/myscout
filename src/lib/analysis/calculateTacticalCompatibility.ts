// src/lib/analysis/calculateTacticalCompatibility.ts
// Intentionally a stub with weight 0 in analyzeTransfer. The factor EXISTS so
// tactical styles (possession, high press, low block, etc.) can be added later
// without touching the engine's shape. No tactics are hardcoded now.
import type { MergedPlayer, FactorResult } from "@/lib/types";

export function calculateTacticalCompatibility(
  _player: MergedPlayer,
  _squad: MergedPlayer[]
): FactorResult {
  return {
    score: 0,
    confidence: "low",
    explanation:
      "Not yet configured. Tactical style modelling will be added later; this " +
      "factor currently has zero weight and does not affect the score.",
  };
}
