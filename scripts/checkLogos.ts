// Run: npx tsx scripts/checkLogos.ts
// Reports how many of YOUR clubs resolve to a real logo, and lists the misses.
import { loadMergedClubs } from "../src/lib/data/loadMerged";
import { logoUrlFor } from "../src/lib/logos";
const clubs = loadMergedClubs();
const miss: string[] = [];
let hit = 0;
for (const c of clubs) (logoUrlFor(c.name) ? hit++ : miss.push(`${c.name} [${c.leagueId}]`));
console.log(`Logos matched: ${hit}/${clubs.length}`);
if (miss.length) { console.log("\nNo crest (shows monogram):"); miss.sort().forEach((m) => console.log("  " + m)); }
