import type { Player } from "@/lib/loadPlayers";
import type { Club } from "@/lib/loadClubs";

export function calculatePositionNeed(
  targetPlayer: Player,
  selectedClub: Club,
  allPlayers: Player[]
): number {
  const clubPlayers = allPlayers.filter(
    (player) => player.current_club_id === selectedClub.club_id
  );

  const sameRolePlayers = clubPlayers.filter(
    (player) => player.sub_position === targetPlayer.sub_position
  );

  const count = sameRolePlayers.length;

  if (count === 0) return 100;
  if (count === 1) return 90;
  if (count === 2) return 75;
  if (count === 3) return 55;

  return 35;
}