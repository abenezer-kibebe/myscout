import { loadPlayers } from "@/lib/loadPlayers";

export default function Home() {
  const players = loadPlayers();
  const firstPlayer = players[0];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold">MyScout</h1>

      <p className="mt-4 text-gray-500">
        AI Football Transfer Suitability Platform
      </p>

      <div className="mt-10 rounded-xl border p-6 w-full max-w-md">
        <h2 className="text-2xl font-semibold">{firstPlayer.name}</h2>

        <p className="mt-2">Position: {firstPlayer.position}</p>
        <p>Role: {firstPlayer.sub_position}</p>
        <p>Market Value: €{firstPlayer.market_value_in_eur}</p>
      </div>
    </main>
  );
}