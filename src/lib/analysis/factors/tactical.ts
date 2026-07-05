// src/lib/analysis/factors/tactical.ts
import type { FactorModule, FactorContext, FactorComputation } from "@/lib/types";

function compute(_ctx: FactorContext): FactorComputation {
  return {
    score: 0,
    confidence: "low",
    explanation:
      "Not yet configured. Tactical/Club-DNA style modelling will be added later; currently zero weight.",
    evidence: { configured: false },
  };
}

export const tactical: FactorModule = {
  key: "tactical",
  label: "Tactical Fit",
  weight: 0.0,
  compute,
};
