// src/lib/analysis/roleRating.ts
// Turns a player's ability into role-specific numbers on the FC 0..99 scale.
import type { MergedPlayer, Role } from "@/lib/types";
import { ROLE_ATTRIBUTE_PROFILES, ROLE_POSITION_CODES } from "@/lib/roles/roleProfiles";

// Weighted mean over the role's demanded attributes (the "position attributes",
// e.g. defensive attributes for a CB), normalized over whichever are present.
export function attributeProfileScore(
  attributes: Record<string, number>,
  role: Role
): number | null {
  const profile = ROLE_ATTRIBUTE_PROFILES[role];
  let sum = 0;
  let weight = 0;
  for (const [key, w] of Object.entries(profile)) {
    const v = attributes[key];
    if (v !== undefined && Number.isFinite(v)) {
      sum += v * w;
      weight += w;
    }
  }
  if (weight === 0) return null;
  return sum / weight;
}

export type RoleRating = {
  value: number;
  source: "position" | "profile" | "overall";
} | null;

export function getRoleRating(player: MergedPlayer, role: Role): RoleRating {
  const fc = player.fc;
  if (!fc) return null;
  if (fc.positionRatings) {
    const codes = ROLE_POSITION_CODES[role];
    const vals = codes
      .map((c) => fc.positionRatings![c])
      .filter((v): v is number => v !== undefined && Number.isFinite(v));
    if (vals.length > 0) return { value: Math.max(...vals), source: "position" };
  }
  const profile = attributeProfileScore(fc.attributes, role);
  if (profile !== null) return { value: profile, source: "profile" };
  if (Number.isFinite(fc.overall)) return { value: fc.overall, source: "overall" };
  return null;
}

// The metric Squad Upgrade compares on: the role's ATTRIBUTE profile first
// (per your spec — defensive attributes for CBs, etc.), then overall, then the
// estimated rating for unmatched players. Same metric is used for candidate AND
// incumbents so the comparison is apples-to-apples.
export type RoleQuality = {
  value: number;
  source: "attributes" | "overall" | "estimate";
} | null;

export function roleAttributeQuality(player: MergedPlayer, role: Role): RoleQuality {
  const fc = player.fc;
  if (fc) {
    const prof = attributeProfileScore(fc.attributes, role);
    if (prof !== null) return { value: prof, source: "attributes" };
    if (Number.isFinite(fc.overall)) return { value: fc.overall, source: "overall" };
  }
  if (player.displayRating !== null) {
    return { value: player.displayRating, source: "estimate" };
  }
  return null;
}
