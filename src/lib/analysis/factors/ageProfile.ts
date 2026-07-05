// src/lib/analysis/factors/ageProfile.ts
import type { FactorModule, FactorContext, FactorComputation } from "@/lib/types";
import { average, clamp } from "../utils";

function compute(ctx: FactorContext): FactorComputation {
  const { player, squad } = ctx;
  const playerAge = player.age;

  const roleAges = squad
    .filter((p) => p.role === player.role && p.playerId !== player.playerId)
    .map((p) => p.age)
    .filter((a): a is number => a !== null);
  const allAges = squad
    .filter((p) => p.playerId !== player.playerId)
    .map((p) => p.age)
    .filter((a): a is number => a !== null);
  const unitAges = roleAges.length >= 2 ? roleAges : allAges;
  const squadAvg = average(unitAges);

  if (playerAge === null || squadAvg === null) {
    return {
      score: 50,
      confidence: "low",
      explanation: "Age data unavailable for the player or squad; neutral score.",
      evidence: { reason: "no-age" },
    };
  }

  let score: number;
  let need: string;
  if (squadAvg >= 29) {
    need = "ageing unit — youth is valuable";
    score = playerAge <= 24 ? 92 : playerAge <= 27 ? 78 : playerAge <= 30 ? 60 : 42;
  } else if (squadAvg <= 24) {
    need = "young unit — some experience adds balance";
    score = playerAge >= 25 && playerAge <= 30 ? 88 : playerAge < 25 ? 66 : playerAge <= 33 ? 62 : 45;
  } else {
    need = "balanced unit";
    const diff = playerAge - squadAvg;
    score = diff <= -2 ? 88 : diff <= 1 ? 80 : diff <= 3 ? 66 : diff <= 5 ? 52 : 40;
  }

  return {
    score: clamp(score),
    confidence: unitAges.length >= 3 ? "high" : "medium",
    explanation: `Player is ${playerAge}; the ${
      roleAges.length >= 2 ? "role unit" : "squad"
    } averages ${squadAvg.toFixed(1)} (${need}).`,
    evidence: {
      playerAge,
      unitAverageAge: +squadAvg.toFixed(1),
      unitScope: roleAges.length >= 2 ? "role" : "squad",
      unitSize: unitAges.length,
    },
  };
}

export const ageProfile: FactorModule = {
  key: "ageProfile",
  label: "Age Profile",
  weight: 0.1,
  compute,
};
