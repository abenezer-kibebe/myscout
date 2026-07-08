// src/lib/feasibility/estimate.ts
// Transfer FEASIBILITY — a separate question from suitability. Re-coded against
// real transfer history:
//   • FEE is anchored to MARKET VALUE (backtested as the best simple predictor;
//     an age/ratio multiplier was tried and made it WORSE out-of-sample), with a
//     contract-length discount.
//   • BUDGET is the club's REAL recent spending (max & top-3 fees actually paid),
//     not a squad-value guess. Falls back to squad value when spend data is absent.
// Still an estimate (free data has no real budgets or wages) → shown as a BAND.
import type { MergedPlayer, MergedClub, FeasibilityResult, FeasibilityFactor, FeasibilityBand } from "@/lib/types";

const clamp = (x: number) => Math.max(0, Math.min(100, x));
const eur = (n: number | null) => (n == null ? "n/a" : n >= 1e6 ? `€${(n / 1e6).toFixed(0)}m` : `€${Math.round(n / 1e3)}k`);

function contractYears(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (!Number.isFinite(end)) return null;
  return (end - Date.now()) / (365.25 * 24 * 3600 * 1000);
}

// Fee ≈ market value, discounted by a short/expiring contract.
function contractFeeFactor(yrs: number | null): number {
  if (yrs === null) return 1.0;
  if (yrs <= 0) return 0.08; // out of contract — free/nominal
  if (yrs < 0.6) return 0.35;
  if (yrs < 1.1) return 0.6;
  if (yrs < 2.1) return 0.85;
  return 1.0;
}

// Buying club's single-signing capacity, from REAL recent spend when available.
function capacity(club: MergedClub): { ceiling: number | null; typical: number | null; source: string } {
  if (club.recentMaxFeeEur && club.recentMaxFeeEur > 0) {
    return { ceiling: club.recentMaxFeeEur, typical: club.recentAvgFeeEur ?? club.recentMaxFeeEur, source: "recent-spend" };
  }
  if (club.squadValueEur && club.squadValueEur > 0) {
    const c = club.squadValueEur * 0.12;
    return { ceiling: c, typical: c * 0.6, source: "squad-value" };
  }
  if (club.netTransferEur != null) {
    const c = Math.abs(club.netTransferEur) * 1.2;
    return { ceiling: c, typical: c * 0.6, source: "net-spend" };
  }
  return { ceiling: null, typical: null, source: "none" };
}

function affordabilityScore(fee: number | null, cap: { ceiling: number | null; typical: number | null }): number {
  if (fee == null || cap.ceiling == null) return 50;
  const r = fee / cap.ceiling;
  let s: number;
  if (r <= 0.5) s = 92;
  else if (r <= 0.8) s = 78;
  else if (r <= 1.0) s = 62;
  else if (r <= 1.3) s = 44;
  else if (r <= 1.8) s = 27;
  else s = 12;
  if (cap.typical && fee <= cap.typical) s = Math.min(96, s + 6); // within their normal big-deal range
  return s;
}

function contractScore(yrs: number | null): number {
  if (yrs === null) return 55;
  if (yrs <= 0) return 95;
  if (yrs < 0.6) return 88;
  if (yrs < 1.1) return 78;
  if (yrs < 2.1) return 60;
  if (yrs < 3.1) return 45;
  return 33;
}

function willingnessScore(player: MergedPlayer, seller: MergedClub | null): { score: number; note: string } {
  let s = 55;
  const notes: string[] = [];
  const decline =
    player.highestMarketValue > 0 && player.marketValue > 0 ? player.marketValue / player.highestMarketValue : null;
  if (decline != null) {
    if (decline < 0.7) { s += 15; notes.push("past his peak value"); }
    else if (decline > 0.98) { s -= 10; notes.push("at peak value"); }
  }
  if (seller?.squadValueEur != null) {
    if (seller.squadValueEur < 200e6) { s += 12; notes.push("selling club isn't among the wealthiest"); }
    else if (seller.squadValueEur > 700e6) { s -= 12; notes.push("wealthy selling club under no pressure"); }
  }
  return { score: clamp(s), note: notes.join("; ") || "typical selling-club dynamics" };
}

function bandFor(score: number): FeasibilityBand {
  if (score >= 72) return "Likely";
  if (score >= 54) return "Plausible";
  if (score >= 36) return "Difficult";
  return "Unrealistic";
}

export function computeFeasibility(
  player: MergedPlayer,
  buyingClub: MergedClub,
  sellingClub: MergedClub | null
): FeasibilityResult {
  const yrs = contractYears(player.contractExpiration);
  const mv = player.marketValue > 0 ? player.marketValue : null;
  const estFee = mv != null ? mv * contractFeeFactor(yrs) : null; // fee ≈ MV × contract factor
  const cap = capacity(buyingClub);

  const afford = affordabilityScore(estFee, cap);
  const contract = contractScore(yrs);
  const willing = willingnessScore(player, sellingClub);

  const capNote =
    cap.source === "recent-spend"
      ? `their recent record signing is ${eur(cap.ceiling)} (typical big deal ${eur(cap.typical)})`
      : cap.source === "squad-value"
      ? `est. capacity ${eur(cap.ceiling)} from squad value (no spend history)`
      : cap.ceiling != null
      ? `est. capacity ${eur(cap.ceiling)}`
      : "no budget signal available";

  const factors: FeasibilityFactor[] = [
    {
      key: "affordability",
      label: "Fee affordability",
      score: afford,
      detail:
        estFee == null || cap.ceiling == null
          ? "Not enough data to compare fee to budget."
          : `Estimated fee ~${eur(estFee)} vs ${capNote}.`,
    },
    {
      key: "contract",
      label: "Contract leverage",
      score: contract,
      detail:
        yrs === null
          ? "Contract length unknown."
          : yrs <= 0
          ? "Out of contract — a free/nominal signing."
          : `${yrs.toFixed(1)} years left${yrs < 1.1 ? " — final year, weaker selling position" : yrs > 3 ? " — long deal, seller can demand a premium" : ""}.`,
    },
    { key: "willingness", label: "Selling-club willingness", score: willing.score, detail: willing.note + "." },
  ];

  const score = clamp(0.52 * afford + 0.2 * contract + 0.28 * willing.score);
  const band = bandFor(score);
  const confidence: FeasibilityResult["confidence"] =
    cap.source === "recent-spend" && mv != null && yrs !== null ? "medium" : "low";

  const summary =
    `${band} (${Math.round(score)}/100). ` +
    (estFee != null ? `Est. fee ~${eur(estFee)}. ` : "") +
    `Fee anchored to market value; budget from ${cap.source === "recent-spend" ? "the club's real recent spending" : "a squad-value proxy"}. Estimate only.`;

  return {
    score: Math.round(score),
    band,
    confidence,
    estimatedFeeEur: estFee != null ? Math.round(estFee) : null,
    estimatedBudgetEur: cap.ceiling != null ? Math.round(cap.ceiling) : null,
    factors,
    summary,
  };
}
