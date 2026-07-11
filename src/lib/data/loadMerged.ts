import fs from "fs";
import path from "path";
import type {
  MergedClub,
  MergedPlayer,
  ValueBenchmark,
  LeagueBaselines,
} from "@/lib/types";

function readJson<T>(fileName: string): T {
  const filePath = path.join(process.cwd(), "data", "merged", fileName);
  const file = fs.readFileSync(filePath, "utf8");

  return JSON.parse(file) as T;
}

export function loadMergedPlayers(): MergedPlayer[] {
  return readJson<MergedPlayer[]>("players.json");
}

export function loadMergedClubs(): MergedClub[] {
  return readJson<MergedClub[]>("clubs.json");
}

export function loadValueBenchmark(): ValueBenchmark {
  return readJson<ValueBenchmark>("valueBenchmark.json");
}

export function loadLeagueBaselines(): LeagueBaselines {
  return readJson<LeagueBaselines>("leagueBaselines.json");
}
