// src/lib/analysis/factors/tactical.ts
// Tactical Fit across MULTIPLE facets, not one axis. A club has an attacking
// identity (possession vs direct) AND a defensive phase — and defensive
// contribution matters in every system, so ball-winners aren't invisible.
// Premier League only (needs Club DNA); inapplicable elsewhere.
import type { FactorModule, FactorContext, FactorComputation } from "@/lib/types";
import { baselineKey, zScore } from "../squadNeeds";
import { bestTier, styleValueAtTier, type StyleKey } from "../styleDimensions";
import { clamp } from "../utils";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const POSS_DIMS: StyleKey[] = ["playmaking", "ballProgression", "chanceCreation"];
const DIRECT_DIMS: StyleKey[] = ["pace", "aerial"];
const DEF_DIMS: StyleKey[] = ["defensiveActions", "aerial"];

function compute(ctx: FactorContext): FactorComputation {
  const dna = ctx.club.dna;
  if (!dna) {
    return {
      score: 0,
      confidence: "low",
      applicable: false,
      explanation: `Tactical Fit uses Premier League club-style data, which isn't available for ${ctx.club.name}. Excluded from this score.`,
      evidence: { applicable: false },
    };
  }

  const { player, leagueBaselines } = ctx;
  const role = player.role;
  const strength01 = (key: StyleKey): number | null => {
    const t = bestTier(player, key);
    if (!t) return null;
    const b = leagueBaselines[baselineKey(t, role, key)];
    const v = styleValueAtTier(player, key, t);
    if (!b || v === null) return null;
    return clamp01(0.5 + zScore(v, b) * 0.16);
  };
  const avgAvail = (keys: StyleKey[]): number | null => {
    const vs = keys.map(strength01).filter((x): x is number => x !== null);
    return vs.length ? vs.reduce((s, x) => s + x, 0) / vs.length : null;
  };

  const possFit = avgAvail(POSS_DIMS);
  const directFit = avgAvail(DIRECT_DIMS);
  const defFit = avgAvail(DEF_DIMS);
  if (possFit === null && directFit === null && defFit === null) {
    return {
      score: 50,
      confidence: "low",
      explanation: `${ctx.club.name} play a ${dna.label} style, but this player lacks the data to assess tactical fit.`,
      evidence: { dna: dna.label },
    };
  }

  // Attacking identity: possession vs direct.
  const possW = clamp01((dna.possession - 42) / (62 - 42));
  let attacking: number | null;
  if (possFit !== null && directFit !== null) attacking = possW * possFit + (1 - possW) * directFit;
  else attacking = possFit ?? directFit;

  // Defensive phase weight: every team defends; leakier defences value it more.
  const defShare = clamp01(0.3 + (dna.defenceXga90 - 1.2) * 0.2);
  const attShare = 1 - defShare;

  // Combine facets, redistributing weight if a facet has no data.
  let num = 0;
  let den = 0;
  if (attacking !== null) { num += attShare * attacking; den += attShare; }
  if (defFit !== null) { num += defShare * defFit; den += defShare; }
  const score = clamp(100 * (den > 0 ? num / den : 0.5));

  const attackingLean = possW >= 0.5 ? "possession-based" : "direct/transition";
  const bestFacet =
    Math.max(possFit ?? 0, directFit ?? 0, defFit ?? 0) === (defFit ?? -1)
      ? "defensive work"
      : (possFit ?? 0) >= (directFit ?? 0)
      ? "technical/possession play"
      : "direct/athletic play";
  const confidence: FactorComputation["confidence"] = dna.games < 6 ? "low" : "medium";

  return {
    score,
    confidence,
    explanation:
      `${ctx.club.name}: ${attackingLean} in attack (${dna.possession}% poss), ` +
      `defensive phase weighted ${Math.round(defShare * 100)}% (concedes ${dna.defenceXga90} xGA/game). ` +
      `Player's strongest tactical contribution is ${bestFacet}${score >= 62 ? " — a good fit." : score <= 45 ? " — a stylistic mismatch." : " — a moderate fit."}`,
    evidence: {
      possession: dna.possession,
      possW: +possW.toFixed(2),
      defShare: +defShare.toFixed(2),
      possFit: possFit === null ? null : +possFit.toFixed(2),
      directFit: directFit === null ? null : +directFit.toFixed(2),
      defFit: defFit === null ? null : +defFit.toFixed(2),
    },
  };
}

export const tactical: FactorModule = { key: "tactical", label: "Tactical Fit", weight: 0.12, compute };
