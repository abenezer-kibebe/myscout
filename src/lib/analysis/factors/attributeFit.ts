// src/lib/analysis/factors/attributeFit.ts
import type { FactorModule, FactorContext, FactorComputation } from "@/lib/types";
import { attributeProfileScore } from "../roleRating";
import { ROLE_ATTRIBUTE_PROFILES, ROLE_LABELS } from "@/lib/roles/roleProfiles";
import { clamp } from "../utils";
import { statisticalFit, minutesConfidence } from "@/lib/pl/quality";
import { STYLE_LABELS } from "../styleDimensions";

const nice = (k: string) => k.replace(/_/g, " ");

function compute(ctx: FactorContext): FactorComputation {
  const { player } = ctx;

  // Premier League: statistical fit from REAL z-scored role dimensions.
  const sf = statisticalFit(player, ctx.leagueBaselines);
  if (sf !== null) {
    const mins = player.advanced!.minutes;
    const top = sf.strengths.filter((s) => s.z > 0).slice(0, 2);
    const weak = sf.strengths[sf.strengths.length - 1];
    return {
      score: sf.score,
      confidence: minutesConfidence(mins),
      explanation:
        `Statistical fit for ${ROLE_LABELS[player.role]} (real data): ${Math.round(sf.score)}/100` +
        (top.length ? `; strengths: ${top.map((t) => STYLE_LABELS[t.dim].toLowerCase()).join(", ")}` : "") +
        (weak && weak.z < 0 ? `; weakest: ${STYLE_LABELS[weak.dim].toLowerCase()}` : "") +
        `${mins < 600 ? " (small sample)" : ""}.`,
      evidence: {
        source: "sofascore",
        role: player.role,
        fit: Math.round(sf.score),
        dims: sf.strengths.map((s) => ({ dim: s.dim, z: +s.z.toFixed(2) })),
      },
    };
  }

  // Fallback (non-PL / no real data): FC attribute profile.
  const fc = player.fc;
  if (!fc) {
    return {
      score: 50,
      confidence: "low",
      explanation: "No real data or FC 26 attributes available; fit cannot be assessed.",
      evidence: { reason: "no-data" },
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
      `Role profile score ${Math.round(profileScore)}/99 (FC attributes)` +
      (top.length ? `; strengths: ${top.map((t) => `${nice(t.k)} ${t.v}`).join(", ")}` : "") +
      (low ? `; weakest key trait: ${nice(low.k)} ${low.v}` : "") +
      ".",
    evidence: {
      source: "fc",
      role: player.role,
      profileScore: Math.round(profileScore),
      strengths: top.map((t) => ({ attr: t.k, value: t.v })),
      weakest: low ? { attr: low.k, value: low.v } : null,
    },
  };
}

export const attributeFit: FactorModule = {
  key: "attributeFit",
  label: "Statistical Fit",
  weight: 0.14,
  compute,
};
