// src/lib/types.ts
export type Role = "GK" | "CB" | "FB" | "DM" | "CM" | "AM" | "W" | "CF";

export type FcAbility = {
  overall: number;
  potential: number;
  attributes: Record<string, number>;
  positionRatings: Record<string, number> | null;
  preferredFoot: string | null;
  weakFoot: number | null;
  skillMoves: number | null;
  workRate: string | null;
};

export type MatchConfidence = "high" | "medium" | "low" | "none";

// Real performance (FBref, per season). null when unmatched. Basic-stats mirror:
// output/availability/defensive-actions/discipline/keeper — NOT xG/progression.
export type PlayerPerformance = {
  season: string;
  minutes: number;
  matchesPlayed: number;
  starts: number;
  nineties: number;
  pointsPerMatch: number | null;
  goals: number;
  assists: number;
  nonPenGoals: number;
  shots: number;
  shotsOnTarget: number;
  crosses: number;
  interceptions: number;
  tacklesWon: number;
  fouls: number;
  yellow: number;
  red: number;
  per90: {
    goals: number;
    assists: number;
    nonPenGoals: number;
    shots: number;
    shotsOnTarget: number;
    crosses: number;
    interceptions: number;
    tacklesWon: number;
    fouls: number;
  } | null; // null if < 450 minutes (too small a sample for rates)
  keeper: {
    goalsAgainstPer90: number | null;
    savePct: number | null;
    cleanSheetPct: number | null;
    shotsOnTargetAgainst: number | null;
  } | null;
  matchConfidence: MatchConfidence;
};

export type MergedPlayer = {
  playerId: string;
  name: string;
  dateOfBirth: string | null;
  age: number | null;
  nationality: string;
  clubId: string;
  clubName: string;
  leagueId: string;
  position: string;
  subPosition: string;
  role: Role;
  marketValue: number;
  highestMarketValue: number;
  minutesLastSeason: number | null;
  appearancesLastSeason: number | null;
  fc: FcAbility | null;
  matchConfidence: MatchConfidence;
  displayRating: number | null;
  ratingIsEstimated: boolean;
  performance: PlayerPerformance | null;
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

// ---- Modular factor architecture (#18) ----
// Every factor is a self-describing module: it owns its weight and returns the
// raw numbers that drove its score (evidence), so the UI and future
// positives/concerns view can explain "why", and scores are debuggable.
export type FactorKey =
  | "squadUpgrade"
  | "teamNeed"
  | "attributeFit"
  | "developmentValue"
  | "ageProfile"
  | "overallQuality"
  | "tactical";

export type FactorComputation = {
  score: number; // 0..100
  confidence: Confidence;
  explanation: string;
  evidence: Record<string, unknown>; // loosely typed on purpose while modules evolve
};

export type FactorOutput = FactorComputation & {
  key: FactorKey;
  label: string;
  weight: number; // weight now lives in the module, not the engine
};

export type FactorContext = {
  player: MergedPlayer;
  club: MergedClub;
  squad: MergedPlayer[];
  benchmark: ValueBenchmark;
  leagueBaselines: LeagueBaselines;
};

// Per (role:styleDimension) distribution across the Top 5, built offline.
export type Baseline = { mean: number; std: number; n: number };
export type LeagueBaselines = Record<string, Baseline>;

export type FactorModule = {
  key: FactorKey;
  label: string;
  weight: number;
  compute: (ctx: FactorContext) => FactorComputation;
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
    squadUpgrade: FactorOutput;
    teamNeed: FactorOutput;
    attributeFit: FactorOutput;
    developmentValue: FactorOutput;
    ageProfile: FactorOutput;
    overallQuality: FactorOutput;
    tactical: FactorOutput;
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

export type ClubOption = { id: string; name: string; leagueId: string };
export type PlayerOption = {
  id: string;
  name: string;
  role: Role;
  clubName: string;
  rating: number | null;
  estimated: boolean;
};
