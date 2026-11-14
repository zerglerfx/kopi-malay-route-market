/** Browser-safe fuzzy matching for state / province pickers. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function distance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = d[j]!;
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev! + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return d[b.length]!;
}

/** Options ranked for what the customer typed: prefix, then contains, then closest spelling. */
export function rankPlaces(query: string, options: readonly string[], limit = 8): string[] {
  const q = norm(query);
  if (!q) return [...options];
  const score = (o: string) => {
    const n = norm(o);
    if (n.startsWith(q)) return 0;
    if (n.includes(q)) return 1;
    return 2 + Math.min(distance(q, n), distance(q, n.slice(0, q.length)) );
  };
  return options.map((o) => [o, score(o)] as const)
    .filter(([, s]) => s <= 2 + Math.max(2, Math.floor(q.length / 3)))
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([o]) => o);
}

/** Closest valid option for a typed value, or "" when nothing is close enough. */
export function bestPlace(query: string, options: readonly string[]): string {
  return rankPlaces(query, options, 1)[0] ?? "";
}
