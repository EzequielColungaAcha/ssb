import React, { useState, useEffect, useCallback } from 'react';
import { Sale, SaleItem } from '../lib/indexeddb';
import { formatPrice, formatNumber } from '../lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip } from './ui/chart';

type TimeFrame = 'hour' | 'day' | 'week' | 'month' | 'year';
type ChartMode = 'sales' | 'products';

interface ChartDataPoint {
  label: string;
  value: number;
  count: number;
}

interface SalesChartProps {
  sales: Sale[];
  saleItems: SaleItem[];
}

export function SalesChart({ sales, saleItems }: SalesChartProps) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('day');
  const [chartMode, setChartMode] = useState<ChartMode>('sales');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  const getTimeKey = useCallback(
    (date: Date): { key: string; sortDate: Date } => {
      switch (timeFrame) {
        case 'hour': {
          const sortDate = new Date(date);
          sortDate.setMinutes(0, 0, 0);
          const hour = date.getHours().toString().padStart(2, '0');
          const dateStr = date.toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'short',
          });
          return { key: `${hour}:00|${dateStr}`, sortDate };
        }

        case 'day': {
          const sortDate = new Date(date);
          sortDate.setHours(0, 0, 0, 0);
          return {
            key: date.toLocaleDateString('es-AR', {
              month: 'short',
              day: 'numeric',
            }),
            sortDate,
          };
        }

        case 'week': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          weekStart.setHours(0, 0, 0, 0);
          return {
            key: `Sem ${weekStart.toLocaleDateString('es-AR', {
              month: 'short',
              day: 'numeric',
            })}`,
            sortDate: weekStart,
          };
        }

        case 'month': {
          const sortDate = new Date(date.getFullYear(), date.getMonth(), 1);
          return {
            key: date.toLocaleDateString('es-AR', {
              year: 'numeric',
              month: 'short',
            }),
            sortDate,
          };
        }

        case 'year': {
          const sortDate = new Date(date.getFullYear(), 0, 1);
          return { key: date.getFullYear().toString(), sortDate };
        }

        default: {
          const defaultSortDate = new Date(date);
          defaultSortDate.setHours(0, 0, 0, 0);
          return {
            key: date.toLocaleDateString('es-AR', {
              month: 'short',
              day: 'numeric',
            }),
            sortDate: defaultSortDate,
          };
        }
      }
    },
    [timeFrame]
  );

  const calculateChartData = useCallback(() => {
    if (sales.length === 0) {
      setChartData([]);
      return;
    }

    const groupedData: {
      [key: string]: { value: number; count: number; minDate: Date };
    } = {};

    if (chartMode === 'sales') {
      sales.forEach((sale) => {
        const saleDate = new Date(sale.completed_at);
        const { key, sortDate } = getTimeKey(saleDate);

        if (!groupedData[key]) {
          groupedData[key] = { value: 0, count: 0, minDate: sortDate };
        }
        groupedData[key].value += sale.total_amount;
        groupedData[key].count += 1;
        if (sortDate < groupedData[key].minDate) {
          groupedData[key].minDate = sortDate;
        }
      });
    } else {
      const saleIdToDate = new Map<string, Date>();
      sales.forEach((sale) => {
        saleIdToDate.set(sale.id, new Date(sale.completed_at));
      });

      saleItems.forEach((item) => {
        const saleDate = saleIdToDate.get(item.sale_id);
        if (!saleDate) return;

        const { key, sortDate } = getTimeKey(saleDate);

        if (!groupedData[key]) {
          groupedData[key] = { value: 0, count: 0, minDate: sortDate };
        }
        groupedData[key].value += item.quantity;
        groupedData[key].count += item.quantity;
        if (sortDate < groupedData[key].minDate) {
          groupedData[key].minDate = sortDate;
        }
      });
    }

    const sortedData = Object.entries(groupedData)
      .map(([label, { value, count, minDate }]) => ({
        label,
        value,
        count,
        minDate,
      }))
      .sort((a, b) => a.minDate.getTime() - b.minDate.getTime());

    setChartData(sortedData);
  }, [chartMode, getTimeKey, saleItems, sales]);

  const timeFrameButtons: { value: TimeFrame; label: string }[] = [
    { value: 'hour', label: 'H' },
    { value: 'day', label: 'D' },
    { value: 'week', label: 'S' },
    { value: 'month', label: 'M' },
    { value: 'year', label: 'A' },
  ];

  const chartConfig = {
    value: {
      label: chartMode === 'sales' ? 'Ventas' : 'Productos',
      color: 'var(--color-primary)',
    },
  };

  useEffect(() => {
    calculateChartData();
  }, [sales, saleItems, timeFrame, chartMode, calculateChartData]);

  return (
    <div
      className='rounded-lg shadow-md p-6'
      style={{ backgroundColor: 'var(--color-background-secondary)' }}
    >
      <div className='flex justify-between items-center mb-6 flex-wrap gap-4'>
        <h2
          className='text-xl font-bold'
          style={{ color: 'var(--color-text)' }}
        >
          Gráfico de {chartMode === 'sales' ? 'Ventas' : 'Productos'}
        </h2>
        <div className='flex gap-2'>
          <div
            className='flex gap-1 p-1 rounded-lg'
            style={{ backgroundColor: 'var(--color-background-accent)' }}
          >
            <button
              onClick={() => setChartMode('sales')}
              className={`px-3 py-1 rounded font-semibold text-sm transition-all ${
                chartMode === 'sales' ? 'text-white' : ''
              }`}
              style={
                chartMode === 'sales'
                  ? {
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-on-primary)',
                    }
                  : { color: 'var(--color-text)' }
              }
            >
              Ventas
            </button>
            <button
              onClick={() => setChartMode('products')}
              className={`px-3 py-1 rounded font-semibold text-sm transition-all ${
                chartMode === 'products' ? 'text-white' : ''
              }`}
              style={
                chartMode === 'products'
                  ? {
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-on-primary)',
                    }
                  : { color: 'var(--color-text)' }
              }
            >
              Productos
            </button>
          </div>
          <div
            className='flex gap-1 p-1 rounded-lg'
            style={{ backgroundColor: 'var(--color-background-accent)' }}
          >
            {timeFrameButtons.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setTimeFrame(btn.value)}
                className={`px-3 py-1 rounded font-semibold text-sm transition-all ${
                  timeFrame === btn.value ? 'text-white' : ''
                }`}
                style={
                  timeFrame === btn.value
                    ? {
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                      }
                    : { color: 'var(--color-text)' }
                }
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className='text-center text-gray-400 py-12'>
          No hay datos de ventas para este período
        </div>
      ) : (
        <div className='relative'>
          <ChartContainer config={chartConfig} className='h-[300px] w-full'>
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray='3 3'
                stroke='var(--color-primary)'
                opacity={0.1}
                vertical={false}
              />
              <XAxis
                dataKey='label'
                stroke='var(--color-text)'
                opacity={0.5}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tick={({ x, y, payload }) => {
                  if (timeFrame === 'hour' && payload.value.includes('|')) {
                    const [hour, date] = payload.value.split('|');
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text
                          x={0}
                          y={0}
                          dy={12}
                          textAnchor='middle'
                          fill='var(--color-text)'
                          opacity={0.7}
                          fontSize={12}
                          fontWeight={600}
                        >
                          {hour}
                        </text>
                        <text
                          x={0}
                          y={0}
                          dy={26}
                          textAnchor='middle'
                          fill='var(--color-text)'
                          opacity={0.4}
                          fontSize={10}
                        >
                          {date}
                        </text>
                      </g>
                    );
                  }
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text
                        x={0}
                        y={0}
                        dy={12}
                        textAnchor='middle'
                        fill='var(--color-text)'
                        opacity={0.5}
                        fontSize={12}
                      >
                        {payload.value}
                      </text>
                    </g>
                  );
                }}
                height={50}
              />
              <YAxis
                stroke='var(--color-text)'
                opacity={0.5}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  chartMode === 'sales'
                    ? `$${value.toLocaleString()}`
                    : value.toLocaleString()
                }
              />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) {
                    return null;
                  }

                  const dataPoint = payload[0].payload;
                  const value = dataPoint.value;
                  const count = dataPoint.count;

                  // Format label for hour view (split "14:00|11 dic" into two lines)
                  const displayLabel = label.includes('|')
                    ? label.replace('|', ' - ')
                    : label;

                  return (
                    <div className='rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl'>
                      <div
                        className='font-medium mb-1'
                        style={{ color: 'var(--color-text)' }}
                      >
                        {displayLabel}
                      </div>
                      {chartMode === 'sales' ? (
                        <>
                          <div
                            className='font-bold'
                            style={{ color: 'var(--color-primary)' }}
                          >
                            {formatPrice(value)}
                          </div>
                          <div
                            className='text-xs opacity-60'
                            style={{ color: 'var(--color-text)' }}
                          >
                            {formatNumber(count)}{' '}
                            {count === 1 ? 'venta' : 'ventas'}
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            className='font-bold'
                            style={{ color: 'var(--color-primary)' }}
                          >
                            {formatNumber(value)} unidades
                          </div>
                          <div
                            className='text-xs opacity-60'
                            style={{ color: 'var(--color-text)' }}
                          >
                            {formatNumber(count)}{' '}
                            {count === 1 ? 'producto' : 'productos'}
                          </div>
                        </>
                      )}
                    </div>
                  );
                }}
              />
              <Line
                type='monotone'
                dataKey='value'
                stroke='var(--color-primary)'
                strokeWidth={3}
                dot={{
                  fill: 'var(--color-primary)',
                  strokeWidth: 2,
                  r: 4,
                  stroke: 'var(--color-background-secondary)',
                }}
                activeDot={{
                  r: 6,
                  fill: 'var(--color-accent)',
                  stroke: 'var(--color-background-secondary)',
                }}
              />
            </LineChart>
          </ChartContainer>

          <div
            className='mt-4 flex justify-between items-center text-sm'
            style={{ color: 'var(--color-text)' }}
          >
            {chartMode === 'sales' ? (
              <>
                <div>
                  <span className='opacity-60'>Total: </span>
                  <span
                    className='font-bold'
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {formatPrice(
                      chartData.reduce((sum, d) => sum + d.value, 0)
                    )}
                  </span>
                </div>
                <div>
                  <span className='opacity-60'>Ventas: </span>
                  <span className='font-bold'>
                    {chartData.reduce((sum, d) => sum + d.count, 0)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className='opacity-60'>Total Unidades: </span>
                  <span
                    className='font-bold'
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {formatNumber(
                      chartData.reduce((sum, d) => sum + d.value, 0)
                    )}
                  </span>
                </div>
                <div>
                  <span className='opacity-60'>Productos: </span>
                  <span className='font-bold'>
                    {chartData.reduce((sum, d) => sum + d.count, 0)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
