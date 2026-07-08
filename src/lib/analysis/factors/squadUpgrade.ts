// src/lib/analysis/factors/squadUpgrade.ts
// "Is he better than what's already there?" For the Premier League this is
// judged on REAL role-relative quality (Sofascore), so a low FC rating never
// decides it. Non-PL players fall back to the FC attribute comparison.
import type { FactorModule, FactorContext, FactorComputation, MergedPlayer } from "@/lib/types";
import { roleAttributeQuality } from "../roleRating";
import { ROLE_LABELS } from "@/lib/roles/roleProfiles";
import { average, clamp } from "../utils";
import { roleQuality, minutesConfidence } from "@/lib/pl/quality";

const PROVEN_MINUTES = 900;

function verdictFor(gap: number): string {
  if (gap >= 12) return "a clear upgrade and likely immediate starter";
  if (gap >= 4) return "an upgrade on the current options";
  if (gap >= -3) return "level with the current options — rotation/competition";
  if (gap >= -12) return "below the current options — squad depth";
  return "not an upgrade on the current options";
}

function compute(ctx: FactorContext): FactorComputation {
  const { player, squad, leagueBaselines } = ctx;
  const role = player.role;
  const label = ROLE_LABELS[role];

  // ---- Premier League: real role-relative quality (0..100) ----
  const candQ = roleQuality(player, leagueBaselines);
  if (candQ !== null) {
    const incumbents = squad
      .filter((p) => p.playerId !== player.playerId && p.role === role)
      .map((p) => ({ p, q: roleQuality(p, leagueBaselines) }))
      .filter((x): x is { p: MergedPlayer; q: number } => x.q !== null)
      .sort((a, b) => b.q - a.q);

    const mins = player.advanced!.minutes;
    if (incumbents.length === 0) {
      return {
        score: clamp(64 + (candQ - 55) * 0.9),
        confidence: minutesConfidence(mins),
        explanation: `Club has no established ${label} on real data to compare against — a clear addition. Candidate's real quality rates ${Math.round(candQ)}/100 for the role.`,
        evidence: { source: "sofascore", role, candidateQuality: Math.round(candQ), incumbents: [] },
      };
    }

    const n = role === "GK" ? 2 : 3;
    const top = incumbents.slice(0, n);
    const baseline = average(top.map((t) => t.q))!;
    const gap = candQ - baseline;
    const score = clamp(60 + gap * 1.1);
    const proven = mins >= PROVEN_MINUTES;
    const confidence: FactorComputation["confidence"] = proven ? minutesConfidence(mins) : "medium";
    const topList = top.map((t) => ({ name: t.p.name, quality: Math.round(t.q) }));
    const provenNote = proven ? "" : " (limited minutes — less proven)";

    return {
      score,
      confidence,
      explanation:
        `Candidate's real role quality ${Math.round(candQ)}/100 vs the club's top ${top.length} ` +
        `(${topList.map((t) => `${t.name} ${t.quality}`).join(", ")}; avg ${baseline.toFixed(0)}) — ${verdictFor(gap)}${provenNote}.`,
      evidence: {
        source: "sofascore",
        role,
        candidateQuality: Math.round(candQ),
        baseline: +baseline.toFixed(1),
        gap: +gap.toFixed(1),
        topIncumbents: topList,
        proven,
      },
    };
  }

  // ---- Fallback (non-PL / no real data): FC attribute comparison ----
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
    .filter((x): x is { p: MergedPlayer; q: NonNullable<ReturnType<typeof roleAttributeQuality>> } => x.q !== null)
    .sort((a, b) => b.q.value - a.q.value);
  const proven = player.minutesLastSeason === null || player.minutesLastSeason >= PROVEN_MINUTES;

  if (incumbents.length === 0) {
    const score = clamp(70 + (candidate.value - 75) * 1.2);
    return {
      score,
      confidence: candidate.source === "estimate" || player.matchConfidence !== "high" ? "low" : "medium",
      explanation: `Club has no current ${label} to compare against — a clear addition. Candidate rates ${Math.round(candidate.value)} on ${label} attributes.`,
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
  weight: 0.28,
  compute,
};
