// src/app/page.tsx
import { loadMergedPlayers, loadMergedClubs } from "@/lib/data/loadMerged";
import TransferAnalyzer from "@/components/TransferAnalyzer";
import type { ClubOption, PlayerOption } from "@/lib/types";

export default function Home() {
  const clubs: ClubOption[] = loadMergedClubs()
    .map((c) => ({ id: c.clubId, name: c.name, leagueId: c.leagueId }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const players: PlayerOption[] = loadMergedPlayers()
    .map((p) => ({
      id: p.playerId,
      name: p.name,
      role: p.role,
      clubName: p.clubName,
      rating: p.displayRating,
      estimated: p.ratingIsEstimated,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="min-h-screen flex flex-col items-center p-8">
      <h1 className="mt-16 text-5xl font-bold">MyScout</h1>
      <p className="mt-4 text-gray-500">
        Transfer Suitability — Europe&apos;s Top 5 Leagues
      </p>
      <TransferAnalyzer clubs={clubs} players={players} />
    </main>
  );
}
