// src/app/page.tsx
import Image from "next/image";
import { loadMergedPlayers, loadMergedClubs } from "@/lib/data/loadMerged";
import TransferAnalyzer from "@/components/TransferAnalyzer";
import { logoUrlFor } from "@/lib/logos";
import { posCode } from "@/lib/positions";
import type { ClubOption, PlayerOption } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function Home() {
  const clubs: ClubOption[] = loadMergedClubs()
    .map((c) => ({ id: c.clubId, name: c.name, leagueId: c.leagueId, logoUrl: logoUrlFor(c.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const players: PlayerOption[] = loadMergedPlayers()
    .map((p) => ({ id: p.playerId, name: p.name, role: p.role, clubName: p.clubName, rating: p.displayRating, estimated: p.ratingIsEstimated, pos: posCode(p.subPosition, p.role) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="flex min-h-screen flex-col items-center px-4 pb-8">
      <header className="mt-6 flex items-center gap-3">
        <Image src="/myscout-logo.png" alt="MyScout" width={54} height={54} className="drop-shadow-[0_0_18px_rgba(139,92,246,0.35)]" priority />
        <div className="leading-tight">
          <h1 className="font-display text-2xl font-bold text-white">
            MyScout: <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Transfer Potential</span>
          </h1>
          <p className="text-xs font-medium tracking-wide text-slate-400">Powered by TransfersRoom</p>
        </div>
      </header>
      <TransferAnalyzer clubs={clubs} players={players} />
    </main>
  );
}
