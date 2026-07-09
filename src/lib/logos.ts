// src/lib/logos.ts  (server-only: uses fs to see which logos exist)
import fs from "fs";
import path from "path";
import { plClubKey, type PlClubKey } from "@/lib/pl/plClubs";

export function logoSlug(name: string): string {
  return name
    .replace(/&/g, " and ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

// tokens that carry no identity — club-type affixes, years, league words
const AFFIX = new Set([
  "fc", "cf", "afc", "sc", "ac", "as", "ss", "ssc", "rc", "rcd", "cd", "ud", "cp",
  "sv", "vfl", "vfb", "bsc", "tsg", "ogc", "us", "usl", "aj", "rb", "calcio", "club",
  "de", "the", "1", "04", "05", "1846", "1899", "1900", "1907", "balompie", "balompié",
]);
function coreSlug(name: string): string {
  const parts = logoSlug(name).split("-").filter((t) => t && !AFFIX.has(t) && !/^\d+$/.test(t));
  return parts.join("-") || logoSlug(name);
}

// PL canonical key -> known logo filename slug (guarantees all 20 PL clubs)
const PL_LOGO: Record<PlClubKey, string> = {
  arsenal: "arsenal-fc", aston_villa: "aston-villa", bournemouth: "afc-bournemouth",
  brentford: "brentford-fc", brighton: "brighton-and-hove-albion", burnley: "burnley-fc",
  chelsea: "chelsea-fc", crystal_palace: "crystal-palace", everton: "everton-fc",
  fulham: "fulham-fc", leeds: "leeds-united", liverpool: "liverpool-fc",
  man_city: "manchester-city", man_united: "manchester-united", newcastle: "newcastle-united",
  nottingham_forest: "nottingham-forest", sunderland: "sunderland-afc",
  tottenham: "tottenham-hotspur", west_ham: "west-ham-united", wolves: "wolverhampton-wanderers",
};

type Maps = { bySlug: Map<string, string>; byCore: Map<string, string>; byToken: Map<string, string | null> };
let MAPS: Maps | null = null;
function maps(): Maps {
  if (MAPS) return MAPS;
  const bySlug = new Map<string, string>();
  const byCore = new Map<string, string>();
  const byToken = new Map<string, string | null>(); // distinctive token -> slug (null = ambiguous)
  try {
    const dir = path.join(process.cwd(), "public", "logos");
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".png")) continue;
      const slug = f.slice(0, -4);
      bySlug.set(slug, slug);
      const c = coreSlug(slug);
      if (!byCore.has(c)) byCore.set(c, slug);
      for (const tok of c.split("-")) {
        if (tok.length < 5) continue; // skip tiny tokens
        byToken.set(tok, byToken.has(tok) ? null : slug); // seen twice -> ambiguous
      }
    }
  } catch { /* no logos dir */ }
  MAPS = { bySlug, byCore, byToken };
  return MAPS;
}

// Returns "/logos/<slug>.png" or null. Robust to FC/Calcio/short-name variants.
export function logoUrlFor(name: string): string | null {
  const { bySlug, byCore, byToken } = maps();
  const key = plClubKey(name);
  if (key && PL_LOGO[key] && bySlug.has(PL_LOGO[key])) return `/logos/${PL_LOGO[key]}.png`;
  const full = logoSlug(name);
  if (bySlug.has(full)) return `/logos/${full}.png`;
  const core = coreSlug(name);
  if (byCore.has(core)) return `/logos/${byCore.get(core)}.png`;
  // last resort: a single distinctive token that maps unambiguously to one crest
  const toks = core.split("-").filter((t) => t.length >= 5);
  for (const t of toks) {
    const hit = byToken.get(t);
    if (hit) return `/logos/${hit}.png`;
  }
  return null;
}
