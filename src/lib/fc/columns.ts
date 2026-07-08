// src/lib/fc/columns.ts
// The FC 26 CSV header names can vary between releases/exports. Every raw FC
// column we need is resolved through the alias tables below, so if the real
// headers differ, you edit ONLY this file — the engine never hardcodes a name.
//
// Used by scripts/buildPlayerProfiles.ts to turn raw FC rows into the clean,
// canonical FcAbility shape the engine consumes.

type Row = Record<string, string>;

// canonical key -> list of possible source column names (checked in order)
const HEADLINE_ALIASES: Record<string, string[]> = {
  overall: ["overall", "overall_rating", "ovr", "rating"],
  potential: ["potential", "pot"],
  value_eur: ["value_eur", "value", "market_value"],
  preferred_foot: ["preferred_foot", "foot"],
  weak_foot: ["weak_foot", "weakfoot"],
  skill_moves: ["skill_moves", "skillmoves", "skill"],
  work_rate: ["work_rate", "workrate", "work_rates"],
  dob: ["dob", "date_of_birth", "birth_date", "birthdate"],
  age: ["age"],
  long_name: ["long_name", "full_name", "name"],
  short_name: ["short_name", "known_as", "common_name"],
  nationality: ["nationality", "nationality_name", "nation"],
  league_name: ["league_name", "league", "club_league_name"],
  club_name: ["club_name", "club", "team_name", "club_team"],
  player_positions: ["player_positions", "positions", "position"],
};

const ATTRIBUTE_ALIASES: Record<string, string[]> = {
  acceleration: ["acceleration", "movement_acceleration"],
  sprint_speed: ["sprint_speed", "movement_sprint_speed"],
  pace: ["pace"], // may be absent; we derive from accel/sprint if so
  finishing: ["finishing", "attacking_finishing"],
  positioning: ["positioning", "mentality_positioning"],
  composure: ["composure", "mentality_composure"],
  shot_power: ["shot_power", "power_shot_power"],
  long_shots: ["long_shots", "power_long_shots"],
  heading_accuracy: ["heading_accuracy", "attacking_heading_accuracy", "heading"],
  dribbling: ["dribbling", "skill_dribbling"],
  ball_control: ["ball_control", "skill_ball_control"],
  agility: ["agility", "movement_agility"],
  balance: ["balance", "movement_balance"],
  reactions: ["reactions", "movement_reactions"],
  crossing: ["crossing", "attacking_crossing"],
  short_passing: ["short_passing", "attacking_short_passing"],
  long_passing: ["long_passing", "skill_long_passing"],
  vision: ["vision", "mentality_vision"],
  stamina: ["stamina", "power_stamina"],
  strength: ["strength", "power_strength"],
  aggression: ["aggression", "mentality_aggression"],
  interceptions: ["interceptions", "mentality_interceptions"],
  defensive_awareness: [
    "defensive_awareness",
    "mentality_defensive_awareness",
    "marking",
    "defending",
  ],
  standing_tackle: ["standing_tackle", "defending_standing_tackle"],
  sliding_tackle: ["sliding_tackle", "defending_sliding_tackle"],
  gk_diving: ["gk_diving", "goalkeeping_diving"],
  gk_handling: ["gk_handling", "goalkeeping_handling"],
  gk_kicking: ["gk_kicking", "goalkeeping_kicking"],
  gk_positioning: ["gk_positioning", "goalkeeping_positioning"],
  gk_reflexes: ["gk_reflexes", "goalkeeping_reflexes"],
};

// FC per-position rating columns we look for (optional in the dataset).
export const POSITION_RATING_CODES = [
  "gk",
  "cb",
  "lb",
  "rb",
  "lwb",
  "rwb",
  "cdm",
  "cm",
  "cam",
  "lm",
  "rm",
  "lw",
  "rw",
  "st",
  "cf",
];

function raw(row: Row, aliases: string[]): string | null {
  for (const a of aliases) {
    if (row[a] !== undefined && row[a] !== null && row[a] !== "") return row[a];
  }
  return null;
}

export function fcString(row: Row, key: keyof typeof HEADLINE_ALIASES): string | null {
  return raw(row, HEADLINE_ALIASES[key]);
}

export function fcNumber(row: Row, aliases: string[]): number | null {
  const v = raw(row, aliases);
  if (v === null) return null;
  // FC attribute cells sometimes look like "82+2" — take the base number.
  const base = v.split(/[+\-]/)[0].trim();
  const n = Number(base);
  return Number.isFinite(n) ? n : null;
}

export function fcHeadlineNumber(
  row: Row,
  key: keyof typeof HEADLINE_ALIASES
): number | null {
  return fcNumber(row, HEADLINE_ALIASES[key]);
}

// Build the canonical attributes record. Derives `pace` from acceleration +
// sprint speed when no explicit pace column exists.
export function extractAttributes(row: Row): Record<string, number> {
  const attrs: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(ATTRIBUTE_ALIASES)) {
    const n = fcNumber(row, aliases);
    if (n !== null) attrs[key] = n;
  }
  if (attrs.pace === undefined) {
    const a = attrs.acceleration;
    const s = attrs.sprint_speed;
    if (a !== undefined && s !== undefined) attrs.pace = Math.round((a + s) / 2);
  }
  return attrs;
}

// Extract per-position ratings if the columns exist; otherwise null.
export function extractPositionRatings(row: Row): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const code of POSITION_RATING_CODES) {
    const n = fcNumber(row, [code]);
    if (n !== null) out[code] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}
