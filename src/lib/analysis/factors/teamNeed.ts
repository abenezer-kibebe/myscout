// src/lib/analysis/factors/teamNeed.ts
// Does this player solve a problem THIS club has? Two kinds of need:
//   (1) the role unit is BELOW league par on a dimension (a weakness), and
//   (2) the unit has NO ELITE option on one of the role's core dimensions
//       (bodies but no standout) — a specialist who is elite there still fills
//       a real need even if the unit average looks fine.
import type { FactorModule, FactorContext, FactorComputation, DimTier } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/roles/roleProfiles";
import { detectWeaknesses, baselineKey, zScore } from "../squadNeeds";
import { bestTier, styleValueAtTier, STYLE_LABELS, type StyleKey } from "../styleDimensions";
import { coreDims } from "@/lib/pl/quality";
import { clamp } from "../utils";

const NO_ELITE_THRESHOLD = 0.8; // best unit z below this => no standout in that dim

type Need = { dimension: StyleKey; label: string; severity: number; tier: DimTier; reason: string };

function compute(ctx: FactorContext): FactorComputation {
  const { player, club, squad, leagueBaselines } = ctx;
  const role = player.role;
  const tierFor = (key: StyleKey): DimTier | null => bestTier(player, key);

  const needs = new Map<StyleKey, Need>();
  const add = (n: Need) => {
    const cur = needs.get(n.dimension);
    if (!cur || n.severity > cur.severity) needs.set(n.dimension, n);
  };

  // (1) below-par weaknesses
  for (const w of detectWeaknesses(squad, role, leagueBaselines, tierFor, player.playerId)) {
    add({ dimension: w.dimension, label: w.label, severity: w.severity, tier: w.tier, reason: "below par" });
  }

  // (2) no-elite-option on the role's core dimensions
  const unit = squad.filter((p) => p.role === role && p.playerId !== player.playerId);
  for (const dim of coreDims(role)) {
    const tier = tierFor(dim);
    if (!tier) continue;
    const b = leagueBaselines[baselineKey(tier, role, dim)];
    if (!b || b.std <= 0 || b.n < 8) continue;
    let unitBest = -Infinity;
    for (const p of unit) {
      const v = styleValueAtTier(p, dim, tier);
      if (v !== null) unitBest = Math.max(unitBest, zScore(v, b));
    }
    if (unitBest === -Infinity) unitBest = -0.5; // no data => treat as a gap
    if (unitBest < NO_ELITE_THRESHOLD) {
      add({
        dimension: dim,
        label: STYLE_LABELS[dim],
        severity: +Math.max(0.5, NO_ELITE_THRESHOLD - unitBest).toFixed(2),
        tier,
        reason: "no standout",
      });
    }
  }

  if (needs.size === 0) {
    return {
      score: 55,
      confidence: "medium",
      explanation: `No clear need in ${club.name}'s ${ROLE_LABELS[role]} unit — this player doesn't fill a specific gap there (he may still be an upgrade).`,
      evidence: { role, needs: [] },
    };
  }

  let sevSum = 0;
  let weighted = 0;
  let anyData = false;
  let anySofa = false;
  const detail = [...needs.values()].map((n) => {
    const b = leagueBaselines[baselineKey(n.tier, role, n.dimension)];
    const v = styleValueAtTier(player, n.dimension, n.tier);
    const z = b && v !== null ? zScore(v, b) : null;
    const strength = z === null ? 50 : clamp(50 + z * 16);
    if (z !== null) anyData = true;
    if (n.tier === "sofa") anySofa = true;
    sevSum += n.severity;
    weighted += strength * n.severity;
    return { dimension: n.dimension, label: n.label, reason: n.reason, candidateStrength: strength, addresses: z !== null && z > 0.3 };
  });

  const score = clamp(sevSum > 0 ? weighted / sevSum : 50);
  const addressed = detail.filter((d) => d.addresses);
  const confidence: FactorComputation["confidence"] = !anyData ? "low" : anySofa ? "high" : "medium";

  const needList = detail.map((d) => `${d.label.toLowerCase()} (${d.reason})`).join(", ");
  const addrList = addressed.map((d) => `${d.label.toLowerCase()} (${d.candidateStrength})`).join(", ");

  return {
    score,
    confidence,
    explanation:
      `${club.name}'s ${ROLE_LABELS[role]} needs: ${needList}. ` +
      (addressed.length ? `Candidate fills ${addressed.length}/${detail.length}: ${addrList}.` : `Candidate doesn't notably address these.`),
    evidence: { role, needs: detail, addressedCount: addressed.length },
  };
}

export const teamNeed: FactorModule = { key: "teamNeed", label: "Team Need", weight: 0.18, compute };
