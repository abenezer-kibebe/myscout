// src/lib/positions.ts — human position code for player badges
import type { Role } from "@/lib/types";
const SUB: Record<string, string> = {
  "goalkeeper": "GK",
  "centre-back": "CB", "center-back": "CB", "central defender": "CB",
  "left-back": "LB", "right-back": "RB",
  "defensive midfield": "CDM", "central midfield": "CM", "attacking midfield": "CAM",
  "left midfield": "LM", "right midfield": "RM",
  "left winger": "LW", "right winger": "RW",
  "second striker": "SS", "centre-forward": "ST", "center-forward": "ST", "striker": "ST",
};
const ROLE: Record<Role, string> = {
  GK: "GK", CB: "CB", FB: "RB", DM: "CDM", CM: "CM", AM: "CAM", W: "W", CF: "ST",
};
export function posCode(subPosition: string | null | undefined, role: Role): string {
  if (subPosition) {
    const k = subPosition.trim().toLowerCase();
    if (SUB[k]) return SUB[k];
  }
  return ROLE[role] ?? role;
}
