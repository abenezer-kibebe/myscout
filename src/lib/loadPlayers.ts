import fs from "fs";
import path from "path";
import Papa from "papaparse";

export type Player = {
  player_id: string;
  name: string;
  position: string;
  sub_position: string;
  market_value_in_eur: string;
};

export function loadPlayers(): Player[] {
  const filePath = path.join(process.cwd(), "data", "players.csv");
  const file = fs.readFileSync(filePath, "utf8");

  const parsed = Papa.parse<Player>(file, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data;
}