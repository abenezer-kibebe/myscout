// src/app/actions/analyzeTransfer.ts
"use server";
// Runs on the SERVER when Analyze is clicked. The client sends only two ids;
// the merged dataset never travels to the browser.
import {
  loadMergedPlayers,
  loadMergedClubs,
  loadValueBenchmark,
} from "@/lib/data/loadMerged";
import { analyzeTransfer } from "@/lib/analysis/analyzeTransfer";
import type { AnalysisResult } from "@/lib/types";

export async function runAnalysis(
  clubId: string,
  playerId: string
): Promise<AnalysisResult | { error: string }> {
  const players = loadMergedPlayers();
  const clubs = loadMergedClubs();
  const benchmark = loadValueBenchmark();

  const player = players.find((p) => p.playerId === playerId);
  const club = clubs.find((c) => c.clubId === clubId);
  if (!player) return { error: "Player not found." };
  if (!club) return { error: "Club not found." };

  const squad = players.filter((p) => p.clubId === club.clubId);
  return analyzeTransfer(player, club, squad, benchmark);
}
