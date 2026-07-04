import type { Player } from "@/lib/loadPlayers";

export function calculatePositionNeed(
  targetPlayer: Player,
  allPlayers: Player[]
): number {
  const samePositionPlayers = allPlayers.filter(
    (player) => player.sub_position === targetPlayer.sub_position
  );

  if (samePositionPlayers.length <= 2) return 95;
  if (samePositionPlayers.length <= 4) return 80;
  if (samePositionPlayers.length <= 6) return 65;

  return 45;
}