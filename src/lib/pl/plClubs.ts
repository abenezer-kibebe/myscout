// src/lib/pl/plClubs.ts
// Canonicalizes the 20 Premier League clubs across three naming conventions:
// Transfermarkt ("Manchester City Football Club"), the team-stats file
// ("Manchester Utd", "Nott'ham Forest") and the Sofascore player file
// ("Liverpool FC", "Brighton &amp; Hove Albion"). Returns a stable key, or
// null for any club that isn't in the Premier League.

export type PlClubKey =
  | "arsenal" | "aston_villa" | "bournemouth" | "brentford" | "brighton"
  | "burnley" | "chelsea" | "crystal_palace" | "everton" | "fulham"
  | "leeds" | "liverpool" | "man_city" | "man_united" | "newcastle"
  | "nottingham_forest" | "sunderland" | "tottenham" | "west_ham" | "wolves";

export const PL_CLUB_NAMES: Record<PlClubKey, string> = {
  arsenal: "Arsenal", aston_villa: "Aston Villa", bournemouth: "Bournemouth",
  brentford: "Brentford", brighton: "Brighton & Hove Albion", burnley: "Burnley",
  chelsea: "Chelsea", crystal_palace: "Crystal Palace", everton: "Everton",
  fulham: "Fulham", leeds: "Leeds United", liverpool: "Liverpool",
  man_city: "Manchester City", man_united: "Manchester United",
  newcastle: "Newcastle United", nottingham_forest: "Nottingham Forest",
  sunderland: "Sunderland", tottenham: "Tottenham Hotspur",
  west_ham: "West Ham United", wolves: "Wolverhampton Wanderers",
};

function norm(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z ]/g, " ") // drop apostrophes/punctuation ("nott'ham" -> "nott ham")
    .replace(/\b(fc|afc|football club|association|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Ordered token rules — Manchester must be disambiguated before the generic pass.
export function plClubKey(raw: string): PlClubKey | null {
  const n = norm(raw);
  if (!n) return null;
  const words = new Set(n.split(" ").filter(Boolean));
  // whole-word match for single tokens; substring only for multi-word targets
  const has = (...ts: string[]) => ts.some((t) => (t.includes(" ") ? n.includes(t) : words.has(t)));

  if (has("manchester", "man")) {
    if (has("city")) return "man_city";
    if (has("united", "utd")) return "man_united";
  }
  if (has("arsenal")) return "arsenal";
  if (has("aston", "villa")) return "aston_villa";
  if (has("bournemouth")) return "bournemouth";
  if (has("brentford")) return "brentford";
  if (has("brighton")) return "brighton";
  if (has("burnley")) return "burnley";
  if (has("chelsea")) return "chelsea";
  if (has("crystal", "palace")) return "crystal_palace";
  if (has("everton")) return "everton";
  if (has("fulham")) return "fulham";
  if (has("leeds")) return "leeds";
  if (has("liverpool")) return "liverpool";
  if (has("newcastle")) return "newcastle";
  if (has("nott", "nottingham")) return "nottingham_forest";
  if (has("sunderland")) return "sunderland";
  if (has("tottenham", "spurs")) return "tottenham";
  if (has("west ham")) return "west_ham";
  if (has("wolves", "wolverhampton")) return "wolves";
  return null;
}
