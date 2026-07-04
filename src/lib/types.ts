// src/lib/types.ts
// Single source of truth for every shape shared across build script, loaders,
// analysis engine, and UI.

export type Role = "GK" | "CB" | "FB" | "DM" | "CM" | "AM" | "W" | "CF";

export type FcAbility = {
  overall: number;
  potential: number;
  attributes: Record<string, number>; // canonical keys, 0..99
  positionRatings: Record<string, number> | null;
  preferredFoot: string | null;
  weakFoot: number | null;
  skillMoves: number | null;
  workRate: string | null;
};

export type MatchConfidence = "high" | "medium" | "low" | "none";

export type MergedPlayer = {
  // Identity (Transfermarkt)
  playerId: string;
  name: string;
  dateOfBirth: string | null;
  age: number | null;
  nationality: string;
  // Club & role (Transfermarkt)
  clubId: string;
  clubName: string;
  leagueId: string; // GB1 | ES1 | L1 | IT1 | FR1
  position: string;
  subPosition: string;
  role: Role;
  // Financial (Transfermarkt)
  marketValue: number;
  highestMarketValue: number;
  // Reliability (Transfermarkt appearances) — optional
  minutesLastSeason: number | null;
  appearancesLastSeason: number | null;
  // Ability (FC 26) — null when unmatched
  fc: FcAbility | null;
  matchConfidence: MatchConfidence;
  // A rating for EVERY player: FC overall when matched, else estimated from the
  // market-value curve. ratingIsEstimated flags the fallback.
  displayRating: number | null;
  ratingIsEstimated: boolean;
};

export type MergedClub = {
  clubId: string;
  name: string;
  leagueId: string;
  squadSize: number | null;
  averageAge: number | null;
};

export type ValueBenchmark = Record<string, number>;

export type Confidence = "high" | "medium" | "low";

export type FactorResult = {
  score: number;
  explanation: string;
  confidence: Confidence;
};

export type FinancialBadge = {
  score: number;
  label: string;
  explanation: string;
  confidence: Confidence;
};

export type AnalysisResult = {
  suitability: number;
  confidence: Confidence;
  confidenceNote: string;
  breakdown: {
    squadUpgrade: FactorResult;
    attributeFit: FactorResult;
    developmentValue: FactorResult;
    ageProfile: FactorResult;
    overallQuality: FactorResult;
    tactical: FactorResult;
  };
  financialValue: FinancialBadge;
  meta: {
    playerName: string;
    role: Role;
    playerRating: number | null;
    ratingEstimated: boolean;
    playerAge: number | null;
    playerValue: number;
    playerMinutes: number | null;
    clubName: string;
    clubLeagueId: string;
    matchConfidence: MatchConfidence;
  };
};

// Dropdown/search payloads (small).
export type ClubOption = { id: string; name: string; leagueId: string };
export type PlayerOption = {
  id: string;
  name: string;
  role: Role;
  clubName: string;
  rating: number | null;
  estimated: boolean;
};
