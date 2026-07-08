// src/components/TransferAnalyzer.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import type { ClubOption, PlayerOption, AnalysisResult, FactorOutput, Confidence, RadarPoint } from "@/lib/types";
import { runAnalysis } from "@/app/actions/analyzeTransfer";

type Props = { clubs: ClubOption[]; players: PlayerOption[] };

/* ---------------- palette ----------------
   ink   = slate-900   surface = white/slate-50
   POTENTIAL = violet   SUITABILITY = emerald   FEASIBILITY = amber      */
const CONF_STYLE: Record<Confidence, string> = {
  high: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-200 text-slate-600",
};

/* ---------------- small UI atoms ---------------- */
function Crest({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-inner"
      style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${h} 55% 42%), hsl(${(h + 40) % 360} 55% 30%))`, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

function RadarChart({ points, color }: { points?: RadarPoint[]; color: string }) {
  const pts = points ?? [];
  if (pts.length < 3) return null; // a radar needs at least 3 axes
  const size = 260, cx = size / 2, cy = size / 2, R = 92;
  const N = pts.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const at = (i: number, r: number) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r] as const;
  const poly = pts.map((p, i) => at(i, (Math.max(0, Math.min(100, p.value)) / 100) * R).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-64 w-64">
      {rings.map((r, k) => (
        <polygon key={k} points={pts.map((_, i) => at(i, r * R).join(",")).join(" ")} fill="none" stroke="#e2e8f0" strokeWidth={1} />
      ))}
      {pts.map((_, i) => { const [x, y] = at(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={1} />; })}
      <polygon points={poly} fill={color} fillOpacity={0.22} stroke={color} strokeWidth={2} />
      {pts.map((p, i) => { const [x, y] = at(i, (Math.max(0, Math.min(100, p.value)) / 100) * R); return <circle key={i} cx={x} cy={y} r={3} fill={color} />; })}
      {pts.map((p, i) => {
        const [x, y] = at(i, R + 16);
        return <text key={i} x={x} y={y} fontSize={9} fill="#475569" textAnchor="middle" dominantBaseline="middle">{p.label}</text>;
      })}
    </svg>
  );
}

function ScoreDial({ value, label, color, big = false }: { value: number; label: string; color: string; big?: boolean }) {
  const r = big ? 54 : 40, c = 2 * Math.PI * r, off = c * (1 - value / 100);
  const s = big ? 140 : 104;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${s} ${s}`} className={big ? "h-36 w-36" : "h-24 w-24"}>
        <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={big ? 11 : 9} />
        <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke={color} strokeWidth={big ? 11 : 9} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${s / 2} ${s / 2})`} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={big ? 34 : 24} fontWeight={800} fill="#0f172a">{value}</text>
      </svg>
      <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    </div>
  );
}

function FactorBar({ label, f, color, highlight = false }: { label: string; f: FactorOutput; color: string; highlight?: boolean }) {
  if (f.applicable === false) {
    return (
      <div className="opacity-40">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-600">{label}</span>
          <span className="text-xs text-slate-400">not applicable</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{f.explanation}</p>
      </div>
    );
  }
  return (
    <div className={highlight ? "rounded-lg bg-slate-50 p-2" : ""}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">
          {label} <span className="text-xs text-slate-400">· {Math.round(f.weight * 100)}%</span>
        </span>
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CONF_STYLE[f.confidence]}`}>{f.confidence}</span>
          <span className="font-bold text-slate-900">{f.score}</span>
        </div>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
        <div className="h-2 rounded-full" style={{ width: `${f.score}%`, background: color }} />
      </div>
      <p className="mt-1 text-xs leading-snug text-slate-500">{f.explanation}</p>
    </div>
  );
}

/* ---------------- search ---------------- */
type SearchItem = { id: string; primary: string; secondary?: string; searchText: string };
function SearchSelect({ label, placeholder, items, value, onSelect }: {
  label: string; placeholder: string; items: SearchItem[]; value: string; onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === value) ?? null;
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) => i.searchText.includes(q)).slice(0, 40);
  }, [query, items]);
  const display = selected && !open ? selected.primary : query;
  return (
    <div className="relative">
      <label className="text-sm font-semibold text-slate-600">{label}</label>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">
        {selected && <Crest name={selected.primary} size={26} />}
        <input
          className="w-full bg-transparent py-3 outline-none"
          placeholder={placeholder}
          value={display}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (value) onSelect(""); }}
        />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {results.map((i) => (
            <li key={i.id}>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                onMouseDown={(e) => { e.preventDefault(); onSelect(i.id); setQuery(""); setOpen(false); }}>
                <Crest name={i.primary} size={26} />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{i.primary}</span>
                  {i.secondary && <span className="block truncate text-xs text-slate-400">{i.secondary}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- main ---------------- */
export default function TransferAnalyzer({ clubs, players }: Props) {
  const [clubId, setClubId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clubItems: SearchItem[] = useMemo(
    () => clubs.map((c) => ({ id: c.id, primary: c.name, secondary: c.leagueId, searchText: `${c.name} ${c.leagueId}`.toLowerCase() })), [clubs]);
  const playerItems: SearchItem[] = useMemo(
    () => players.map((p) => ({ id: p.id, primary: p.name, secondary: `${p.role} · ${p.clubName}`, searchText: `${p.name} ${p.clubName}`.toLowerCase() })), [players]);

  const reset = () => { setResult(null); setError(null); };
  function handleAnalyze() {
    if (!clubId || !playerId) return;
    startTransition(async () => {
      const res = await runAnalysis(clubId, playerId);
      if ("error" in res) { setError(res.error); setResult(null); }
      else { setResult(res); setError(null); }
    });
  }

  const potentialLabel = (v: number) => (v >= 70 ? "High potential" : v >= 52 ? "Good potential" : v >= 38 ? "Limited potential" : "Low potential");

  return (
    <section className="mt-8 w-full max-w-4xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <SearchSelect label="Club (buyer)" placeholder="Type a club name…" items={clubItems} value={clubId} onSelect={(id) => { setClubId(id); reset(); }} />
          <SearchSelect label="Player (target)" placeholder="Type a player name…" items={playerItems} value={playerId} onSelect={(id) => { setPlayerId(id); reset(); }} />
        </div>
        <button onClick={handleAnalyze} disabled={isPending || !clubId || !playerId}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow transition hover:opacity-95 disabled:opacity-40">
          {isPending ? "Analyzing…" : "Analyze Transfer Potential"}
        </button>
        {!result && !error && !isPending && (
          <p className="mt-3 text-center text-sm text-slate-400">Pick a buying club and a target player to see their Transfer Potential.</p>
        )}
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">{error}</p>}
      </div>

      {result && (
        <div className="mt-6 space-y-6">
          {/* headline: POTENTIAL */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col items-center gap-4 bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white sm:flex-row sm:justify-between">
              <div className="flex items-center gap-3">
                <Crest name={result.meta.playerName} size={44} />
                <span className="text-lg font-bold">{result.meta.playerName}</span>
                <span className="text-2xl">→</span>
                <Crest name={result.meta.clubName} size={44} />
                <span className="text-lg font-bold">{result.meta.clubName}</span>
              </div>
              <div className="text-center">
                <div className="text-5xl font-extrabold leading-none">{result.potential}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-widest text-violet-200">Potential · {potentialLabel(result.potential)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-100 text-center">
              <div className="p-3">
                <span className="text-xs uppercase tracking-wide text-slate-400">Suitability</span>
                <div className="text-2xl font-bold text-emerald-600">{result.suitability}</div>
              </div>
              <div className="p-3">
                <span className="text-xs uppercase tracking-wide text-slate-400">Feasibility</span>
                <div className="text-2xl font-bold text-amber-600">{result.feasibility ? result.feasibility.score : "—"}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* SUITABILITY */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-600">Suitability</h3>
                <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${CONF_STYLE[result.confidence]}`}>{result.confidence} confidence</span>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <ScoreDial value={result.suitability} label="How well he fits" color="#059669" big />
                <RadarChart points={result.profile} color="#059669" />
              </div>
              <div className="mt-4 space-y-3">
                <FactorBar label="Squad Upgrade" f={result.breakdown.squadUpgrade} color="#059669" />
                <FactorBar label="Team Need" f={result.breakdown.teamNeed} color="#059669" highlight />
                <FactorBar label="Statistical Fit" f={result.breakdown.attributeFit} color="#059669" />
                <FactorBar label="Overall Quality" f={result.breakdown.overallQuality} color="#059669" />
                <FactorBar label="Tactical Fit" f={result.breakdown.tactical} color="#059669" />
                <FactorBar label="Development Value" f={result.breakdown.developmentValue} color="#059669" />
                <FactorBar label="Age Profile" f={result.breakdown.ageProfile} color="#059669" />
              </div>
            </div>

            {/* FEASIBILITY */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-amber-600">Feasibility</h3>
                {result.feasibility && (
                  <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${CONF_STYLE[result.feasibility.confidence]}`}>{result.feasibility.confidence} confidence</span>
                )}
              </div>
              {result.feasibility ? (
                <>
                  <div className="mt-3 flex items-center gap-4">
                    <ScoreDial value={result.feasibility.score} label={result.feasibility.band} color="#d97706" big />
                    <div className="text-sm text-slate-600">
                      <p className="leading-snug">{result.feasibility.summary}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {result.feasibility.factors.map((f) => (
                      <div key={f.key}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">{f.label}</span>
                          <span className="font-bold text-slate-900">{f.score}</span>
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-amber-500" style={{ width: `${f.score}%` }} />
                        </div>
                        <p className="mt-1 text-xs leading-snug text-slate-500">{f.detail}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] italic text-slate-400">An estimate — free data has no real transfer budgets or wages.</p>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-400">Feasibility unavailable for this pairing.</p>
              )}
            </div>
          </div>

          {/* footer meta — no FIFA ratings */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span>Role: <b className="text-slate-800">{result.meta.role}</b></span>
              <span>Age: <b className="text-slate-800">{result.meta.playerAge ?? "—"}</b></span>
              <span>Market value: <b className="text-slate-800">€{(result.meta.playerValue / 1e6).toFixed(1)}M</b></span>
              <span>Minutes: <b className="text-slate-800">{result.meta.playerMinutes ?? "—"}</b></span>
            </div>
            <p className="mt-2 text-xs text-slate-400">{result.confidenceNote}</p>
          </div>
        </div>
      )}
    </section>
  );
}
