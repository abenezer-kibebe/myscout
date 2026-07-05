// src/lib/analysis/factors/attributeFit.ts
import type { FactorModule, FactorContext, FactorComputation } from "@/lib/types";
import { attributeProfileScore } from "../roleRating";
import { ROLE_ATTRIBUTE_PROFILES } from "@/lib/roles/roleProfiles";
import { clamp } from "../utils";

const nice = (k: string) => k.replace(/_/g, " ");

function compute(ctx: FactorContext): FactorComputation {
  const { player } = ctx;
  const fc = player.fc;
  if (!fc) {
    return {
      score: 50,
      confidence: "low",
      explanation: "No FC 26 attributes available; attribute fit cannot be assessed.",
      evidence: { reason: "no-fc" },
    };
  }

  const profileScore = attributeProfileScore(fc.attributes, player.role);
  if (profileScore === null) {
    return {
      score: 50,
      confidence: "low",
      explanation: "Role-relevant attributes missing; using a neutral score.",
      evidence: { reason: "no-role-attributes" },
    };
  }

  const score = clamp(((profileScore - 40) / (90 - 40)) * 100);
  const present = Object.keys(ROLE_ATTRIBUTE_PROFILES[player.role])
    .map((k) => ({ k, v: fc.attributes[k] }))
    .filter((x) => x.v !== undefined)
    .sort((a, b) => b.v - a.v);
  const top = present.slice(0, 2);
  const low = present.length ? present[present.length - 1] : null;

  const confidence: FactorComputation["confidence"] =
    player.matchConfidence === "high" ? "high" : player.matchConfidence === "medium" ? "medium" : "low";

  return {
    score,
    confidence,
    explanation:
      `Role profile score ${Math.round(profileScore)}/99` +
      (top.length ? `; strengths: ${top.map((t) => `${nice(t.k)} ${t.v}`).join(", ")}` : "") +
      (low ? `; weakest key trait: ${nice(low.k)} ${low.v}` : "") +
      ".",
    evidence: {
      role: player.role,
      profileScore: Math.round(profileScore),
      strengths: top.map((t) => ({ attr: t.k, value: t.v })),
      weakest: low ? { attr: low.k, value: low.v } : null,
    },
  };
}

export const attributeFit: FactorModule = {
  key: "attributeFit",
  label: "Attribute Fit",
  weight: 0.16,
  compute,
};
