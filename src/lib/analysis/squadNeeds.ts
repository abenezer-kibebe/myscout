// src/lib/analysis/squadNeeds.ts
// Tier-aware weakness detection. A club's role-unit is compared to the league
// baseline FOR THE SAME TIER, so a Sofascore-based value is never compared
// against an FC-proxy value. The caller supplies, per dimension, which tier to
// evaluate at (for a candidate: the tier the candidate and unit share).
import type { MergedPlayer, Role, LeagueBaselines, DimTier, Baseline } from "@/lib/types";
import { STYLE_KEYS, STYLE_LABELS, styleValueAtTier, bestTier, type StyleKey } from "./styleDimensions";

const WEAK_Z = -0.5;
const MIN_BASELINE_N = 8;

export type Weakness = {
  dimension: StyleKey;
  label: string;
  severity: number;
  unitZ: number;
  tier: DimTier;
};

export function baselineKey(tier: DimTier, role: Role, key: StyleKey): string {
  return `${tier}:${role}:${key}`;
}

export function zScore(value: number, b: Baseline): number {
  return b.std > 0 ? (value - b.mean) / b.std : 0;
}

// Minutes-weighted unit average for a dimension at a specific tier (players
// lacking that tier's value are skipped).
export function unitValueAtTier(unit: MergedPlayer[], key: StyleKey, tier: DimTier): number | null {
  const rows = unit
    .map((p) => ({ v: styleValueAtTier(p, key, tier), w: p.performance?.minutes ?? p.advanced?.minutes ?? 1 }))
    .filter((x): x is { v: number; w: number } => x.v !== null);
  if (rows.length === 0) return null;
  const wsum = rows.reduce((s, x) => s + (x.w || 1), 0);
  return rows.reduce((s, x) => s + x.v * (x.w || 1), 0) / wsum;
}

// Detect the unit's weaknesses. `tierFor(key)` picks the evaluation tier per
// dimension; default is the unit's own richest available tier.
export function detectWeaknesses(
  squad: MergedPlayer[],
  role: Role,
  baselines: LeagueBaselines,
  tierFor?: (key: StyleKey) => DimTier | null,
  excludePlayerId?: string
): Weakness[] {
  const unit = squad.filter((p) => p.role === role && p.playerId !== excludePlayerId);
  if (unit.length === 0) return [];

  const out: Weakness[] = [];
  for (const key of STYLE_KEYS) {
    const tier = tierFor ? tierFor(key) : unitBestTier(unit, key);
    if (!tier) continue;
    const b = baselines[baselineKey(tier, role, key)];
    if (!b || b.std <= 0 || b.n < MIN_BASELINE_N) continue;
    const unitVal = unitValueAtTier(unit, key, tier);
    if (unitVal === null) continue;
    const z = zScore(unitVal, b);
    if (z <= WEAK_Z) {
      out.push({ dimension: key, label: STYLE_LABELS[key], severity: +(-z).toFixed(2), unitZ: +z.toFixed(2), tier });
    }
  }
  return out.sort((a, b) => b.severity - a.severity).slice(0, 3);
}

function unitBestTier(unit: MergedPlayer[], key: StyleKey): DimTier | null {
  // richest tier at least half the unit shares
  const counts: Record<DimTier, number> = { sofa: 0, fbref: 0, fc: 0 };
  for (const p of unit) {
    const t = bestTier(p, key);
    if (t) counts[t]++;
  }
  if (counts.sofa >= Math.ceil(unit.length / 2)) return "sofa";
  if (counts.sofa + counts.fbref >= Math.ceil(unit.length / 2)) return "fbref";
  return "fc";
}
