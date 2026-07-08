// src/lib/pl/clubDna.ts
// Derives each Premier League club's playing identity from the team stats files
// (possession, attacking npxG, defensive xGA conceded, progression style). The
// season file has a 2-row category/stat header, so columns are read by index.
import fs from "fs";
import Papa from "papaparse";
import type { ClubDna } from "@/lib/types";
import { plClubKey, PL_CLUB_NAMES } from "./plClubs";

function f(v: string | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

// Column order in team_season_stats.csv data rows (after the 3 header rows):
// 0 league,1 season,2 team,3 players_used,4 Age,5 Poss, ...
// 18 xG,19 npxG,20 xAG,21 npxG+xAG, 22 PrgC,23 PrgP, ... 32 npxG/90
const C = { team: 2, poss: 5, mp: 6, npxG: 19, prgC: 22, prgP: 23, npxG90: 32 };

export function buildClubDna(seasonPath: string, matchPath: string): Map<string, ClubDna> {
  const seasonRows = fs
    .readFileSync(seasonPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.split(","))
    .slice(3)
    .filter((r) => r.length > C.npxG90 && r[C.team]);

  // Defensive xGA per game from the match file (played games only).
  const matchRows = Papa.parse<Record<string, string>>(fs.readFileSync(matchPath, "utf8"), {
    header: true,
    skipEmptyLines: true,
  }).data;
  const xgaSum = new Map<string, number>();
  const games = new Map<string, number>();
  for (const m of matchRows) {
    if (!m.xGA || m.xGA.trim() === "") continue; // future/unplayed fixtures are blank
    const k = plClubKey(m.team);
    if (!k) continue;
    xgaSum.set(k, (xgaSum.get(k) ?? 0) + f(m.xGA));
    games.set(k, (games.get(k) ?? 0) + 1);
  }

  const dna = new Map<string, ClubDna>();
  for (const r of seasonRows) {
    const key = plClubKey(r[C.team]);
    if (!key) continue;
    const matchGames = games.get(key) ?? 0;
    const seasonGames = f(r[C.mp]); // games behind possession/xG (fuller than match file)
    const possession = f(r[C.poss]);
    const prgPass = f(r[C.prgP]);
    const prgCarry = f(r[C.prgC]);
    const progressionStyle: ClubDna["progressionStyle"] = prgPass > prgCarry * 2.2 ? "pass" : "carry";
    const tempo: ClubDna["tempo"] = possession >= 55 ? "possession" : possession <= 46 ? "direct" : "balanced";
    const attackXg90 = f(r[C.npxG90]);
    const defenceXga90 = matchGames > 0 ? +(xgaSum.get(key)! / matchGames).toFixed(2) : 0;

    dna.set(key, {
      key,
      name: PL_CLUB_NAMES[key as keyof typeof PL_CLUB_NAMES] ?? r[C.team],
      games: seasonGames,
      possession,
      attackXg90,
      defenceXga90,
      prgPass,
      prgCarry,
      progressionStyle,
      tempo,
      label: `${tempo} · ${progressionStyle}-progression`,
      source: "pl-team-2025-26",
    });
  }
  return dna;
}
