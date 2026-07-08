// src/lib/matching/nameMatch.ts
// Pure string helpers for the offline cross-dataset join.

// Letters that do NOT decompose under NFD and would otherwise survive the
// diacritic strip (ø, ł, đ, ß, æ, œ, ...). Mapped to Latin equivalents so
// "Højlund" -> "hojlund", "Łukasz" -> "lukasz", etc.
const TRANSLIT: Record<string, string> = {
  ø: "o",
  œ: "oe",
  æ: "ae",
  ß: "ss",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
  ħ: "h",
  ı: "i",
  ĸ: "k",
  ŀ: "l",
  ŉ: "n",
  ſ: "s",
  ŧ: "t",
};

export function normalizeName(s: string): string {
  const lowered = s.toLowerCase();
  let out = "";
  for (const ch of lowered) out += TRANSLIT[ch] ?? ch;
  return out
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sortTokens(s: string): string {
  return s.split(" ").filter(Boolean).sort().join(" ");
}

export function lastToken(norm: string): string {
  const parts = norm.split(" ").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const clean = s.replace(/\s+/g, "");
  for (let i = 0; i < clean.length - 1; i++) {
    const g = clean.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

export function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  for (const [g, countA] of A) {
    const countB = B.get(g);
    if (countB) overlap += Math.min(countA, countB);
  }
  const total =
    [...A.values()].reduce((x, y) => x + y, 0) +
    [...B.values()].reduce((x, y) => x + y, 0);
  return (2 * overlap) / total;
}

export function nameSimilarity(a: string, b: string): number {
  return Math.max(dice(a, b), dice(sortTokens(a), sortTokens(b)));
}

export function dobKey(s: string | null | undefined): string | null {
  if (!s) return null;
  const cleaned = s.replace(/\//g, "-").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : null;
}
