import React, { useState, useEffect } from 'react';
import { Sale } from '../lib/indexeddb';
import { formatPrice, formatNumber } from '../lib/utils';

type TimeFrame = 'hour' | 'day' | 'week' | 'month' | 'year';

interface ChartDataPoint {
  label: string;
  value: number;
  count: number;
}

interface SalesChartProps {
  sales: Sale[];
}

export function SalesChart({ sales }: SalesChartProps) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('day');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  useEffect(() => {
    calculateChartData();
  }, [sales, timeFrame]);

  const calculateChartData = () => {
    if (sales.length === 0) {
      setChartData([]);
      return;
    }

    const now = new Date();
    const data: { [key: string]: { value: number; count: number } } = {};

    sales.forEach((sale) => {
      const saleDate = new Date(sale.completed_at);
      let key: string;

      switch (timeFrame) {
        case 'hour':
          // Last 24 hours
          const hoursDiff = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60));
          if (hoursDiff < 24) {
            key = `${saleDate.getHours()}:00`;
          } else {
            return;
          }
          break;

        case 'day':
          // Last 30 days
          const daysDiff = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff < 30) {
            key = saleDate.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' });
          } else {
            return;
          }
          break;

        case 'week':
          // Last 12 weeks
          const weeksDiff = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
          if (weeksDiff < 12) {
            const weekStart = new Date(saleDate);
            weekStart.setDate(saleDate.getDate() - saleDate.getDay());
            key = `Sem ${weekStart.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })}`;
          } else {
            return;
          }
          break;

        case 'month':
          // Last 12 months
          const monthsDiff = (now.getFullYear() - saleDate.getFullYear()) * 12 + (now.getMonth() - saleDate.getMonth());
          if (monthsDiff < 12) {
            key = saleDate.toLocaleDateString('es-AR', { year: 'numeric', month: 'short' });
          } else {
            return;
          }
          break;

        case 'year':
          // Last 5 years
          const yearsDiff = now.getFullYear() - saleDate.getFullYear();
          if (yearsDiff < 5) {
            key = saleDate.getFullYear().toString();
          } else {
            return;
          }
          break;
      }

      if (!data[key]) {
        data[key] = { value: 0, count: 0 };
      }
      data[key].value += sale.total_amount;
      data[key].count += 1;
    });

    const sortedData = Object.entries(data)
      .map(([label, { value, count }]) => ({ label, value, count }))
      .sort((a, b) => {
        // Sort chronologically
        if (timeFrame === 'year') {
          return parseInt(a.label) - parseInt(b.label);
        }
        return 0; // Keep insertion order for other timeframes
      });

    setChartData(sortedData);
  };

  const maxValue = Math.max(...chartData.map((d) => d.value), 1);
  const timeFrameButtons: { value: TimeFrame; label: string }[] = [
    { value: 'hour', label: 'H' },
    { value: 'day', label: 'D' },
    { value: 'week', label: 'S' },
    { value: 'month', label: 'M' },
    { value: 'year', label: 'A' },
  ];

  return (
    <div className="rounded-lg shadow-md p-6" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
          Gráfico de Ventas
        </h2>
        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-background-accent)' }}>
          {timeFrameButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setTimeFrame(btn.value)}
              className={`px-3 py-1 rounded font-semibold text-sm transition-all ${
                timeFrame === btn.value ? 'text-white' : ''
              }`}
              style={
                timeFrame === btn.value
                  ? { backgroundColor: 'var(--color-primary)' }
                  : { color: 'var(--color-text)' }
              }
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          No hay datos de ventas para este período
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-end gap-1 h-64" style={{ minHeight: '256px' }}>
            {chartData.map((point, index) => {
              const heightPercent = (point.value / maxValue) * 100;
              const isHovered = hoveredPoint === index;

              return (
                <div
                  key={index}
                  className="flex-1 flex flex-col items-center group relative"
                  onMouseEnter={() => setHoveredPoint(index)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  {isHovered && (
                    <div
                      className="absolute bottom-full mb-2 px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap z-10"
                      style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}
                    >
                      <div className="font-bold">{formatPrice(point.value)}</div>
                      <div className="text-xs opacity-60">
                        {formatNumber(point.count)} {point.count === 1 ? 'venta' : 'ventas'}
                      </div>
                      <div className="text-xs opacity-60 mt-1">{point.label}</div>
                    </div>
                  )}
                  <div
                    className="w-full rounded-t transition-all cursor-pointer"
                    style={{
                      height: `${heightPercent}%`,
                      backgroundColor: isHovered ? 'var(--color-accent)' : 'var(--color-primary)',
                      minHeight: point.value > 0 ? '4px' : '0',
                      opacity: isHovered ? 1 : 0.85,
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex gap-1 mt-2 overflow-x-auto">
            {chartData.map((point, index) => (
              <div
                key={index}
                className="flex-1 text-center text-xs opacity-60"
                style={{ color: 'var(--color-text)', minWidth: '30px' }}
              >
                {index % Math.ceil(chartData.length / 8) === 0 && (
                  <span className="block truncate">{point.label}</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-between items-center text-sm" style={{ color: 'var(--color-text)' }}>
            <div>
              <span className="opacity-60">Total: </span>
              <span className="font-bold" style={{ color: 'var(--color-primary)' }}>
                {formatPrice(chartData.reduce((sum, d) => sum + d.value, 0))}
              </span>
            </div>
            <div>
              <span className="opacity-60">Ventas: </span>
              <span className="font-bold">
                {chartData.reduce((sum, d) => sum + d.count, 0)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
