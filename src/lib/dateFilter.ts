export interface DateFilterInput {
  dateFilter: string;
  startDate: string;
  endDate: string;
  specificDate: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

/** Null means the filter is "todo el período" or the custom/specific dates are incomplete. */
export function resolveDateRange(
  input: DateFilterInput,
  now = new Date()
): DateRange | null {
  const { dateFilter, startDate, endDate, specificDate } = input;

  if (dateFilter === 'all') return null;

  if (dateFilter === 'specific') {
    if (!specificDate) return null;
    const [year, month, day] = specificDate.split('-').map(Number);
    return {
      start: new Date(year, month - 1, day, 0, 0, 0, 0),
      end: new Date(year, month - 1, day, 23, 59, 59, 999),
    };
  }

  if (dateFilter === 'custom') {
    if (!startDate || !endDate) return null;
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    return {
      start: new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0),
      end: new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999),
    };
  }

  const start = new Date(now);
  const end = new Date(now);

  switch (dateFilter) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setHours(23, 59, 59, 999);
      return { start, end };
    case 'last7':
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    case 'last30':
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    case 'thisMonth':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      };
    case 'lastMonth':
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
        end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    default:
      return null;
  }
}

export function isSingleDayRange(range: DateRange | null): boolean {
  if (!range) return false;
  return range.start.toDateString() === range.end.toDateString();
}
