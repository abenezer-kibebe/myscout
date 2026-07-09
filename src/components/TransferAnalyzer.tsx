// src/components/TransferAnalyzer.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import type { ClubOption, PlayerOption, AnalysisResult, FactorOutput, Confidence, RadarPoint } from "@/lib/types";
import { runAnalysis } from "@/app/actions/analyzeTransfer";

type Props = { clubs: ClubOption[]; players: PlayerOption[] };

const CONF: Record<Confidence, string> = {
  high: "bg-emerald-500/15 text-emerald-300",
  medium: "bg-amber-500/15 text-amber-300",
  low: "bg-slate-500/15 text-slate-400",
};

/* ---------- crest: real logo, else colored monogram/position ---------- */
function Badge({ name, logoUrl, text, size = 36 }: { name: string; logoUrl?: string | null; text?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const label = text ?? name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  if (logoUrl && !broken) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full bg-white/8 p-1" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={name} width={size - 8} height={size - 8} className="object-contain" onError={() => setBroken(true)} />
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: `linear-gradient(135deg,hsl(${h} 60% 45%),hsl(${(h + 40) % 360} 60% 32%))`, fontSize: size * 0.34 }}>
      {label}
    </span>
  );
}

/* ---------- hexagon stat card ---------- */
function HexStat({ value, label, color, glow }: { value: number | string; label: string; color: string; glow: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="hex flex items-center justify-center" style={{ width: 104, height: 116, background: `linear-gradient(160deg,${color}33,${color}0d)`, boxShadow: `0 0 34px -10px ${glow}` }}>
        <div className="hex flex items-center justify-center" style={{ width: 98, height: 110, background: "#0d0d16" }}>
          <span className="font-score text-3xl" style={{ color }}>{value}</span>
        </div>
      </div>
      <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
    </div>
  );
}

/* ---------- radar ---------- */
function Radar({ points, color }: { points?: RadarPoint[]; color: string }) {
  const pts = points ?? [];
  if (pts.length < 3) return null;
  const size = 220, cx = size / 2, cy = size / 2, R = 78, N = pts.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const at = (i: number, r: number) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r] as const;
  const poly = pts.map((p, i) => at(i, (Math.max(0, Math.min(100, p.value)) / 100) * R).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-52 w-52">
      {[0.25, 0.5, 0.75, 1].map((r, k) => (
        <polygon key={k} points={pts.map((_, i) => at(i, r * R).join(",")).join(" ")} fill="none" stroke="#ffffff12" strokeWidth={1} />
      ))}
      {pts.map((_, i) => { const [x, y] = at(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#ffffff12" />; })}
      <polygon points={poly} fill={color} fillOpacity={0.28} stroke={color} strokeWidth={2} />
      {pts.map((p, i) => { const [x, y] = at(i, (Math.max(0, Math.min(100, p.value)) / 100) * R); return <circle key={i} cx={x} cy={y} r={2.5} fill={color} />; })}
      {pts.map((p, i) => { const [x, y] = at(i, R + 14); return <text key={i} x={x} y={y} fontSize={8} fill="#94a3b8" textAnchor="middle" dominantBaseline="middle">{p.label}</text>; })}
    </svg>
  );
}

function Bar({ label, score, weight, conf, note, color }: { label: string; score: number; weight?: number; conf?: Confidence; note: string; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-medium text-slate-200">{label}{weight != null && <span className="ml-1 text-[10px] text-slate-500">{Math.round(weight * 100)}%</span>}</span>
        <div className="flex items-center gap-1.5">
          {conf && <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${CONF[conf]}`}>{conf}</span>}
          <span className="font-score text-sm text-white">{score}</span>
        </div>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-white/6">
        <div className="h-1.5 rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{note}</p>
    </div>
  );
}

/* ---------- search ---------- */
type SItem = { id: string; primary: string; secondary?: string; logoUrl?: string | null; pos?: string; searchText: string };
function Search({ label, placeholder, items, value, onSelect, kind }: {
  label: string; placeholder: string; items: SItem[]; value: string; onSelect: (id: string) => void; kind: "club" | "player";
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === value) ?? null;
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.searchText.includes(q)).slice(0, 40) : [];
  }, [query, items]);
  const badge = (i: SItem) => kind === "player"
    ? <Badge name={i.primary} text={i.pos} size={26} />
    : <Badge name={i.primary} logoUrl={i.logoUrl} size={26} />;
  return (
    <div className="relative">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 focus-within:border-violet-400/60">
        {selected && badge(selected)}
        <input className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
          placeholder={placeholder} value={selected && !open ? selected.primary : query}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (value) onSelect(""); }} />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-white/10 bg-[#12121c] shadow-2xl">
          {results.map((i) => (
            <li key={i.id}>
              <button type="button" className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-white/5"
                onMouseDown={(e) => { e.preventDefault(); onSelect(i.id); setQuery(""); setOpen(false); }}>
                {badge(i)}
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-100">{i.primary}</span>
                  {i.secondary && <span className="block truncate text-[11px] text-slate-500">{i.secondary}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- main ---------- */
export default function TransferAnalyzer({ clubs, players }: Props) {
  const [clubId, setClubId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clubItems: SItem[] = useMemo(() => clubs.map((c) => ({ id: c.id, primary: c.name, secondary: c.leagueId, logoUrl: c.logoUrl, searchText: `${c.name} ${c.leagueId}`.toLowerCase() })), [clubs]);
  const playerItems: SItem[] = useMemo(() => players.map((p) => ({ id: p.id, primary: p.name, secondary: `${p.pos ?? p.role} · ${p.clubName}`, pos: p.pos ?? p.role, searchText: `${p.name} ${p.clubName}`.toLowerCase() })), [players]);

  const reset = () => { setResult(null); setError(null); };
  function analyze() {
    if (!clubId || !playerId) return;
    startTransition(async () => {
      const res = await runAnalysis(clubId, playerId);
      if ("error" in res) { setError(res.error); setResult(null); }
      else { setResult(res); setError(null); }
    });
  }
  const potLabel = (v: number) => (v >= 70 ? "Elite" : v >= 52 ? "Strong" : v >= 38 ? "Limited" : "Low");
  const f = result?.feasibility ?? null;

  return (
    <section className="mt-4 w-full max-w-5xl">
      {/* controls */}
      <div className="glass rounded-2xl p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Search kind="club" label="Club (buyer)" placeholder="Search club…" items={clubItems} value={clubId} onSelect={(id) => { setClubId(id); reset(); }} />
          <Search kind="player" label="Player (target)" placeholder="Search player…" items={playerItems} value={playerId} onSelect={(id) => { setPlayerId(id); reset(); }} />
          <button onClick={analyze} disabled={isPending || !clubId || !playerId}
            className="glow-violet h-[42px] rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 font-semibold text-white transition hover:opacity-95 disabled:opacity-40">
            {isPending ? "…" : "Analyze"}
          </button>
        </div>
        {!result && !error && !isPending && <p className="mt-2 text-center text-xs text-slate-500">Pick a buying club and target player.</p>}
        {error && <p className="mt-2 rounded-lg bg-red-500/10 p-2 text-center text-sm text-red-300">{error}</p>}
      </div>

      {result && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
          {/* LEFT: headline + suitability */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge name={result.meta.playerName} text={result.meta.playerPosCode} size={34} />
                <span className="text-sm font-semibold text-white">{result.meta.playerName}</span>
                <span className="text-slate-500">→</span>
                <Badge name={result.meta.clubName} logoUrl={result.meta.clubLogoUrl} size={34} />
                <span className="text-sm font-semibold text-white">{result.meta.clubName}</span>
              </div>
            </div>

            {/* three hex stats */}
            <div className="mt-4 flex items-start justify-center gap-4">
              <HexStat value={result.potential} label={`Potential · ${potLabel(result.potential)}`} color="#a78bfa" glow="rgba(139,92,246,.55)" />
              <HexStat value={result.suitability} label="Suitability" color="#34d399" glow="rgba(16,185,129,.45)" />
              <HexStat value={f ? f.score : "—"} label={f ? `Feasibility · ${f.band}` : "Feasibility"} color="#fbbf24" glow="rgba(245,158,11,.45)" />
            </div>

            <div className="mt-3 flex items-center justify-center">
              <Radar points={result.profile} color="#34d399" />
            </div>
          </div>

          {/* RIGHT: factor breakdowns */}
          <div className="grid gap-4">
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xs font-bold uppercase tracking-widest text-emerald-400">Suitability</h3>
                <span className={`rounded px-1.5 py-0.5 text-[9px] ${CONF[result.confidence]}`}>{result.confidence}</span>
              </div>
              <div className="mt-3 space-y-2.5">
                <Bar label="Squad Upgrade" score={result.breakdown.squadUpgrade.score} weight={result.breakdown.squadUpgrade.weight} conf={result.breakdown.squadUpgrade.confidence} note={result.breakdown.squadUpgrade.explanation} color="#34d399" />
                <Bar label="Team Need" score={result.breakdown.teamNeed.score} weight={result.breakdown.teamNeed.weight} conf={result.breakdown.teamNeed.confidence} note={result.breakdown.teamNeed.explanation} color="#34d399" />
                <Bar label="Statistical Fit" score={result.breakdown.attributeFit.score} weight={result.breakdown.attributeFit.weight} conf={result.breakdown.attributeFit.confidence} note={result.breakdown.attributeFit.explanation} color="#34d399" />
                <Bar label="Overall Quality" score={result.breakdown.overallQuality.score} weight={result.breakdown.overallQuality.weight} conf={result.breakdown.overallQuality.confidence} note={result.breakdown.overallQuality.explanation} color="#34d399" />
                {result.breakdown.tactical.applicable !== false && (
                  <Bar label="Tactical Fit" score={result.breakdown.tactical.score} weight={result.breakdown.tactical.weight} conf={result.breakdown.tactical.confidence} note={result.breakdown.tactical.explanation} color="#34d399" />
                )}
              </div>
            </div>

            {f && (
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xs font-bold uppercase tracking-widest text-amber-400">Feasibility</h3>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] ${CONF[f.confidence]}`}>{f.confidence}</span>
                </div>
                <div className="mt-3 space-y-2.5">
                  {f.factors.map((x) => <Bar key={x.key} label={x.label} score={x.score} note={x.detail} color="#fbbf24" />)}
                </div>
                <p className="mt-2 text-[10px] italic text-slate-500">Estimate — free data has no real budgets or wages.</p>
              </div>
            )}
          </div>

          {/* footer meta */}
          <div className="glass rounded-2xl px-4 py-2.5 text-xs text-slate-400 lg:col-span-2">
            <span className="mr-4">Position <b className="text-slate-200">{result.meta.playerPosCode ?? result.meta.role}</b></span>
            <span className="mr-4">Age <b className="text-slate-200">{result.meta.playerAge ?? "—"}</b></span>
            <span className="mr-4">Value <b className="text-slate-200">€{(result.meta.playerValue / 1e6).toFixed(1)}M</b></span>
            <span>Minutes <b className="text-slate-200">{result.meta.playerMinutes ?? "—"}</b></span>
          </div>
        </div>
      )}
    </section>
  );
}
