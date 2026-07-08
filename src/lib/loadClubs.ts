import fs from "fs";
import path from "path";
import Papa from "papaparse";

export type Club = {
  club_id: string;
  name: string;
  domestic_competition_id: string;
  squad_size: string;
  average_age: string;
  total_market_value: string;
};

export function loadClubs(): Club[] {
  const filePath = path.join(process.cwd(), "data", "clubs.csv");
  const file = fs.readFileSync(filePath, "utf8");

  const parsed = Papa.parse<Club>(file, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data;
}