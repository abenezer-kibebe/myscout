// src/lib/analysis/factors/squadUpgrade.ts
import type { FactorModule, FactorContext, FactorComputation } from "@/lib/types";
import { roleAttributeQuality } from "../roleRating";
import { ROLE_LABELS } from "@/lib/roles/roleProfiles";
import { average, clamp } from "../utils";

const PROVEN_MINUTES = 900;

function compute(ctx: FactorContext): FactorComputation {
  const { player, squad } = ctx;
  const role = player.role;
  const label = ROLE_LABELS[role];
  const candidate = roleAttributeQuality(player, role);

  if (!candidate) {
    return {
      score: 50,
      confidence: "low",
      explanation: `No ability or rating available, so the quality gap for ${label} cannot be measured.`,
      evidence: { role, reason: "no-candidate-rating" },
    };
  }

  const incumbents = squad
    .filter((p) => p.playerId !== player.playerId && p.role === role)
    .map((p) => ({ p, q: roleAttributeQuality(p, role) }))
    .filter((x): x is { p: typeof squad[number]; q: NonNullable<ReturnType<typeof roleAttributeQuality>> } => x.q !== null)
    .sort((a, b) => b.q.value - a.q.value);

  const proven = player.minutesLastSeason === null || player.minutesLastSeason >= PROVEN_MINUTES;

  if (incumbents.length === 0) {
    const score = clamp(70 + (candidate.value - 75) * 1.2);
    return {
      score,
      confidence: candidate.source === "estimate" || player.matchConfidence !== "high" ? "low" : "medium",
      explanation: `Club has no current ${label} to compare against — a clear addition. Candidate rates ${Math.round(
        candidate.value
      )} on ${label} attributes.`,
      evidence: { role, candidateRating: Math.round(candidate.value), candidateSource: candidate.source, incumbents: [] },
    };
  }

  const n = role === "GK" ? 2 : 3;
  const top = incumbents.slice(0, n);
  const baseline = average(top.map((t) => t.q.value))!;
  const gap = candidate.value - baseline;
  const score = clamp(64 + gap * 3.4);

  let verdict: string;
  if (gap >= 6) verdict = "a clear upgrade and likely immediate starter";
  else if (gap >= 2) verdict = "an upgrade on the current options";
  else if (gap >= -1) verdict = "level with the current options — rotation/competition";
  else if (gap >= -4) verdict = "below the current options — squad depth";
  else verdict = "not an upgrade on the current options";

  let confidence: FactorComputation["confidence"] = "high";
  if (player.matchConfidence === "none" || player.matchConfidence === "low" || candidate.source !== "attributes") {
    confidence = "low";
  } else if (!proven || top.some((t) => t.q.source !== "attributes")) {
    confidence = "medium";
  }

  const topList = top.map((t) => ({ name: t.p.name, rating: Math.round(t.q.value) }));
  const provenNote = proven ? "" : " (limited minutes last season — less proven)";

  return {
    score,
    confidence,
    explanation:
      `Candidate rates ${Math.round(candidate.value)} on ${label} attributes vs the club's top ${top.length} ` +
      `(${topList.map((t) => `${t.name} ${t.rating}`).join(", ")}; avg ${baseline.toFixed(1)}) — ${verdict}${provenNote}.`,
    evidence: {
      role,
      candidateRating: Math.round(candidate.value),
      candidateSource: candidate.source,
      baseline: +baseline.toFixed(1),
      gap: +gap.toFixed(1),
      topIncumbents: topList,
      proven,
    },
  };
}

export const squadUpgrade: FactorModule = {
  key: "squadUpgrade",
  label: "Squad Upgrade",
  weight: 0.3,
  compute,
};
