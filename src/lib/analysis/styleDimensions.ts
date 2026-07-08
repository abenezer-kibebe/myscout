// src/lib/analysis/styleDimensions.ts
// Style dimensions with a THREE-TIER source resolver, richest first:
//   sofa  = real Sofascore advanced data (Premier League only)
//   fbref = basic FBref output (all Top-5)
//   fc    = FC-26 attribute proxy (labelled, lowest confidence)
// Each dimension can be read at a specific tier; comparisons must use a tier
// both sides share (see squadNeeds / teamNeed), so scales stay consistent.
import type { MergedPlayer, DimTier } from "@/lib/types";
import { average } from "./utils";

export type StyleKey =
  | "goalThreat" | "chanceCreation" | "defensiveActions"
  | "ballProgression" | "playmaking" | "aerial" | "pace";

export const STYLE_KEYS: StyleKey[] = [
  "goalThreat", "chanceCreation", "defensiveActions",
  "ballProgression", "playmaking", "aerial", "pace",
];

export const STYLE_LABELS: Record<StyleKey, string> = {
  goalThreat: "Goal threat",
  chanceCreation: "Chance creation",
  defensiveActions: "Defensive actions",
  ballProgression: "Ball progression",
  playmaking: "Playmaking",
  aerial: "Aerial",
  pace: "Pace",
};

export const TIER_ORDER: DimTier[] = ["sofa", "fbref", "fc"];

function fcAvg(attrs: Record<string, number> | undefined, keys: string[]): number | null {
  if (!attrs) return null;
  const vals = keys.map((k) => attrs[k]).filter((v): v is number => v !== undefined && Number.isFinite(v));
  return vals.length ? average(vals) : null;
}

function sofaValue(p: MergedPlayer, key: StyleKey): number | null {
  const a = p.advanced;
  if (!a) return null;
  switch (key) {
    case "goalThreat": return a.xG90 + 0.25 * a.shotsOnTarget90;
    case "chanceCreation": return a.xA90 + 0.5 * a.keyPasses90 + a.bigChancesCreated90;
    case "defensiveActions": return a.tackles90 + a.interceptions90 + 0.5 * a.ballRecovery90;
    case "ballProgression": return a.dribbles90 + 0.05 * a.finalThirdPasses90 + 0.1 * a.possWonAttThird90;
    case "playmaking": return a.keyPasses90 + 0.05 * a.finalThirdPasses90 + 0.02 * (a.passAccuracy ?? 0);
    case "aerial": return a.aerialWon90;
    case "pace": return null; // Sofascore has no pace metric
  }
}

function fbrefValue(p: MergedPlayer, key: StyleKey): number | null {
  const q = p.performance?.per90 ?? null;
  if (!q) return null;
  switch (key) {
    case "goalThreat": return q.nonPenGoals + 0.25 * q.shotsOnTarget;
    case "chanceCreation": return q.assists + 0.25 * q.crosses;
    case "defensiveActions": return q.interceptions + q.tacklesWon;
    default: return null; // FBref-basic lacks progression/playmaking/aerial/pace
  }
}

function fcValue(p: MergedPlayer, key: StyleKey): number | null {
  const a = p.fc?.attributes;
  if (!a) return null;
  switch (key) {
    case "ballProgression": return fcAvg(a, ["dribbling", "ball_control"]);
    case "playmaking": return fcAvg(a, ["short_passing", "vision", "long_passing"]);
    case "aerial": return a.heading_accuracy !== undefined ? a.heading_accuracy : null;
    case "pace": return a.pace !== undefined ? a.pace : null;
    default: return null; // goal threat / creation / defence not proxied by FC here
  }
}

export function styleValueAtTier(p: MergedPlayer, key: StyleKey, tier: DimTier): number | null {
  if (tier === "sofa") return sofaValue(p, key);
  if (tier === "fbref") return fbrefValue(p, key);
  return fcValue(p, key);
}

// The richest tier this player actually has data for, on this dimension.
export function bestTier(p: MergedPlayer, key: StyleKey): DimTier | null {
  for (const t of TIER_ORDER) {
    if (styleValueAtTier(p, key, t) !== null) return t;
  }
  return null;
}
