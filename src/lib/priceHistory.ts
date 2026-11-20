import { PriceHistoryEntry } from './indexeddb';
import { DateRange } from './dateFilter';

export interface HistoryPoint {
  at: string;
  value: number;
}

export function historyStepPoints(
  entries: PriceHistoryEntry[],
  range: DateRange | null
): HistoryPoint[] {
  const sorted = [...entries].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
  if (sorted.length === 0) return [];

  if (!range) {
    const points: HistoryPoint[] = [];
    sorted.forEach((entry, index) => {
      if (index === 0) {
        points.push({
          at: new Date(new Date(entry.created_at).getTime() - 1).toISOString(),
          value: entry.previous_value,
        });
      }
      points.push({ at: entry.created_at, value: entry.new_value });
    });
    return points;
  }

  const prior = [...sorted]
    .reverse()
    .find((entry) => new Date(entry.created_at) < range.start);
  const inside = sorted.filter((entry) => {
    const time = new Date(entry.created_at).getTime();
    return time >= range.start.getTime() && time <= range.end.getTime();
  });

  const points: HistoryPoint[] = [];
  if (prior) {
    points.push({ at: range.start.toISOString(), value: prior.new_value });
  } else if (inside.length > 0) {
    points.push({
      at: new Date(new Date(inside[0].created_at).getTime() - 1).toISOString(),
      value: inside[0].previous_value,
    });
  }
  for (const entry of inside) {
    points.push({ at: entry.created_at, value: entry.new_value });
  }
  return points;
}

export function formatHistoryLabel(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SERIES_COLORS = [
  'var(--color-primary)',
  'var(--color-accent)',
  '#8b5cf6',
  '#14b8a6',
  '#ec4899',
  '#f97316',
];

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

export function alignSeries(
  series: { id: string; points: HistoryPoint[] }[]
): Array<Record<string, string | number | null>> {
  const times = [
    ...new Set(series.flatMap((item) => item.points.map((point) => point.at))),
  ].sort();

  return times.map((at) => {
    const row: Record<string, string | number | null> = {
      at,
      label: formatHistoryLabel(at),
    };
    for (const item of series) {
      const known = item.points.filter((point) => point.at <= at);
      row[item.id] = known.length > 0 ? known[known.length - 1].value : null;
    }
    return row;
  });
}
