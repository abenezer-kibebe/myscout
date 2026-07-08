// src/lib/pl/quality.ts
// Real-data quality & fit for Premier League players (Sofascore layer).
// Fit is ROLE-WEIGHTED and STRENGTH-REWARDING: a player is judged on the
// dimensions that define his role, elite strengths are rewarded, and the
// weaknesses his job doesn't require don't drag him down. This is what lets a
// specialist (e.g. a ball-winning DM) score highly without being a creator.
import type { MergedPlayer, LeagueBaselines, Role, Baseline } from "@/lib/types";
import { styleValueAtTier, type StyleKey } from "@/lib/analysis/styleDimensions";

// How much each style dimension DEFINES a role (weights per role, need not sum to 1).
export const ROLE_DIMENSION_WEIGHTS: Record<Role, Partial<Record<StyleKey, number>>> = {
  GK: { defensiveActions: 1 },
  CB: { defensiveActions: 0.45, aerial: 0.35, ballProgression: 0.2 },
  FB: { defensiveActions: 0.3, ballProgression: 0.25, chanceCreation: 0.2, pace: 0.25 },
  DM: { defensiveActions: 0.45, ballProgression: 0.3, playmaking: 0.25 },
  CM: { defensiveActions: 0.25, ballProgression: 0.25, playmaking: 0.25, chanceCreation: 0.25 },
  AM: { chanceCreation: 0.35, playmaking: 0.25, goalThreat: 0.25, ballProgression: 0.15 },
  W: { chanceCreation: 0.3, goalThreat: 0.25, ballProgression: 0.25, pace: 0.2 },
  CF: { goalThreat: 0.45, chanceCreation: 0.3, aerial: 0.25 },
};

// The role's CORE (highest-weighted) dimensions — a player's "signature" skills.
export function coreDims(role: Role): StyleKey[] {
  const w = ROLE_DIMENSION_WEIGHTS[role];
  const max = Math.max(...Object.values(w).map((x) => x ?? 0));
  return (Object.keys(w) as StyleKey[]).filter((k) => (w[k] ?? 0) >= max * 0.85);
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const zOf = (v: number, b: Baseline) => (b.std > 0 ? (v - b.mean) / b.std : 0);

export function hasReal(p: MergedPlayer): boolean {
  return !!p.advanced && p.advanced.rating != null;
}

// Per-dimension z-scores for a player at the sofa tier, keyed by dimension.
function dimZ(p: MergedPlayer, baselines: LeagueBaselines): Partial<Record<StyleKey, number>> {
  const out: Partial<Record<StyleKey, number>> = {};
  const w = ROLE_DIMENSION_WEIGHTS[p.role];
  for (const d of Object.keys(w) as StyleKey[]) {
    const v = styleValueAtTier(p, d, "sofa");
    const b = baselines[`sofa:${p.role}:${d}`];
    if (v != null && b && b.std > 0) out[d] = zOf(v, b);
  }
  return out;
}

// Combined role-fit z: role-weighted (weaknesses damped) blended with the
// player's single best signature strength (added, never subtracted).
export function roleFitZ(p: MergedPlayer, baselines: LeagueBaselines): number | null {
  if (!p.advanced) return null;
  const zs = dimZ(p, baselines);
  const w = ROLE_DIMENSION_WEIGHTS[p.role];
  let wsum = 0;
  let acc = 0;
  for (const d of Object.keys(zs) as StyleKey[]) {
    const z = zs[d]!;
    const contrib = z >= 0 ? z : z * 0.5; // a weakness drags at half strength
    acc += (w[d] ?? 0) * contrib;
    wsum += w[d] ?? 0;
  }
  if (wsum === 0) return null;
  const weightedZ = acc / wsum;
  const core = coreDims(p.role);
  const signature = Math.max(0, ...core.map((d) => zs[d] ?? -99).filter((z) => z > -90));
  return 0.65 * weightedZ + 0.35 * signature;
}

// 0..100 statistical/role fit + ranked strengths.
export function statisticalFit(
  p: MergedPlayer,
  baselines: LeagueBaselines
): { score: number; strengths: { dim: StyleKey; z: number }[] } | null {
  const combined = roleFitZ(p, baselines);
  if (combined === null) return null;
  const zs = dimZ(p, baselines);
  const strengths = (Object.keys(zs) as StyleKey[])
    .map((d) => ({ dim: d, z: zs[d]! }))
    .sort((a, b) => b.z - a.z);
  return { score: Math.max(0, Math.min(100, 100 * clamp01(0.5 + combined * 0.17))), strengths };
}

// Role-relative quality (0..100) for the Squad Upgrade comparison — uses the
// role-weighted fit, so a DM is measured on defensive quality (not a match
// rating that favours attackers).
export function roleQuality(p: MergedPlayer, baselines: LeagueBaselines): number | null {
  const z = roleFitZ(p, baselines);
  if (z === null) return null;
  return Math.max(0, Math.min(100, 100 * clamp01(0.5 + z * 0.17)));
}

// Current quality from the real match rating (role-relative), for Overall Quality.
export function realQualityScore(p: MergedPlayer, baselines: LeagueBaselines): number | null {
  if (!p.advanced || p.advanced.rating == null) return null;
  const b = baselines[`sofa:${p.role}:rating`];
  if (!b || b.std <= 0) return null;
  return Math.max(0, Math.min(100, 100 * clamp01(0.5 + zOf(p.advanced.rating, b) * 0.16)));
}

export function minutesConfidence(minutes: number): "high" | "medium" | "low" {
  return minutes >= 1500 ? "high" : minutes >= 600 ? "medium" : "low";
}

// Full 7-dimension profile (0..100 each) for the radar chart, at each dim's best tier.
import { STYLE_KEYS, STYLE_LABELS, bestTier } from "@/lib/analysis/styleDimensions";
import type { RadarPoint } from "@/lib/types";
export function styleProfile(p: MergedPlayer, baselines: LeagueBaselines): RadarPoint[] {
  return STYLE_KEYS.map((k) => {
    const t = bestTier(p, k);
    if (!t) return { key: k, label: STYLE_LABELS[k], value: 50 };
    const b = baselines[`${t}:${p.role}:${k}`];
    const v = styleValueAtTier(p, k, t);
    if (!b || b.std <= 0 || v == null) return { key: k, label: STYLE_LABELS[k], value: 50 };
    return { key: k, label: STYLE_LABELS[k], value: Math.round(Math.max(0, Math.min(100, 100 * clamp01(0.5 + zOf(v, b) * 0.16)))) };
  });
}
