// src/lib/roles/roleProfiles.ts
// Football domain knowledge lives here: how positions map to roles, which FC
// per-position rating columns belong to each role, and which attributes matter
// for each role. These are expert priors — not empirically validated — and are
// the first thing to tune once we can test against minutes played / value growth.
import type { Role } from "@/lib/types";

export const ROLE_LABELS: Record<Role, string> = {
  GK: "Goalkeeper",
  CB: "Centre Back",
  FB: "Full Back",
  DM: "Defensive Midfielder",
  CM: "Central Midfielder",
  AM: "Attacking Midfielder",
  W: "Winger",
  CF: "Centre Forward",
};

// Transfermarkt sub_position -> canonical role.
const SUBPOS_TO_ROLE: Record<string, Role> = {
  Goalkeeper: "GK",
  "Centre-Back": "CB",
  "Left-Back": "FB",
  "Right-Back": "FB",
  "Defensive Midfield": "DM",
  "Central Midfield": "CM",
  "Attacking Midfield": "AM",
  "Left Winger": "W",
  "Right Winger": "W",
  "Left Midfield": "W",
  "Right Midfield": "W",
  "Second Striker": "CF",
  "Centre-Forward": "CF",
};

// Broad position fallback when sub_position is missing/unknown.
const POSITION_TO_ROLE: Record<string, Role> = {
  Goalkeeper: "GK",
  Defender: "CB",
  Midfield: "CM",
  Attack: "CF",
};

export function resolveRole(position: string, subPosition: string): Role {
  return (
    SUBPOS_TO_ROLE[subPosition] ??
    POSITION_TO_ROLE[position] ??
    "CM"
  );
}

// FC per-position rating column codes that represent each role. We take the max
// available among candidates (a full back may have lb/rb/lwb/rwb ratings).
export const ROLE_POSITION_CODES: Record<Role, string[]> = {
  GK: ["gk"],
  CB: ["cb"],
  FB: ["lb", "rb", "lwb", "rwb"],
  DM: ["cdm"],
  CM: ["cm"],
  AM: ["cam"],
  W: ["lw", "rw", "lm", "rm"],
  CF: ["st", "cf"],
};

// Attribute profiles per role: canonical attribute key -> weight.
// Weights need not sum to 1; the scorer normalizes over whichever attributes
// are actually present for a player.
export const ROLE_ATTRIBUTE_PROFILES: Record<Role, Record<string, number>> = {
  GK: {
    gk_reflexes: 0.28,
    gk_diving: 0.22,
    gk_handling: 0.2,
    gk_positioning: 0.2,
    gk_kicking: 0.1,
  },
  CB: {
    defensive_awareness: 0.28,
    standing_tackle: 0.22,
    strength: 0.18,
    heading_accuracy: 0.16,
    reactions: 0.16,
  },
  FB: {
    pace: 0.22,
    standing_tackle: 0.2,
    defensive_awareness: 0.18,
    stamina: 0.16,
    crossing: 0.14,
    ball_control: 0.1,
  },
  DM: {
    interceptions: 0.24,
    defensive_awareness: 0.24,
    standing_tackle: 0.18,
    strength: 0.14,
    short_passing: 0.12,
    aggression: 0.08,
  },
  CM: {
    short_passing: 0.24,
    vision: 0.2,
    ball_control: 0.18,
    stamina: 0.16,
    reactions: 0.12,
    long_passing: 0.1,
  },
  AM: {
    vision: 0.24,
    short_passing: 0.2,
    dribbling: 0.18,
    ball_control: 0.18,
    composure: 0.12,
    agility: 0.08,
  },
  W: {
    pace: 0.22,
    dribbling: 0.2,
    acceleration: 0.18,
    ball_control: 0.16,
    agility: 0.14,
    crossing: 0.1,
  },
  CF: {
    finishing: 0.26,
    positioning: 0.22,
    composure: 0.16,
    shot_power: 0.14,
    heading_accuracy: 0.12,
    pace: 0.1,
  },
};
