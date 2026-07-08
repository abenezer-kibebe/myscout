// src/lib/analysis/calculateSquadUpgrade.ts
// THE core factor, per your spec. For the candidate's role, take the club's
// TOP-N players in that role (top 3 outfield, top 2 for GK), average their
// position-attribute scores (e.g. the defensive-attribute average for centre
// backs), and compare the candidate's own position-attribute score against it.
// Measures QUALITY GAP vs the best current options — never player count.
import type { MergedPlayer, FactorResult, Role } from "@/lib/types";
import { roleAttributeQuality } from "./roleRating";
import { ROLE_LABELS } from "@/lib/roles/roleProfiles";
import { average, clamp } from "./utils";

const PROVEN_MINUTES = 900;

function topN(role: Role): number {
  return role === "GK" ? 2 : 3; // GK: 1st + 2nd choice; outfield: top 3
}

export function calculateSquadUpgrade(
  player: MergedPlayer,
  squad: MergedPlayer[]
): FactorResult {
  const role = player.role;
  const label = ROLE_LABELS[role];
  const candidate = roleAttributeQuality(player, role);

  if (!candidate) {
    return {
      score: 50,
      confidence: "low",
      explanation: `No ability or rating available, so the quality gap for ${label} cannot be measured.`,
    };
  }

  // Rank the club's other players in this role by the same position-attribute metric.
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
      explanation: `Club has no current ${label} to compare against — a clear addition. Candidate rates ${Math.round(
        candidate.value
      )} on ${label} attributes.`,
    };
  }

  const n = topN(role);
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

  let confidence: FactorResult["confidence"] = "high";
  if (
    player.matchConfidence === "none" ||
    player.matchConfidence === "low" ||
    candidate.source !== "attributes"
  ) {
    confidence = "low";
  } else if (!proven || top.some((t) => t.q.source !== "attributes")) {
    confidence = "medium";
  }

  const names = top.map((t) => `${t.p.name} ${Math.round(t.q.value)}`).join(", ");
  const provenNote = proven ? "" : " (limited minutes last season — less proven)";

  return {
    score,
    confidence,
    explanation:
      `Candidate rates ${Math.round(candidate.value)} on ${label} attributes vs the club's ` +
      `top ${top.length} (${names}; avg ${baseline.toFixed(1)}) — ${verdict}${provenNote}.`,
  };
}
