import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Combo,
  db,
  MateriaPrima,
  PriceHistoryEntry,
  Product,
  ProductMateriaPrima,
  Sale,
  SaleItem,
} from '../lib/indexeddb';
import { DateRange, isSingleDayRange, resolveDateRange } from '../lib/dateFilter';
import {
  alignSeries,
  historyStepPoints,
  seriesColor,
} from '../lib/priceHistory';
import { formatNumber, formatPrice } from '../lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';

interface ProductDossierProps {
  products: Product[];
  materiaPrima: MateriaPrima[];
  sales: Sale[];
  dateFilter: string;
  startDate: string;
  endDate: string;
  specificDate: string;
}

interface Bucket {
  label: string;
  time: number;
  units: number;
  revenue: number;
  margin: number;
}

function inRange(date: Date, range: DateRange | null) {
  if (!range) return true;
  const time = date.getTime();
  return time >= range.start.getTime() && time <= range.end.getTime();
}

function bucketOf(date: Date, hourly: boolean): { key: string; label: string } {
  if (hourly) {
    return {
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`,
      label: `${String(date.getHours()).padStart(2, '0')}:00`,
    };
  }
  return {
    key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    label: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`,
  };
}

export function ProductDossier({
  products,
  materiaPrima,
  sales,
  dateFilter,
  startDate,
  endDate,
  specificDate,
}: ProductDossierProps) {
  const [productId, setProductId] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!productId) return;
    titleRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [productId]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [links, setLinks] = useState<ProductMateriaPrima[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await db.init();
      const [items, rows, productLinks, comboRows] = await Promise.all([
        db.getAll<SaleItem>('sale_items'),
        db.hasStore('price_history')
          ? db.getAll<PriceHistoryEntry>('price_history')
          : Promise.resolve([]),
        db.getAll<ProductMateriaPrima>('product_materia_prima'),
        db.hasStore('combos') ? db.getAll<Combo>('combos') : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setSaleItems(items);
      setHistory(rows);
      setLinks(productLinks);
      setCombos(comboRows);
    };
    load().catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, []);

  const range = resolveDateRange({
    dateFilter,
    startDate,
    endDate,
    specificDate,
  });
  const product = products.find((item) => item.id === productId);

  const dossier = useMemo(() => {
    if (!product) return null;
    const hourly = isSingleDayRange(range);
    const saleById = new Map(sales.map((sale) => [sale.id, sale]));
    const periodSales = sales.filter((sale) =>
      inRange(new Date(sale.completed_at), range)
    );
    const items = saleItems.filter((item) => {
      if (item.product_id !== product.id) return false;
      const sale = saleById.get(item.sale_id);
      return sale ? inRange(new Date(sale.completed_at), range) : false;
    });

    const buckets = new Map<string, Bucket>();
    let inCombo = 0;
    let outCombo = 0;
    const removed = new Map<string, number>();
    const variable = new Map<string, number>();

    for (const item of items) {
      const sale = saleById.get(item.sale_id);
      if (!sale) continue;
      const date = new Date(sale.completed_at);
      const bucket = bucketOf(date, hourly);
      const current = buckets.get(bucket.key) ?? {
        label: bucket.label,
        time: date.getTime(),
        units: 0,
        revenue: 0,
        margin: 0,
      };
      current.units += item.quantity;
      current.revenue += item.subtotal ?? item.product_price * item.quantity;
      current.margin += (item.product_price - item.production_cost) * item.quantity;
      buckets.set(bucket.key, current);

      if (item.combo_name || item.combo_instance_id) inCombo += item.quantity;
      else outCombo += item.quantity;

      for (const name of item.removed_ingredients ?? []) {
        removed.set(name, (removed.get(name) ?? 0) + item.quantity);
      }
      for (const ingredient of item.variable_ingredients ?? []) {
        const key = `${ingredient.name} × ${ingredient.quantity}`;
        variable.set(key, (variable.get(key) ?? 0) + item.quantity);
      }
    }

    const saleIds = new Set(items.map((item) => item.sale_id));
    const tickets = periodSales.filter((sale) => saleIds.has(sale.id));
    const ticketAverage =
      tickets.length > 0
        ? tickets.reduce((sum, sale) => sum + sale.total_amount, 0) / tickets.length
        : 0;
    const periodRevenue = periodSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const productRevenue = items.reduce(
      (sum, item) => sum + (item.subtotal ?? item.product_price * item.quantity),
      0
    );
    const units = items.reduce((sum, item) => sum + item.quantity, 0);
    const margin = items.reduce(
      (sum, item) =>
        sum + (item.product_price - item.production_cost) * item.quantity,
      0
    );

    const top = (counts: Map<string, number>) =>
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    const offeredInCombo = combos.some((combo) =>
      combo.slots.some(
        (slot) =>
          slot.product_ids.includes(product.id) ||
          slot.default_product_id === product.id
      )
    );

    return {
      hourly,
      series: [...buckets.values()].sort((a, b) => a.time - b.time),
      units,
      productRevenue,
      margin,
      ticketAverage,
      share: periodRevenue > 0 ? (productRevenue / periodRevenue) * 100 : 0,
      inCombo,
      outCombo,
      offeredInCombo,
      removed: top(removed),
      variable: top(variable),
    };
  }, [product, range, sales, saleItems, combos]);

  const pricePoints = product
    ? historyStepPoints(
        history.filter(
          (row) =>
            row.entity_id === product.id &&
            row.entity_type === 'product' &&
            row.field === 'price'
        ),
        range
      )
    : [];

  const costPoints = product
    ? historyStepPoints(
        history.filter(
          (row) =>
            row.entity_id === product.id &&
            row.field === 'production_cost'
        ),
        range
      )
    : [];

  const ingredientSeries =
    product && product.uses_materia_prima
      ? links
          .filter((link) => link.product_id === product.id && !link.linked_to)
          .map((link) => {
            const ingredient = materiaPrima.find(
              (item) => item.id === link.materia_prima_id
            );
            return {
              id: link.materia_prima_id,
              name: ingredient?.name || 'Ingrediente',
              points: historyStepPoints(
                history.filter(
                  (row) =>
                    row.entity_id === link.materia_prima_id &&
                    row.entity_type === 'materia_prima' &&
                    row.field === 'cost_per_unit'
                ),
                range
              ),
            };
          })
          .filter((item) => item.points.length > 0)
      : [];

  const ingredientRows = alignSeries(ingredientSeries);
  const ingredientConfig = Object.fromEntries(
    ingredientSeries.map((item, index) => [
      item.id,
      { label: item.name, color: seriesColor(index) },
    ])
  );

  return (
    <div
      className='rounded-lg shadow-md p-6 mt-6'
      style={{ backgroundColor: 'var(--color-background-secondary)' }}
    >
      <h2
        ref={titleRef}
        className='text-xl font-bold mb-1 scroll-mt-4'
        style={{ color: 'var(--color-text)' }}
      >
        Ficha de producto
      </h2>
      <p className='text-sm opacity-60 mb-4' style={{ color: 'var(--color-text)' }}>
        Ventas, precio y margen del período elegido arriba. El margen sale del
        precio y el costo guardados en cada venta.
      </p>

      <select
        value={productId}
        onChange={(event) => setProductId(event.target.value)}
        className='select-chevron w-full max-w-md rounded-lg px-3 py-2 mb-4 border'
        style={{
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-text)',
          borderColor: 'var(--color-background-accent)',
        }}
      >
        <option value=''>Elegí un producto</option>
        {products.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>

      {product && dossier && (
        <div className='space-y-6'>
          <div className='grid grid-cols-2 lg:grid-cols-5 gap-3'>
            <Stat label='Unidades' value={formatNumber(dossier.units)} />
            <Stat label='Revenue' value={formatPrice(dossier.productRevenue)} />
            <Stat label='Margen' value={formatPrice(dossier.margin)} />
            <Stat label='Ticket promedio' value={formatPrice(dossier.ticketAverage)} />
            <Stat label='Participación' value={`${dossier.share.toFixed(1)}%`} />
          </div>

          <ChartBlock title={dossier.hourly ? 'Unidades por hora' : 'Unidades por día'}>
            {dossier.series.length === 0 ? (
              <Empty />
            ) : (
              <SimpleLine
                data={dossier.series}
                dataKey='units'
                label='Unidades'
                color='var(--color-primary)'
              />
            )}
          </ChartBlock>

          <ChartBlock title={dossier.hourly ? 'Revenue por hora' : 'Revenue por día'}>
            {dossier.series.length === 0 ? (
              <Empty />
            ) : (
              <SimpleLine
                data={dossier.series}
                dataKey='revenue'
                label='Revenue'
                color='var(--color-accent)'
                money
              />
            )}
          </ChartBlock>

          <ChartBlock title='Precio de venta'>
            {pricePoints.length === 0 ? (
              <Empty text='Todavía no hay historial de precio' />
            ) : (
              <SimpleLine
                data={pricePoints.map((point) => ({
                  label: new Date(point.at).toLocaleString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  value: point.value,
                }))}
                dataKey='value'
                label='Precio'
                color='var(--color-primary)'
                money
                step
              />
            )}
          </ChartBlock>

          <ChartBlock title='Margen por período'>
            {dossier.series.length === 0 ? (
              <Empty />
            ) : (
              <SimpleLine
                data={dossier.series}
                dataKey='margin'
                label='Margen'
                color='var(--color-accent)'
                money
              />
            )}
          </ChartBlock>

          {product.uses_materia_prima && (
            <>
              <ChartBlock title='Costo de ingredientes'>
                {ingredientRows.length === 0 ? (
                  <Empty text='Todavía no hay historial de ingredientes' />
                ) : (
                  <ChartContainer
                    config={ingredientConfig}
                    className='aspect-auto h-56 w-full'
                  >
                    <LineChart data={ingredientRows}>
                      <CartesianGrid strokeDasharray='3 3' />
                      <XAxis dataKey='label' tick={{ fontSize: 11 }} />
                      <YAxis
                        width={64}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => formatPrice(Number(value))}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      {ingredientSeries.map((item, index) => (
                        <Line
                          key={item.id}
                          type='stepAfter'
                          dataKey={item.id}
                          stroke={seriesColor(index)}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ChartContainer>
                )}
              </ChartBlock>

              <ChartBlock title='Costo de producción'>
                {costPoints.length === 0 ? (
                  <Empty text='Todavía no hay historial de costo' />
                ) : (
                  <SimpleLine
                    data={costPoints.map((point) => ({
                      label: new Date(point.at).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                      value: point.value,
                    }))}
                    dataKey='value'
                    label='Costo'
                    color='var(--color-primary)'
                    money
                    step
                  />
                )}
              </ChartBlock>
            </>
          )}

          {(dossier.offeredInCombo || dossier.inCombo > 0) && (
            <ChartBlock title='Dentro y fuera de combo'>
              <div className='grid grid-cols-2 gap-3 mb-3 text-sm'>
                <Stat label='En combo' value={formatNumber(dossier.inCombo)} />
                <Stat label='Solo' value={formatNumber(dossier.outCombo)} />
              </div>
              <ChartContainer
                config={{ count: { label: 'Unidades', color: 'var(--color-primary)' } }}
                className='aspect-auto h-40 w-full'
              >
                <BarChart
                  data={[
                    { name: 'En combo', count: dossier.inCombo },
                    { name: 'Solo', count: dossier.outCombo },
                  ]}
                >
                  <XAxis dataKey='name' tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey='count' fill='var(--color-primary)' radius={4} />
                </BarChart>
              </ChartContainer>
            </ChartBlock>
          )}

          {dossier.removed.length > 0 && (
            <FrequencyChart title='Ingredientes sacados' rows={dossier.removed} />
          )}
          {dossier.variable.length > 0 && (
            <FrequencyChart
              title='Cantidades variables más pedidas'
              rows={dossier.variable}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className='rounded-lg p-3'
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div className='text-xs opacity-60'>{label}</div>
      <div className='text-lg font-bold'>{value}</div>
    </div>
  );
}

function ChartBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className='font-semibold mb-2'>{title}</h3>
      {children}
    </div>
  );
}

function Empty({ text = 'Sin ventas en el período' }: { text?: string }) {
  return <p className='text-sm opacity-60'>{text}</p>;
}

function SimpleLine({
  data,
  dataKey,
  label,
  color,
  money,
  step,
}: {
  data: Array<{ label: string }>;
  dataKey: string;
  label: string;
  color: string;
  money?: boolean;
  step?: boolean;
}) {
  return (
    <ChartContainer
      config={{ [dataKey]: { label, color } }}
      className='aspect-auto h-56 w-full'
    >
      <LineChart data={data}>
        <CartesianGrid strokeDasharray='3 3' />
        <XAxis dataKey='label' tick={{ fontSize: 11 }} />
        <YAxis
          width={money ? 64 : 40}
          tick={{ fontSize: 11 }}
          tickFormatter={money ? (value) => formatPrice(Number(value)) : undefined}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type={step ? 'stepAfter' : 'monotone'}
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

function FrequencyChart({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; count: number }[];
}) {
  return (
    <ChartBlock title={title}>
      <ChartContainer
        config={{ count: { label: 'Veces', color: 'var(--color-accent)' } }}
        className='aspect-auto h-48 w-full'
      >
        <BarChart data={rows}>
          <XAxis dataKey='name' tick={{ fontSize: 11 }} interval={0} />
          <YAxis allowDecimals={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey='count' fill='var(--color-accent)' radius={4} />
        </BarChart>
      </ChartContainer>
    </ChartBlock>
  );
}
