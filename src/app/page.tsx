// src/app/page.tsx
import { loadMergedPlayers, loadMergedClubs } from "@/lib/data/loadMerged";
import TransferAnalyzer from "@/components/TransferAnalyzer";
import type { ClubOption, PlayerOption } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function Home() {
  const clubs: ClubOption[] = loadMergedClubs()
    .map((c) => ({ id: c.clubId, name: c.name, leagueId: c.leagueId }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const players: PlayerOption[] = loadMergedPlayers()
    .map((p) => ({ id: p.playerId, name: p.name, role: p.role, clubName: p.clubName, rating: p.displayRating, estimated: p.ratingIsEstimated }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-50 px-4 pb-16">
      <header className="mt-12 flex flex-col items-center text-center">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 font-black text-white">M</div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            MyScout: <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Transfer Potential</span>
          </h1>
        </div>
        <p className="mt-2 text-sm font-medium text-slate-400">Powered by TransfersRoom</p>
      </header>
      <TransferAnalyzer clubs={clubs} players={players} />
    </main>
  );
}
