"use client";

import { useState } from "react";
import type { Player } from "@/lib/loadPlayers";
import type { Club } from "@/lib/loadClubs";
import { analyzeTransfer } from "@/lib/analysis/analyzeTransfer";

type Props = {
  players: Player[];
  clubs: Club[];
};

export default function TransferAnalyzer({ players, clubs }: Props) {
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.player_id);
  const [selectedClubId, setSelectedClubId] = useState(clubs[0]?.club_id);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const selectedPlayer = players.find(
    (player) => player.player_id === selectedPlayerId
  );

  const selectedClub = clubs.find(
    (club) => club.club_id === selectedClubId
  );

  const analysis =
    hasAnalyzed && selectedPlayer && selectedClub
      ? analyzeTransfer(selectedPlayer, selectedClub)
      : null;

  function handleAnalyze() {
    setHasAnalyzed(true);
  }

  function handlePlayerChange(playerId: string) {
    setSelectedPlayerId(playerId);
    setHasAnalyzed(false);
  }

  function handleClubChange(clubId: string) {
    setSelectedClubId(clubId);
    setHasAnalyzed(false);
  }

  return (
    <section className="mt-10 w-full max-w-2xl rounded-xl border p-6">
      <div className="grid gap-6">
        <div>
          <label className="font-semibold">Select Club</label>

          <select
            className="mt-2 w-full rounded-lg border p-3"
            value={selectedClubId}
            onChange={(event) => handleClubChange(event.target.value)}
          >
            {clubs.map((club) => (
              <option key={club.club_id} value={club.club_id}>
                {club.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-semibold">Select Player</label>

          <select
            className="mt-2 w-full rounded-lg border p-3"
            value={selectedPlayerId}
            onChange={(event) => handlePlayerChange(event.target.value)}
          >
            {players.map((player) => (
              <option key={player.player_id} value={player.player_id}>
                {player.name} — {player.sub_position}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleAnalyze}
          className="rounded-lg bg-black px-6 py-3 text-white"
        >
          Analyze Transfer
        </button>

        {!hasAnalyzed && (
          <p className="text-sm text-gray-500">
            Select a club and player, then click Analyze Transfer.
          </p>
        )}

        {selectedPlayer && selectedClub && analysis && (
          <div className="rounded-xl border p-6">
            <h2 className="text-2xl font-bold">
              {selectedPlayer.name} → {selectedClub.name}
            </h2>

            <p className="mt-4 text-5xl font-bold">
              {analysis.suitability}%
            </p>

            <p className="text-gray-500">
              Transfer Suitability Score
            </p>

            <div className="mt-4 space-y-1 text-sm text-gray-600">
              <p>Age Fit: {analysis.ageFit}</p>
              <p>Financial Compatibility: {analysis.financialCompatibility}</p>
              <p>Potential: {analysis.potential}</p>
            </div>

            <div className="mt-6 text-sm text-gray-600">
              <p>Player Position: {selectedPlayer.sub_position}</p>
              <p>Player Market Value: €{selectedPlayer.market_value_in_eur}</p>
              <p>Club Squad Size: {selectedClub.squad_size}</p>
              <p>Club Average Age: {selectedClub.average_age}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}