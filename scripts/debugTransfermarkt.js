const fs = require("fs");
const Papa = require("papaparse");

// Read players.csv
const players = Papa.parse(
  fs.readFileSync("data/players.csv", "utf8"),
  {
    header: true,
    skipEmptyLines: true,
  }
).data;

// Count last_season values
const bySeason = {};

for (const player of players) {
  const season = player.last_season || "(blank)";
  bySeason[season] = (bySeason[season] || 0) + 1;
}

console.log("========== LAST SEASON DISTRIBUTION ==========\n");

Object.keys(bySeason)
  .sort()
  .forEach((season) => {
    console.log(`${season}: ${bySeason[season]}`);
  });

// Manchester City squad
const cityPlayers = players.filter(
  (player) =>
    player.current_club_name &&
    player.current_club_name.includes("Manchester City")
);

console.log("\n========== MANCHESTER CITY ==========\n");

console.log(`Players found: ${cityPlayers.length}\n`);

cityPlayers.forEach((player) => {
  console.log(
    `${player.name} | last_season=${player.last_season}`
  );
});