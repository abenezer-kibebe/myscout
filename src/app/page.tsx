import { loadPlayers } from "@/lib/loadPlayers";
import { loadClubs } from "@/lib/loadClubs";
import TransferAnalyzer from "@/components/TransferAnalyzer";

export default function Home() {
  const players = loadPlayers()
    .filter((player) => player.market_value_in_eur)
    .slice(0, 300);

  const clubs = loadClubs()
    .filter((club) => club.name)
    .slice(0, 100);

  return (
    <main className="min-h-screen flex flex-col items-center p-8">
      <h1 className="mt-16 text-5xl font-bold">MyScout</h1>

      <p className="mt-4 text-gray-500">
        AI Football Transfer Suitability Platform
      </p>

      <TransferAnalyzer players={players} clubs={clubs} />
    </main>
  );
}