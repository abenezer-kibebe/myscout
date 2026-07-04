// src/lib/analysis/utils.ts

export function num(value: string | number | undefined | null): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function getAge(
  dateOfBirth: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  if (age < 14 || age > 60) return null;
  return age;
}

export function clamp(score: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(score)));
}

export function average(nums: number[]): number | null {
  const valid = nums.filter((n) => Number.isFinite(n));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function median(nums: number[]): number | null {
  const valid = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
}

export function eurM(v: number): string {
  return `€${(v / 1e6).toFixed(1)}M`;
}
