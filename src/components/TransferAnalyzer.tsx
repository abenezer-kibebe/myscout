// src/components/TransferAnalyzer.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  ClubOption,
  PlayerOption,
  AnalysisResult,
  FactorResult,
  Confidence,
} from "@/lib/types";
import { runAnalysis } from "@/app/actions/analyzeTransfer";

type Props = { clubs: ClubOption[]; players: PlayerOption[] };

const CONF_STYLE: Record<Confidence, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-gray-200 text-gray-700",
};

// Generic searchable item.
type SearchItem = {
  id: string;
  primary: string; // main label
  secondary?: string; // sub label (club, league)
  meta?: string; // right-aligned (rating)
  searchText: string; // lowercased haystack
};

function SearchSelect({
  label,
  placeholder,
  items,
  value,
  onSelect,
}: {
  label: string;
  placeholder: string;
  items: SearchItem[];
  value: string;
  onSelect: (id: string) => void;
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
      <label className="font-semibold">{label}</label>
      <input
        className="mt-2 w-full rounded-lg border p-3"
        placeholder={placeholder}
        value={display}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onSelect(""); // typing invalidates the current pick
        }}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-white shadow-lg">
          {results.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-100"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(i.id);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate">{i.primary}</span>
                  {i.secondary && (
                    <span className="block truncate text-xs text-gray-500">
                      {i.secondary}
                    </span>
                  )}
                </span>
                {i.meta && (
                  <span className="shrink-0 text-sm font-semibold text-gray-700">
                    {i.meta}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TransferAnalyzer({ clubs, players }: Props) {
  const [clubId, setClubId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clubItems: SearchItem[] = useMemo(
    () =>
      clubs.map((c) => ({
        id: c.id,
        primary: c.name,
        secondary: c.leagueId,
        searchText: `${c.name} ${c.leagueId}`.toLowerCase(),
      })),
    [clubs]
  );

  const playerItems: SearchItem[] = useMemo(
    () =>
      players.map((p) => ({
        id: p.id,
        primary: p.name,
        secondary: `${p.role} · ${p.clubName}`,
        meta: p.rating !== null ? `${p.rating}${p.estimated ? "*" : ""}` : "NR",
        searchText: `${p.name} ${p.clubName}`.toLowerCase(),
      })),
    [players]
  );

  function handleClubSelect(id: string) {
    setClubId(id);
    setResult(null);
    setError(null);
  }
  function handlePlayerSelect(id: string) {
    setPlayerId(id);
    setResult(null);
    setError(null);
  }

  function handleAnalyze() {
    if (!clubId || !playerId) return;
    startTransition(async () => {
      const res = await runAnalysis(clubId, playerId);
      if ("error" in res) {
        setError(res.error);
        setResult(null);
      } else {
        setResult(res);
        setError(null);
      }
    });
  }

  return (
    <section className="mt-10 w-full max-w-2xl rounded-xl border p-6">
      <div className="grid gap-6">
        <SearchSelect
          label="Search Club"
          placeholder="Type a club name…"
          items={clubItems}
          value={clubId}
          onSelect={handleClubSelect}
        />

        <SearchSelect
          label="Search Player"
          placeholder="Type a player name…"
          items={playerItems}
          value={playerId}
          onSelect={handlePlayerSelect}
        />

        <p className="-mt-2 text-xs text-gray-400">
          Ratings shown next to players; <span className="font-mono">*</span> means
          estimated from market value (no FC 26 match).
        </p>

        <button
          onClick={handleAnalyze}
          disabled={isPending || !clubId || !playerId}
          className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
        >
          {isPending ? "Analyzing…" : "Analyze Transfer"}
        </button>

        {!result && !error && !isPending && (
          <p className="text-sm text-gray-500">
            Search for a club and a player, then click Analyze Transfer.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <div className="rounded-xl border p-6">
            <h2 className="text-2xl font-bold">
              {result.meta.playerName} → {result.meta.clubName}
            </h2>

            <div className="mt-4 flex items-end gap-3">
              <p className="text-5xl font-bold">{result.suitability}%</p>
              <span
                className={`mb-2 rounded px-2 py-0.5 text-xs font-medium ${CONF_STYLE[result.confidence]}`}
              >
                {result.confidence} confidence
              </span>
            </div>
            <p className="text-gray-500">Transfer Suitability Score</p>

            {result.meta.matchConfidence === "none" && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                No FC 26 ability match — rating is estimated and quality factors
                are low confidence.
              </p>
            )}

            <div className="mt-6 space-y-4">
              <FactorRow label="Squad Upgrade" weight="40%" f={result.breakdown.squadUpgrade} />
              <FactorRow label="Attribute Fit" weight="22%" f={result.breakdown.attributeFit} />
              <FactorRow label="Overall Quality" weight="15%" f={result.breakdown.overallQuality} />
              <FactorRow label="Development Value" weight="13%" f={result.breakdown.developmentValue} />
              <FactorRow label="Age Profile" weight="10%" f={result.breakdown.ageProfile} />
              <FactorRow label="Tactical Fit" weight="0%" f={result.breakdown.tactical} muted />
            </div>

            <div className="mt-6 rounded-lg border bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Value: {result.financialValue.label}</span>
                <span className="text-sm text-gray-500">
                  {result.financialValue.score}/100 · does not affect suitability
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{result.financialValue.explanation}</p>
            </div>

            <div className="mt-6 border-t pt-4 text-sm text-gray-600">
              <p>
                Rating: {result.meta.playerRating ?? "NR"}
                {result.meta.ratingEstimated ? " (estimated)" : ""}
              </p>
              <p>Role: {result.meta.role}</p>
              <p>Player age: {result.meta.playerAge ?? "unknown"}</p>
              <p>Player value: €{(result.meta.playerValue / 1e6).toFixed(1)}M</p>
              <p>Minutes last season: {result.meta.playerMinutes ?? "unknown"}</p>
              <p className="mt-2 text-xs text-gray-400">{result.confidenceNote}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FactorRow({
  label,
  weight,
  f,
  muted = false,
}: {
  label: string;
  weight: string;
  f: FactorResult;
  muted?: boolean;
}) {
  return (
    <div className={muted ? "opacity-50" : ""}>
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {label} <span className="text-xs text-gray-400">· {weight}</span>
        </span>
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CONF_STYLE[f.confidence]}`}>
            {f.confidence}
          </span>
          <span className="font-semibold">{f.score}</span>
        </div>
      </div>
      <div className="mt-1 h-2 w-full rounded bg-gray-200">
        <div className="h-2 rounded bg-black" style={{ width: `${f.score}%` }} />
      </div>
      <p className="mt-1 text-xs text-gray-500">{f.explanation}</p>
    </div>
  );
}
