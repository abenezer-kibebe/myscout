// src/lib/pl/advancedStats.ts
// Reads the Sofascore Premier League player file and returns a lookup of real
// advanced stats keyed by normalized player name. Volume metrics are converted
// to per-90; percentages and rating are passed through. PL only.
import fs from "fs";
import Papa from "papaparse";
import type { AdvancedStats } from "@/lib/types";
import { normalizeName } from "@/lib/matching/nameMatch";

const MIN_MINUTES = 360; // below this, per-90 rates are too noisy to trust

function n(row: Record<string, string>, key: string): number {
  const v = Number(row[key]);
  return Number.isFinite(v) ? v : 0;
}
function nOrNull(row: Record<string, string>, key: string): number | null {
  const raw = row[key];
  if (raw === undefined || raw === "") return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}

export type AdvancedIndex = {
  byName: Map<string, AdvancedStats>;
  teamByName: Map<string, string>; // normalized name -> raw team_name (disambiguation)
};

export function buildAdvancedIndex(csvPath: string, season = "2025-2026"): AdvancedIndex {
  const text = fs.readFileSync(csvPath, "utf8");
  const rows = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
  }).data;

  const byName = new Map<string, AdvancedStats>();
  const teamByName = new Map<string, string>();

  for (const row of rows) {
    const name = row["player_name"];
    if (!name) continue;
    const minutes = n(row, "minutesPlayed");
    if (minutes < MIN_MINUTES) continue;
    const p90 = minutes / 90;
    const per = (key: string) => n(row, key) / p90;

    const stats: AdvancedStats = {
      source: "sofascore-pl",
      season,
      minutes,
      appearances: n(row, "appearances"),
      rating: nOrNull(row, "rating"),
      goals90: per("goals"),
      xG90: per("expectedGoals"),
      assists90: per("assists"),
      xA90: per("expectedAssists"),
      keyPasses90: per("keyPasses"),
      bigChancesCreated90: per("bigChancesCreated"),
      bigChancesMissed90: per("bigChancesMissed"),
      shots90: per("totalShots"),
      shotsOnTarget90: per("shotsOnTarget"),
      dribbles90: per("successfulDribbles"),
      finalThirdPasses90: per("accurateFinalThirdPasses"),
      tackles90: per("tackles"),
      interceptions90: per("interceptions"),
      ballRecovery90: per("ballRecovery"),
      clearances90: per("clearances"),
      blocks90: per("outfielderBlocks"),
      possWonAttThird90: per("possessionWonAttThird"),
      dribbledPast90: per("dribbledPast"),
      aerialWon90: per("aerialDuelsWon"),
      touches90: per("touches"),
      dispossessed90: per("dispossessed"),
      passAccuracy: nOrNull(row, "accuratePassesPercentage"),
      aerialWonPct: nOrNull(row, "aerialDuelsWonPercentage"),
      saves90: minutes > 0 ? per("saves") : null,
      goalsPrevented90: nOrNull(row, "goalsPrevented") === null ? null : per("goalsPrevented"),
      savePct: (() => {
        const s = n(row, "saves");
        const conceded = n(row, "goals"); // not exposed for GK directly; leave rough
        return s + conceded > 0 ? (100 * s) / (s + conceded) : null;
      })(),
    };

    const key = normalizeName(name);
    byName.set(key, stats);
    teamByName.set(key, row["team_name"] ?? "");
  }
  return { byName, teamByName };
}
