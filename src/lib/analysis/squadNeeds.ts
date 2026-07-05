// src/lib/analysis/squadNeeds.ts
// Weakness detection, league-relative. For a club's role-unit, compares its
// (minutes-weighted) average on each style dimension to the Top-5 baseline for
// that role, and flags dimensions where the unit sits meaningfully below peers.
import type { MergedPlayer, Role, LeagueBaselines } from "@/lib/types";
import { STYLE_KEYS, STYLE_LABELS, STYLE_SOURCE, styleValue, type StyleKey } from "./styleDimensions";

const WEAK_Z = -0.5; // unit this far below the league mean (in std devs) = weakness
const MIN_BASELINE_N = 8; // need at least this many league players to trust a baseline

export type Weakness = {
  dimension: StyleKey;
  label: string;
  severity: number; // -z, larger = weaker
  unitZ: number;
  source: "fbref" | "fc";
};

function baselineKey(role: Role, key: StyleKey): string {
  return `${role}:${key}`;
}

// Player's z-score for one dimension vs the league baseline for his role.
export function playerZ(
  p: MergedPlayer,
  role: Role,
  key: StyleKey,
  baselines: LeagueBaselines
): number | null {
  const b = baselines[baselineKey(role, key)];
  const v = styleValue(p, key);
  if (!b || b.std <= 0 || v === null) return null;
  return (v - b.mean) / b.std;
}

export function detectWeaknesses(
  squad: MergedPlayer[],
  role: Role,
  baselines: LeagueBaselines,
  excludePlayerId?: string
): Weakness[] {
  const unit = squad.filter((p) => p.role === role && p.playerId !== excludePlayerId);
  if (unit.length === 0) return [];

  const weaknesses: Weakness[] = [];
  for (const key of STYLE_KEYS) {
    const b = baselines[baselineKey(role, key)];
    if (!b || b.std <= 0 || b.n < MIN_BASELINE_N) continue;

    const rows = unit
      .map((p) => ({ v: styleValue(p, key), w: p.performance?.minutes ?? 1 }))
      .filter((x): x is { v: number; w: number } => x.v !== null);
    if (rows.length === 0) continue;

    const wsum = rows.reduce((s, x) => s + (x.w || 1), 0);
    const unitVal = rows.reduce((s, x) => s + x.v * (x.w || 1), 0) / wsum;
    const z = (unitVal - b.mean) / b.std;

    if (z <= WEAK_Z) {
      weaknesses.push({
        dimension: key,
        label: STYLE_LABELS[key],
        severity: +(-z).toFixed(2),
        unitZ: +z.toFixed(2),
        source: STYLE_SOURCE[key],
      });
    }
  }
  return weaknesses.sort((a, b) => b.severity - a.severity).slice(0, 3);
}
