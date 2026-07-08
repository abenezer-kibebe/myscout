const fs = require("fs");
const Papa = require("papaparse");

const norm = (s) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const fbref = Papa.parse(fs.readFileSync("data/players_data-2025_2026.csv", "utf8"), {
  header: true, skipEmptyLines: true,
}).data;

const fbNames = new Set();
const fbNameYear = new Set();
for (const r of fbref) {
  const n = norm(r.Player);
  if (!n) continue;
  fbNames.add(n);
  if (r.Born) fbNameYear.add(n + "|" + r.Born.trim());
}

const players = JSON.parse(fs.readFileSync("data/merged/players.json", "utf8"));
const noPerf = players.filter((x) => !x.performance);

let inByNameYear = 0, inByNameOnly = 0, notInFbref = 0;
const realMisses = [];
for (const p of noPerf) {
  const n = norm(p.name);
  const yr = p.dateOfBirth ? p.dateOfBirth.slice(0, 4) : null;
  if (yr && fbNameYear.has(n + "|" + yr)) { inByNameYear++; realMisses.push(p.name + " (" + p.clubName + ")"); }
  else if (fbNames.has(n)) { inByNameOnly++; }
  else { notInFbref++; }
}

console.log("no-performance players:", noPerf.length);
console.log("  A) name+year IS in FBref  -> REAL MISS:", inByNameYear);
console.log("  B) name in FBref, diff year -> likely diff player/typo:", inByNameOnly);
console.log("  C) not in FBref at all     -> didn't play 25-26 (correct):", notInFbref);
console.log("\nSample of category A (real misses to fix):", realMisses.slice(0, 20));