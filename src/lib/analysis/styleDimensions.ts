// src/lib/analysis/styleDimensions.ts
// Descriptive style dimensions for a player. Each dimension declares its SOURCE:
// "fbref" = real 2025-26 output data; "fc" = FC-26 attribute proxy (labelled,
// lower confidence). Values are raw and unnormalized — the league baselines
// (built offline) convert them to z-scores/percentiles at comparison time.
import type { MergedPlayer } from "@/lib/types";
import { average } from "./utils";

export type StyleKey =
  | "goalThreat"
  | "chanceCreation"
  | "defensiveActions"
  | "ballProgression"
  | "playmaking"
  | "aerial"
  | "pace";

export const STYLE_KEYS: StyleKey[] = [
  "goalThreat",
  "chanceCreation",
  "defensiveActions",
  "ballProgression",
  "playmaking",
  "aerial",
  "pace",
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

export const STYLE_SOURCE: Record<StyleKey, "fbref" | "fc"> = {
  goalThreat: "fbref",
  chanceCreation: "fbref",
  defensiveActions: "fbref",
  ballProgression: "fc",
  playmaking: "fc",
  aerial: "fc",
  pace: "fc",
};

function fcAvg(attrs: Record<string, number> | undefined, keys: string[]): number | null {
  if (!attrs) return null;
  const vals = keys.map((k) => attrs[k]).filter((v): v is number => v !== undefined && Number.isFinite(v));
  return vals.length ? average(vals) : null;
}

// Raw value for a dimension, or null if the source data isn't available.
export function styleValue(p: MergedPlayer, key: StyleKey): number | null {
  const q = p.performance?.per90 ?? null; // FBref per-90 (null under 450 min)
  const a = p.fc?.attributes;
  switch (key) {
    case "goalThreat":
      return q ? q.nonPenGoals + 0.25 * q.shotsOnTarget : null;
    case "chanceCreation":
      return q ? q.assists + 0.25 * q.crosses : null;
    case "defensiveActions":
      return q ? q.interceptions + q.tacklesWon : null;
    case "ballProgression":
      return fcAvg(a, ["dribbling", "ball_control"]);
    case "playmaking":
      return fcAvg(a, ["short_passing", "vision", "long_passing"]);
    case "aerial":
      return a && a.heading_accuracy !== undefined ? a.heading_accuracy : null;
    case "pace":
      return a && a.pace !== undefined ? a.pace : null;
  }
}
