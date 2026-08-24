export type ScoreItem = { id: string; positive: boolean };

export function calculateFunctioningIndex(ratings: Record<string, string | undefined>, expected: ScoreItem[]) {
  const scored = expected.flatMap((item) => {
    const raw = ratings[item.id];
    if (!raw || raw === "U" || raw === "N") return [];
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 4) return [];
    return [item.positive ? value * 25 : 100 - value * 25];
  });
  if (!scored.length) return null;
  return { score: Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length), coverage: Math.round(scored.length / expected.length * 100) };
}
