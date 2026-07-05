// scripts/buildPlayerProfiles.ts
// OFFLINE precompute. Run with:  npm run build:data
//
// Reads Transfermarkt CSVs + the FC 26 CSV from ./data, restricts to Europe's
// Top 5 leagues, matches players across datasets (DOB-first for high recall),
// gives EVERY player a rating (FC overall or estimated from market value), and
// writes ./data/merged/{players,clubs,valueBenchmark}.json.
//
// FC file: data/fc26.csv (or set FC_CSV=yourfile.csv).
// Appearances (optional): data/appearances.csv
import fs from "fs";
import path from "path";
import { createReadStream } from "fs";
import Papa from "papaparse";

import type {
  MergedPlayer,
  MergedClub,
  FcAbility,
  ValueBenchmark,
  MatchConfidence,
} from "../src/lib/types";
import { resolveRole } from "../src/lib/roles/roleProfiles";
import {
  fcHeadlineNumber,
  fcString,
  extractAttributes,
  extractPositionRatings,
} from "../src/lib/fc/columns";
import {
  normalizeName,
  nameSimilarity,
  dobKey,
  lastToken,
} from "../src/lib/matching/nameMatch";
import { getAge, num, median } from "../src/lib/analysis/utils";
import { buildPerfIndex, matchPerformance } from "../src/lib/fbref/performance";
import { STYLE_KEYS, styleValue } from "../src/lib/analysis/styleDimensions";
import type { LeagueBaselines } from "../src/lib/types";

type Row = Record<string, string>;

const DATA = path.join(process.cwd(), "data");
const OUT = path.join(DATA, "merged");
const FC_CSV = process.env.FC_CSV || "fc26.csv";
const FBREF_CSV = process.env.FBREF_CSV || "players_data-2025_2026.csv";
const SEASON = (FBREF_CSV.match(/(\d{4})[_-](\d{4})/)?.[0] ?? "2025-2026").replace("_", "-");
const TOP5_TM = new Set(["GB1", "ES1", "L1", "IT1", "FR1"]);

function fcLeagueId(leagueName: string | null): string | null {
  if (!leagueName) return null;
  const l = leagueName.toLowerCase();
  if (l.includes("premier league") && !l.includes("2")) return "GB1";
  if (l.includes("la liga") || l.includes("laliga") || l.includes("primera divisi")) return "ES1";
  if (l.includes("bundesliga") && !l.includes("2")) return "L1";
  if (l.includes("serie a")) return "IT1";
  if (l.includes("ligue 1")) return "FR1";
  return null;
}

function readCsv(fileName: string): Row[] {
  const filePath = path.join(DATA, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${filePath}`);
  const file = fs.readFileSync(filePath, "utf8");
  return Papa.parse<Row>(file, { header: true, skipEmptyLines: true }).data;
}

// ---------- FC records ----------
type FcRecord = {
  norms: string[];
  lasts: string[];
  dob: string | null;
  age: number | null;
  nationality: string;
  leagueId: string | null;
  ability: FcAbility;
};

function buildFcRecords(): FcRecord[] {
  const rows = readCsv(FC_CSV);
  const records: FcRecord[] = [];
  for (const row of rows) {
    const leagueId = fcLeagueId(fcString(row, "league_name"));
    if (!leagueId) continue;
    const overall = fcHeadlineNumber(row, "overall");
    if (overall === null) continue;
    const potential = fcHeadlineNumber(row, "potential");

    const longName = fcString(row, "long_name") ?? "";
    const shortName = fcString(row, "short_name") ?? "";
    const norms = Array.from(
      new Set([normalizeName(longName), normalizeName(shortName)].filter(Boolean))
    );
    if (norms.length === 0) continue;
    const lasts = Array.from(new Set(norms.map(lastToken).filter((x) => x.length >= 3)));

    const dob = dobKey(fcString(row, "dob"));
    const ageStr = fcHeadlineNumber(row, "age");
    const age = dob ? getAge(dob) : ageStr ?? null;

    const ability: FcAbility = {
      overall,
      potential: potential ?? overall,
      attributes: extractAttributes(row),
      positionRatings: extractPositionRatings(row),
      preferredFoot: fcString(row, "preferred_foot"),
      weakFoot: fcHeadlineNumber(row, "weak_foot"),
      skillMoves: fcHeadlineNumber(row, "skill_moves"),
      workRate: fcString(row, "work_rate"),
    };

    records.push({
      norms,
      lasts,
      dob,
      age,
      nationality: (fcString(row, "nationality") ?? "").toLowerCase(),
      leagueId,
      ability,
    });
  }
  return records;
}

// ---------- Matcher (DOB-first) ----------
type Matcher = {
  byName: Map<string, FcRecord[]>;
  byDob: Map<string, FcRecord[]>;
  byLast: Map<string, FcRecord[]>;
};

function pushMap(m: Map<string, FcRecord[]>, key: string, r: FcRecord) {
  const arr = m.get(key);
  if (arr) arr.push(r);
  else m.set(key, [r]);
}

function buildMatcher(records: FcRecord[]): Matcher {
  const byName = new Map<string, FcRecord[]>();
  const byDob = new Map<string, FcRecord[]>();
  const byLast = new Map<string, FcRecord[]>();
  for (const r of records) {
    for (const n of r.norms) pushMap(byName, n, r);
    for (const l of r.lasts) pushMap(byLast, l, r);
    if (r.dob) pushMap(byDob, r.dob, r);
  }
  return { byName, byDob, byLast };
}

function looseNat(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function bestByName(norm: string, cands: FcRecord[]): { rec: FcRecord | null; sim: number } {
  let rec: FcRecord | null = null;
  let sim = 0;
  for (const r of cands) {
    for (const n of r.norms) {
      const s = nameSimilarity(norm, n);
      if (s > sim) {
        sim = s;
        rec = r;
      }
    }
  }
  return { rec, sim };
}

function matchPlayer(
  norm: string,
  dob: string | null,
  age: number | null,
  nationality: string,
  leagueId: string,
  matcher: Matcher
): { record: FcRecord | null; confidence: MatchConfidence } {
  const nat = nationality.toLowerCase();
  const last = lastToken(norm);

  // Pass 1: DOB block — DOB is near-unique, so names can be loose here.
  if (dob) {
    const cands = matcher.byDob.get(dob);
    if (cands && cands.length) {
      const exact = cands.find((r) => r.norms.includes(norm));
      if (exact) return { record: exact, confidence: "high" };
      const lastMatch = cands.find((r) => last.length >= 3 && r.lasts.includes(last));
      if (lastMatch) return { record: lastMatch, confidence: "high" };
      const { rec, sim } = bestByName(norm, cands);
      if (rec && sim >= 0.5) return { record: rec, confidence: "high" };
      if (cands.length === 1) return { record: cands[0], confidence: "medium" };
    }
  }

  // Pass 2: exact normalized name.
  const exact = matcher.byName.get(norm);
  if (exact && exact.length) {
    if (dob) {
      const d = exact.find((r) => r.dob === dob);
      if (d) return { record: d, confidence: "high" };
    }
    const a = age !== null ? exact.find((r) => r.age !== null && Math.abs(r.age - age) <= 1) : undefined;
    if (a) return { record: a, confidence: "medium" };
    const nt = exact.find((r) => looseNat(r.nationality, nat));
    if (nt) return { record: nt, confidence: "medium" };
    if (exact.length === 1) return { record: exact[0], confidence: "medium" };
    const lg = exact.find((r) => r.leagueId === leagueId);
    return { record: lg ?? exact[0], confidence: "low" };
  }

  // Pass 3: last-name index + fuzzy, guarded by age to stay safe.
  if (last.length >= 3) {
    const cands = matcher.byLast.get(last);
    if (cands && cands.length) {
      const { rec, sim } = bestByName(norm, cands);
      if (rec) {
        const ageOk = age !== null && rec.age !== null && Math.abs(rec.age - age) <= 1;
        if (sim >= 0.9) return { record: rec, confidence: ageOk ? "medium" : "low" };
        if (ageOk && sim >= 0.6) return { record: rec, confidence: "low" };
      }
    }
  }

  return { record: null, confidence: "none" };
}

// ---------- Appearances (optional) ----------
function seasonOf(dateStr: string): number | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

async function aggregateMinutes(): Promise<Map<string, { minutes: number; apps: number }>> {
  const filePath = path.join(DATA, "appearances.csv");
  if (!fs.existsSync(filePath)) {
    console.log("• appearances.csv not found — skipping minutes (optional).");
    return new Map();
  }
  const tmp = new Map<string, { season: number; minutes: number; apps: number }>();
  await new Promise<void>((resolve, reject) => {
    Papa.parse<Row>(createReadStream(filePath), {
      header: true,
      skipEmptyLines: true,
      step: (res) => {
        const row = res.data;
        const pid = row.player_id;
        if (!pid) return;
        const season = seasonOf(row.date);
        if (season === null) return;
        const mins = num(row.minutes_played);
        const cur = tmp.get(pid);
        if (!cur || season > cur.season) tmp.set(pid, { season, minutes: mins, apps: 1 });
        else if (season === cur.season) {
          cur.minutes += mins;
          cur.apps += 1;
        }
      },
      complete: () => resolve(),
      error: (err) => reject(err),
    });
  });
  const out = new Map<string, { minutes: number; apps: number }>();
  for (const [pid, v] of tmp) out.set(pid, { minutes: v.minutes, apps: v.apps });
  return out;
}

// value -> estimated overall, using the data's own value/rating curve.
function makeEstimator(benchmark: ValueBenchmark): (value: number) => number | null {
  const pts = Object.entries(benchmark)
    .map(([o, v]) => ({ o: Number(o), v }))
    .sort((a, b) => a.o - b.o);
  return (value: number) => {
    if (!pts.length || value <= 0) return null;
    let best = pts[0];
    let bd = Math.abs(pts[0].v - value);
    for (const p of pts) {
      const d = Math.abs(p.v - value);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best.o;
  };
}

// ---------- Main ----------
async function main() {
  console.log("Building merged player profiles…\n");

  const clubRows = readCsv("clubs.csv");
  const clubs: MergedClub[] = [];
  const clubById = new Map<string, MergedClub>();
  for (const c of clubRows) {
    const leagueId = c.domestic_competition_id;
    if (!TOP5_TM.has(leagueId)) continue;
    const club: MergedClub = {
      clubId: c.club_id,
      name: c.name,
      leagueId,
      squadSize: c.squad_size ? num(c.squad_size) : null,
      averageAge: c.average_age ? num(c.average_age) : null,
    };
    clubs.push(club);
    clubById.set(club.clubId, club);
  }
  console.log(`• ${clubs.length} Top-5 clubs`);

  const playerRows = readCsv("players.csv");
  const maxSeason = playerRows.reduce((m, p) => Math.max(m, num(p.last_season)), 0);

  const players: MergedPlayer[] = [];
  for (const p of playerRows) {
    const club = clubById.get(p.current_club_id);
    if (!club) continue;
    if (!p.name) continue;
    // Current-season only. last_season is a start-year; Transfermarkt keeps
    // historical roster rows, so anything below maxSeason is a past/academy/
    // departed entry, not the current squad.
    if (num(p.last_season) < maxSeason) continue;
    players.push({
      playerId: p.player_id,
      name: p.name,
      dateOfBirth: p.date_of_birth || null,
      age: getAge(p.date_of_birth),
      nationality: p.country_of_citizenship || "",
      clubId: p.current_club_id,
      clubName: club.name,
      leagueId: club.leagueId,
      position: p.position || "",
      subPosition: p.sub_position || "",
      role: resolveRole(p.position || "", p.sub_position || ""),
      marketValue: num(p.market_value_in_eur),
      highestMarketValue: num(p.highest_market_value_in_eur),
      minutesLastSeason: null,
      appearancesLastSeason: null,
      fc: null,
      matchConfidence: "none",
      displayRating: null,
      ratingIsEstimated: true,
      performance: null,
    });
  }
  console.log(`• ${players.length} Top-5 active players (from ${playerRows.length} total)`);

  const fcRecords = buildFcRecords();
  console.log(`• ${fcRecords.length} Top-5 FC 26 records`);
  const matcher = buildMatcher(fcRecords);

  const minutes = await aggregateMinutes();

  const counts: Record<MatchConfidence, number> = { high: 0, medium: 0, low: 0, none: 0 };
  for (const player of players) {
    const { record, confidence } = matchPlayer(
      normalizeName(player.name),
      dobKey(player.dateOfBirth),
      player.age,
      player.nationality,
      player.leagueId,
      matcher
    );
    player.fc = record ? record.ability : null;
    player.matchConfidence = confidence;
    counts[confidence]++;
    const m = minutes.get(player.playerId);
    if (m) {
      player.minutesLastSeason = m.minutes;
      player.appearancesLastSeason = m.apps;
    }
  }

  // Value benchmark (matched players only), then estimator for the rest.
  const byOverall = new Map<number, number[]>();
  for (const p of players) {
    if (p.fc && p.marketValue > 0) {
      const key = Math.round(p.fc.overall);
      const arr = byOverall.get(key);
      if (arr) arr.push(p.marketValue);
      else byOverall.set(key, [p.marketValue]);
    }
  }
  const benchmark: ValueBenchmark = {};
  for (const [ovr, vals] of byOverall) {
    const m = median(vals);
    if (m !== null) benchmark[String(ovr)] = Math.round(m);
  }
  const estimate = makeEstimator(benchmark);

  // Give EVERY player a rating.
  let estimated = 0;
  for (const p of players) {
    if (p.fc) {
      p.displayRating = Math.round(p.fc.overall);
      p.ratingIsEstimated = false;
    } else {
      p.displayRating = estimate(p.marketValue);
      p.ratingIsEstimated = true;
      if (p.displayRating !== null) estimated++;
    }
  }

  // FBref performance layer (real output data) — optional but recommended.
  let perfMatched = 0;
  const fbrefPath = path.join(DATA, FBREF_CSV);
  if (fs.existsSync(fbrefPath)) {
    const perfIndex = buildPerfIndex(readCsv(FBREF_CSV));
    for (const p of players) {
      const year = p.dateOfBirth ? p.dateOfBirth.slice(0, 4) : null;
      const perf = matchPerformance(normalizeName(p.name), year, p.leagueId, perfIndex, SEASON);
      p.performance = perf;
      if (perf) perfMatched++;
    }
    console.log(`• FBref performance (${SEASON}) matched: ${perfMatched}/${players.length}`);
  } else {
    console.log(`• ${FBREF_CSV} not found — skipping performance layer (optional).`);
  }

  // Squad prune: keep genuine current-squad members. A player stays if he
  // played in 2025-26 FBref OR carries a real market value (>= €1M). This drops
  // academy filler and loaned-out players whose last_season is still current.
  const MIN_VALUE_IF_NO_PERF = 1_000_000;
  const activePlayers = players.filter(
    (p) => p.performance !== null || p.marketValue >= MIN_VALUE_IF_NO_PERF
  );
  const removed = players.length - activePlayers.length;

  // Keep only clubs that actually have an active squad (clubs.csv contains
  // teams that were in a Top-5 league in past seasons too).
  const activeClubIds = new Set(activePlayers.map((p) => p.clubId));
  const activeClubs = clubs.filter((c) => activeClubIds.has(c.clubId));

  // League baselines: per (role:styleDimension) mean/std across the Top 5, so
  // weakness detection is relative to real peers (built offline, read at runtime).
  const buckets = new Map<string, number[]>();
  for (const p of activePlayers) {
    for (const k of STYLE_KEYS) {
      const v = styleValue(p, k);
      if (v !== null) {
        const key = `${p.role}:${k}`;
        const arr = buckets.get(key);
        if (arr) arr.push(v);
        else buckets.set(key, [v]);
      }
    }
  }
  const leagueBaselines: LeagueBaselines = {};
  for (const [key, vals] of buckets) {
    const mean = vals.reduce((s, x) => s + x, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((s, x) => s + (x - mean) ** 2, 0) / vals.length);
    leagueBaselines[key] = { mean: +mean.toFixed(4), std: +std.toFixed(4), n: vals.length };
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "players.json"), JSON.stringify(activePlayers));
  fs.writeFileSync(path.join(OUT, "clubs.json"), JSON.stringify(activeClubs));
  fs.writeFileSync(path.join(OUT, "valueBenchmark.json"), JSON.stringify(benchmark));
  fs.writeFileSync(path.join(OUT, "leagueBaselines.json"), JSON.stringify(leagueBaselines));

  const matched = counts.high + counts.medium + counts.low;
  const rate = ((matched / players.length) * 100).toFixed(1);
  console.log("\nMatch results:");
  console.log(`  high:   ${counts.high}`);
  console.log(`  medium: ${counts.medium}`);
  console.log(`  low:    ${counts.low}`);
  console.log(`  none:   ${counts.none}  (of these, ${estimated} got an estimated rating)`);
  console.log(`  match rate: ${rate}%`);
  console.log(`\nWrote merged data to ${OUT}`);
  console.log(`League baselines computed: ${Object.keys(leagueBaselines).length} (role:dimension) cells`);
  console.log(
    `Final active squad players: ${activePlayers.length} ` +
      `(pruned ${removed} academy/loan/no-value from ${players.length})`
  );
  if (matched / players.length < 0.7) {
    console.log(
      "\n⚠ Still low. Confirm FC header names in src/lib/fc/columns.ts — especially " +
        "dob (matching now relies on it) and long_name/short_name/league_name."
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
