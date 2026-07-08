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

// Which data source a style dimension was read from, richest first.
export type DimTier = "sofa" | "fbref" | "fc";

// Real advanced per-player stats (Sofascore, Premier League only). Volume
// metrics are per-90; percentages/ratings are as-is.
export type AdvancedStats = {
  source: "sofascore-pl";
  season: string;
  minutes: number;
  appearances: number;
  rating: number | null;
  goals90: number;
  xG90: number;
  assists90: number;
  xA90: number;
  keyPasses90: number;
  bigChancesCreated90: number;
  bigChancesMissed90: number;
  shots90: number;
  shotsOnTarget90: number;
  dribbles90: number;
  finalThirdPasses90: number;
  tackles90: number;
  interceptions90: number;
  ballRecovery90: number;
  clearances90: number;
  blocks90: number;
  possWonAttThird90: number;
  dribbledPast90: number;
  aerialWon90: number;
  touches90: number;
  dispossessed90: number;
  passAccuracy: number | null;
  aerialWonPct: number | null;
  saves90: number | null;
  goalsPrevented90: number | null;
  savePct: number | null;
};

// Data-derived playing identity for a Premier League club (from team stats).
export type ClubDna = {
  key: string; // plClubKey
  name: string;
  games: number;
  possession: number; // %
  attackXg90: number; // npxG per 90
  defenceXga90: number; // xGA conceded per 90
  prgPass: number;
  prgCarry: number;
  progressionStyle: "pass" | "carry";
  tempo: "possession" | "balanced" | "direct";
  label: string;
  source: "pl-team-2025-26";
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
  advanced: AdvancedStats | null; // Sofascore, PL only
  contractExpiration: string | null; // ISO date; drives fee & feasibility
};

export type MergedClub = {
  clubId: string;
  name: string;
  leagueId: string;
  squadSize: number | null;
  averageAge: number | null;
  dna: ClubDna | null; // playing identity, PL only
  netTransferEur: number | null; // recent net transfer record (neg = net spend)
  squadValueEur: number | null; // sum of squad market values (wealth proxy)
  recentMaxFeeEur: number | null; // biggest fee paid in recent seasons (real)
  recentAvgFeeEur: number | null; // avg of top-3 recent fees (typical big signing)
  recentDealCount: number | null; // paid deals in recent window
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
  applicable?: boolean; // false => excluded from suitability and weights renormalized
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

export type FeasibilityBand = "Likely" | "Plausible" | "Difficult" | "Unrealistic";
export type FeasibilityFactor = {
  key: string;
  label: string;
  score: number; // 0..100
  detail: string;
};
export type FeasibilityResult = {
  score: number; // 0..100 (an ESTIMATE — no wage/budget data exists in free sources)
  band: FeasibilityBand;
  confidence: Confidence;
  estimatedFeeEur: number | null;
  estimatedBudgetEur: number | null;
  factors: FeasibilityFactor[];
  summary: string;
};

export type RadarPoint = { key: string; label: string; value: number };

export type AnalysisResult = {
  suitability: number;
  potential: number; // combined headline: suitability + feasibility
  profile: RadarPoint[]; // per-dimension 0..100 for the radar chart
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
  feasibility: FeasibilityResult | null;
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
