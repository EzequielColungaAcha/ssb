import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Line, LineChart, YAxis } from 'recharts';
import { db, PriceHistoryEntry } from '../lib/indexeddb';
import { formatPrice } from '../lib/utils';
import { historyStepPoints } from '../lib/priceHistory';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';

interface PriceHistoryAccordionProps {
  entityType: PriceHistoryEntry['entity_type'];
  entityId: string;
  field: PriceHistoryEntry['field'];
  label: string;
}

export function PriceHistoryAccordion({
  entityType,
  entityId,
  field,
  label,
}: PriceHistoryAccordionProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<PriceHistoryEntry[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      await db.init();
      const rows = await db.getAllByIndex<PriceHistoryEntry>(
        'price_history',
        'entity_id',
        entityId
      );
      if (cancelled) return;
      setEntries(
        rows.filter((row) => row.entity_type === entityType && row.field === field)
      );
    };

    load().catch((error) => {
      console.error(error);
      if (!cancelled) setEntries([]);
    });

    return () => {
      cancelled = true;
    };
  }, [open, entityId, entityType, field]);

  const points =
    entries && entries.length > 0
      ? historyStepPoints(entries, null).map((point, index) => ({
          index,
          value: point.value,
        }))
      : [];

  return (
    <div className='mt-3'>
      <button
        type='button'
        onClick={() => setOpen((current) => !current)}
        className='w-full flex items-center justify-between gap-2 py-2 text-sm font-medium'
        style={{ color: 'var(--color-text)' }}
      >
        <span>{label}</span>
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className='pt-1'>
          {entries === null ? (
            <p className='text-xs opacity-60'>Cargando...</p>
          ) : entries.length === 0 ? (
            <p className='text-xs opacity-60'>Todavía no hay historial</p>
          ) : (
            <ChartContainer
              config={{
                value: { label: 'Precio', color: 'var(--color-primary)' },
              }}
              className='aspect-auto h-16 w-full'
            >
              <LineChart data={points}>
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatPrice(Number(value))}
                    />
                  }
                />
                <Line
                  type='stepAfter'
                  dataKey='value'
                  stroke='var(--color-primary)'
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          )}
        </div>
      )}
    </div>
  );
}
