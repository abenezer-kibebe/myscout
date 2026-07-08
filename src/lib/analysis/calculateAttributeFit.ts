// src/lib/analysis/calculateAttributeFit.ts
// Distinct from Squad Upgrade: Upgrade asks "is he better than what we have?";
// Attribute Fit asks "does he have the SPECIFIC attributes this role needs?"
// A high-overall winger with poor pace is a poor FIT for a pace-reliant role.
// This keeps pure quality (Overall) from being double-counted.
import type { MergedPlayer, FactorResult } from "@/lib/types";
import { attributeProfileScore } from "./roleRating";
import { ROLE_ATTRIBUTE_PROFILES } from "@/lib/roles/roleProfiles";
import { clamp } from "./utils";

function niceAttr(key: string): string {
  return key.replace(/_/g, " ");
}

export function calculateAttributeFit(player: MergedPlayer): FactorResult {
  const fc = player.fc;
  if (!fc) {
    return {
      score: 50,
      confidence: "low",
      explanation: "No FC 26 attributes available; attribute fit cannot be assessed.",
    };
  }

  const profileScore = attributeProfileScore(fc.attributes, player.role);
  if (profileScore === null) {
    return {
      score: 50,
      confidence: "low",
      explanation: "Role-relevant attributes missing; using a neutral score.",
    };
  }

  // Map the 0..99 weighted profile score onto 0..100 with a sensible spread.
  const score = clamp(((profileScore - 40) / (90 - 40)) * 100);

  // Surface the strongest and weakest role-critical attributes for the reason.
  const present = Object.keys(ROLE_ATTRIBUTE_PROFILES[player.role])
    .map((k) => ({ k, v: fc.attributes[k] }))
    .filter((x) => x.v !== undefined)
    .sort((a, b) => b.v - a.v);

  const top = present.slice(0, 2).map((x) => `${niceAttr(x.k)} ${x.v}`);
  const low = present.length ? present[present.length - 1] : null;

  const confidence: FactorResult["confidence"] =
    player.matchConfidence === "high" ? "high" : player.matchConfidence === "medium" ? "medium" : "low";

  return {
    score,
    confidence,
    explanation:
      `Role profile score ${Math.round(profileScore)}/99` +
      (top.length ? `; strengths: ${top.join(", ")}` : "") +
      (low ? `; weakest key trait: ${niceAttr(low.k)} ${low.v}` : "") +
      ".",
  };
}
