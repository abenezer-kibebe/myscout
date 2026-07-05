// src/lib/analysis/factors/teamNeed.ts
// Recruitment-first factor: does this player solve a problem THIS club actually
// has? Detects the club's league-relative weaknesses in the player's role, then
// scores how strongly the player rates on exactly those weak dimensions.
import type { FactorModule, FactorContext, FactorComputation } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/roles/roleProfiles";
import { detectWeaknesses, playerZ } from "../squadNeeds";
import { clamp } from "../utils";

function compute(ctx: FactorContext): FactorComputation {
  const { player, club, squad, leagueBaselines } = ctx;
  const role = player.role;
  const weaknesses = detectWeaknesses(squad, role, leagueBaselines, player.playerId);

  if (weaknesses.length === 0) {
    return {
      score: 55,
      confidence: "medium",
      explanation: `No clear weakness in ${club.name}'s ${ROLE_LABELS[role]} unit versus Top-5 peers — this player doesn't fill a specific need in that role (he may still be an upgrade).`,
      evidence: { role, weaknesses: [] },
    };
  }

  let sevSum = 0;
  let weighted = 0;
  let anyData = false;
  const detail = weaknesses.map((w) => {
    const z = playerZ(player, role, w.dimension, leagueBaselines);
    const strength = z === null ? 50 : clamp(50 + z * 16);
    if (z !== null) anyData = true;
    sevSum += w.severity;
    weighted += strength * w.severity;
    return { dimension: w.dimension, label: w.label, unitZ: w.unitZ, source: w.source, candidateStrength: strength, addresses: z !== null && z > 0 };
  });

  const score = clamp(sevSum > 0 ? weighted / sevSum : 50);
  const addressed = detail.filter((d) => d.addresses);

  const allFbref = weaknesses.every((w) => w.source === "fbref");
  let confidence: FactorComputation["confidence"];
  if (!anyData) confidence = "low";
  else if (allFbref && player.performance) confidence = "high";
  else confidence = "medium";

  const weakList = weaknesses.map((w) => w.label.toLowerCase()).join(", ");
  const addrList = addressed.map((d) => `${d.label.toLowerCase()} (${d.candidateStrength})`).join(", ");

  return {
    score,
    confidence,
    explanation:
      `${club.name}'s ${ROLE_LABELS[role]} unit is weak on ${weakList}. ` +
      (addressed.length
        ? `Candidate addresses ${addressed.length}/${weaknesses.length}: ${addrList}.`
        : `Candidate does not notably improve these areas.`),
    evidence: { role, weaknesses: detail, addressedCount: addressed.length },
  };
}

export const teamNeed: FactorModule = {
  key: "teamNeed",
  label: "Team Need",
  weight: 0.2,
  compute,
};
