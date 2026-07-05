// src/lib/analysis/factors/index.ts
import type { FactorModule } from "@/lib/types";
import { squadUpgrade } from "./squadUpgrade";
import { teamNeed } from "./teamNeed";
import { attributeFit } from "./attributeFit";
import { overallQuality } from "./overallQuality";
import { developmentValue } from "./developmentValue";
import { ageProfile } from "./ageProfile";
import { tactical } from "./tactical";

export const FACTORS: FactorModule[] = [
  squadUpgrade,
  teamNeed,
  attributeFit,
  overallQuality,
  developmentValue,
  ageProfile,
  tactical,
];

export { computeFinancialValue } from "./financial";
