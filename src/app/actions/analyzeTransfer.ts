// src/app/actions/analyzeTransfer.ts
"use server";
import {
  loadMergedPlayers,
  loadMergedClubs,
  loadValueBenchmark,
  loadLeagueBaselines,
} from "@/lib/data/loadMerged";
import { analyzeTransfer } from "@/lib/analysis/analyzeTransfer";
import { computeFeasibility } from "@/lib/feasibility/estimate";
import { logoUrlFor } from "@/lib/logos";
import { posCode } from "@/lib/positions";
import type { AnalysisResult } from "@/lib/types";

export async function runAnalysis(
  clubId: string,
  playerId: string
): Promise<AnalysisResult | { error: string }> {
  const players = loadMergedPlayers();
  const clubs = loadMergedClubs();
  const benchmark = loadValueBenchmark();
  const baselines = loadLeagueBaselines();

  const player = players.find((p) => p.playerId === playerId);
  const club = clubs.find((c) => c.clubId === clubId);
  if (!player) return { error: "Player not found." };
  if (!club) return { error: "Club not found." };
  if (player.clubId === club.clubId) {
    return { error: `${player.name} already plays for ${club.name} — pick a different club to analyze a transfer.` };
  }

  const squad = players.filter((p) => p.clubId === club.clubId);
  const result = analyzeTransfer(player, club, squad, benchmark, baselines);
  const sellingClub = clubs.find((c) => c.clubId === player.clubId) ?? null;
  result.feasibility = computeFeasibility(player, club, sellingClub);
  // POTENTIAL = 60% suitability + 40% feasibility (how good a fit x how gettable).
  result.potential = Math.round(0.6 * result.suitability + 0.4 * result.feasibility.score);
  result.meta.clubLogoUrl = logoUrlFor(club.name);
  result.meta.playerPosCode = posCode(player.subPosition, player.role);
  return result;
}
