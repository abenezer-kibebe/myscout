// src/lib/analysis/calculateDevelopmentValue.ts
// The player's OWN trajectory: is he still improving, near peak, or declining?
// Combines FC potential headroom, age, and market-value trend. This is about
// upside/resale — deliberately separate from Age Profile (squad balance).
import type { MergedPlayer, FactorResult } from "@/lib/types";
import { clamp, num } from "./utils";

export function calculateDevelopmentValue(player: MergedPlayer): FactorResult {
  const age = player.age;
  const fc = player.fc;
  const value = num(player.marketValue);
  const peak = num(player.highestMarketValue);

  // Market-value trajectory (available even without FC).
  let trajAdj = 0;
  let trajNote = "";
  if (peak > 0 && value > 0) {
    const r = value / peak;
    if (r >= 0.98) {
      trajAdj = 6;
      trajNote = "market value at/near career high";
    } else if (r >= 0.75) {
      trajAdj = 0;
      trajNote = "market value below peak";
    } else {
      trajAdj = -8;
      trajNote = "market value well below peak (possible decline)";
    }
  }

  // Age component (independent of FC).
  let ageAdj = 0;
  if (age !== null) {
    if (age <= 20) ageAdj = 18;
    else if (age <= 23) ageAdj = 12;
    else if (age <= 26) ageAdj = 4;
    else if (age <= 29) ageAdj = -4;
    else if (age <= 32) ageAdj = -12;
    else ageAdj = -20;
  }

  // Potential headroom (needs FC).
  let headroom: number | null = null;
  let headroomAdj = 0;
  if (fc && Number.isFinite(fc.potential) && Number.isFinite(fc.overall)) {
    headroom = Math.max(0, fc.potential - fc.overall);
    headroomAdj = Math.min(headroom, 20) * 1.4;
  }

  const score = clamp(58 + ageAdj + headroomAdj + trajAdj);

  const confidence: FactorResult["confidence"] =
    fc && player.matchConfidence !== "low" && player.matchConfidence !== "none"
      ? "high"
      : "low";

  const parts: string[] = [];
  if (age !== null) parts.push(`age ${age}`);
  if (headroom !== null && fc) parts.push(`potential ${fc.potential} vs current ${fc.overall} (+${headroom} headroom)`);
  if (trajNote) parts.push(trajNote);

  return {
    score,
    confidence,
    explanation:
      (parts.length ? parts.join("; ") : "limited data") +
      ". Younger players with headroom and rising value score higher.",
  };
}
