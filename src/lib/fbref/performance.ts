// src/lib/fbref/performance.ts
// Turns the Kaggle FBref "Big 5" basic-stats CSV into a PlayerPerformance block
// and matches it onto our players by normalized name + birth YEAR (+ league),
// because this mirror only exposes birth year, not full DOB.
//
// Handles mid-season transfers: a player with rows at two clubs is aggregated
// into one season total, then per-90 rates are computed from the totals.
import type { PlayerPerformance, MatchConfidence } from "@/lib/types";
import { normalizeName, lastToken, nameSimilarity } from "../matching/nameMatch";

type Row = Record<string, string>;
const n = (v?: string): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const FBREF_LEAGUE: Record<string, string> = {
  "eng premier league": "GB1",
  "es la liga": "ES1",
  "de bundesliga": "L1",
  "it serie a": "IT1",
  "fr ligue 1": "FR1",
};
export function fbrefLeagueId(comp: string | undefined): string | null {
  return FBREF_LEAGUE[(comp ?? "").toLowerCase().trim()] ?? null;
}

// One aggregated record per (normalized name + birth year).
type AggRecord = {
  norm: string;
  last: string;
  born: string;
  leagueId: string | null;
  minutes: number;
  mp: number;
  starts: number;
  ppmWeighted: number; // sum(PPM * MP), divided by mp at the end
  goals: number;
  assists: number;
  npg: number;
  shots: number;
  sot: number;
  crosses: number;
  interceptions: number;
  tacklesWon: number;
  fouls: number;
  yellow: number;
  red: number;
  ga: number;
  sota: number;
  saves: number;
  cs: number;
  keeperMp: number;
};

function emptyAgg(norm: string, born: string): AggRecord {
  return {
    norm,
    last: lastToken(norm),
    born,
    leagueId: null,
    minutes: 0,
    mp: 0,
    starts: 0,
    ppmWeighted: 0,
    goals: 0,
    assists: 0,
    npg: 0,
    shots: 0,
    sot: 0,
    crosses: 0,
    interceptions: 0,
    tacklesWon: 0,
    fouls: 0,
    yellow: 0,
    red: 0,
    ga: 0,
    sota: 0,
    saves: 0,
    cs: 0,
    keeperMp: 0,
  };
}

export type PerfIndex = {
  byNameYear: Map<string, AggRecord>;
  byName: Map<string, AggRecord[]>;
  byLast: Map<string, AggRecord[]>;
};

function pushArr(m: Map<string, AggRecord[]>, k: string, r: AggRecord) {
  const a = m.get(k);
  if (a) a.push(r);
  else m.set(k, [r]);
}

export function buildPerfIndex(rows: Row[]): PerfIndex {
  // Aggregate rows by (norm, born); the biggest-minutes row sets primary league.
  const agg = new Map<string, AggRecord>();
  const bestMin = new Map<string, number>();

  for (const row of rows) {
    const leagueId = fbrefLeagueId(row.Comp);
    if (!leagueId) continue;
    const norm = normalizeName(row.Player ?? "");
    const born = (row.Born ?? "").trim();
    if (!norm || !born) continue;
    const key = `${norm}|${born}`;
    const rec = agg.get(key) ?? emptyAgg(norm, born);

    const min = n(row.Min);
    const mp = n(row.MP);
    rec.minutes += min;
    rec.mp += mp;
    rec.starts += n(row.Starts);
    rec.ppmWeighted += n(row.PPM) * mp;
    rec.goals += n(row.Gls);
    rec.assists += n(row.Ast);
    rec.npg += n(row["G-PK"]);
    rec.shots += n(row.Sh);
    rec.sot += n(row.SoT);
    rec.crosses += n(row.Crs);
    rec.interceptions += n(row.Int);
    rec.tacklesWon += n(row.TklW);
    rec.fouls += n(row.Fls);
    rec.yellow += n(row.CrdY);
    rec.red += n(row.CrdR);
    rec.ga += n(row.GA);
    rec.sota += n(row.SoTA);
    rec.saves += n(row.Saves);
    rec.cs += n(row.CS);
    if (n(row.Saves) > 0 || n(row.GA) > 0 || n(row.SoTA) > 0) rec.keeperMp += mp;

    // Primary league = league where the player logged the most minutes.
    const prev = bestMin.get(key) ?? -1;
    if (min > prev) {
      bestMin.set(key, min);
      rec.leagueId = leagueId;
    }
    agg.set(key, rec);
  }

  const byNameYear = new Map<string, AggRecord>();
  const byName = new Map<string, AggRecord[]>();
  const byLast = new Map<string, AggRecord[]>();
  for (const [key, rec] of agg) {
    byNameYear.set(key, rec);
    pushArr(byName, rec.norm, rec);
    if (rec.last.length >= 3) pushArr(byLast, rec.last, rec);
  }
  return { byNameYear, byName, byLast };
}

function toPerformance(
  rec: AggRecord,
  season: string,
  confidence: MatchConfidence
): PlayerPerformance {
  const nineties = rec.minutes / 90;
  const rate = (total: number) => (rec.minutes >= 450 ? +(total / nineties).toFixed(3) : 0);
  const per90 =
    rec.minutes >= 450
      ? {
          goals: rate(rec.goals),
          assists: rate(rec.assists),
          nonPenGoals: rate(rec.npg),
          shots: rate(rec.shots),
          shotsOnTarget: rate(rec.sot),
          crosses: rate(rec.crosses),
          interceptions: rate(rec.interceptions),
          tacklesWon: rate(rec.tacklesWon),
          fouls: rate(rec.fouls),
        }
      : null;

  // Keepers play only in goal, so their total minutes are keeper minutes.
  const isKeeper = rec.saves > 0 || rec.ga > 0 || rec.sota > 0;
  const keeper = isKeeper
    ? {
        goalsAgainstPer90: rec.minutes >= 450 ? +(rec.ga / (rec.minutes / 90)).toFixed(2) : null,
        savePct: rec.sota > 0 ? +((rec.saves / rec.sota) * 100).toFixed(1) : null,
        cleanSheetPct: rec.mp > 0 ? +((rec.cs / rec.mp) * 100).toFixed(1) : null,
        shotsOnTargetAgainst: rec.sota,
      }
    : null;

  return {
    season,
    minutes: rec.minutes,
    matchesPlayed: rec.mp,
    starts: rec.starts,
    nineties: +nineties.toFixed(1),
    pointsPerMatch: rec.mp > 0 ? +(rec.ppmWeighted / rec.mp).toFixed(2) : null,
    goals: rec.goals,
    assists: rec.assists,
    nonPenGoals: rec.npg,
    shots: rec.shots,
    shotsOnTarget: rec.sot,
    crosses: rec.crosses,
    interceptions: rec.interceptions,
    tacklesWon: rec.tacklesWon,
    fouls: rec.fouls,
    yellow: rec.yellow,
    red: rec.red,
    per90,
    keeper,
    matchConfidence: confidence,
  };
}

// Match one of our players (already normalized name + birth year + league).
export function matchPerformance(
  norm: string,
  birthYear: string | null,
  leagueId: string,
  index: PerfIndex,
  season: string
): PlayerPerformance | null {
  const last = lastToken(norm);

  // 1. exact name + birth year.
  if (birthYear) {
    const rec = index.byNameYear.get(`${norm}|${birthYear}`);
    if (rec) return toPerformance(rec, season, "high");
  }

  // 2. exact name, any year (prefer same league).
  const byName = index.byName.get(norm);
  if (byName && byName.length) {
    const sameLeague = byName.find((r) => r.leagueId === leagueId);
    const rec = sameLeague ?? byName[0];
    return toPerformance(rec, season, sameLeague ? "medium" : "low");
  }

  // 3. last-name + birth-year, fuzzy first name.
  if (birthYear && last.length >= 3) {
    const cands = (index.byLast.get(last) ?? []).filter((r) => r.born === birthYear);
    if (cands.length) {
      let best = cands[0];
      let sim = 0;
      for (const r of cands) {
        const s = nameSimilarity(norm, r.norm);
        if (s > sim) {
          sim = s;
          best = r;
        }
      }
      if (sim >= 0.6) return toPerformance(best, season, "low");
    }
  }

  return null;
}
