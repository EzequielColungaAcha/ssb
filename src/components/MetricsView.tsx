import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  Filter,
  BarChart3,
  Clock,
} from 'lucide-react';
import { useSales } from '../hooks/useSales';
import { useProducts } from '../hooks/useProducts';
import { useMateriaPrima } from '../hooks/useMateriaPrima';
import { useCombo } from '../hooks/useCombo';
import { db, SaleItem, ProductMateriaPrima } from '../lib/indexeddb';
import { formatPrice, formatNumber } from '../lib/utils';
import { SalesChart } from './SalesChart';

interface ProductSales {
  product_name: string;
  quantity: number;
  revenue: number;
  profit: number;
}

export function MetricsView() {
  const { sales } = useSales();
  const { products } = useProducts();
  const { materiaPrima, calculateAvailableStock } = useMateriaPrima();
  const { combos } = useCombo();

  // Create a Set of combo names for efficient lookup (memoized to prevent re-renders)
  const comboNames = React.useMemo(
    () => new Set(combos.map((c) => c.name)),
    [combos]
  );
  const [topProducts, setTopProducts] = useState<ProductSales[]>([]);
  const [allSoldProducts, setAllSoldProducts] = useState<ProductSales[]>([]);
  const [mostProfitableProducts, setMostProfitableProducts] = useState<
    ProductSales[]
  >([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [filteredRevenue, setFilteredRevenue] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [specificDate, setSpecificDate] = useState<string>('');
  const [filteredSalesState, setFilteredSalesState] = useState<typeof sales>(
    []
  );

  const filterSalesByDate = useCallback(
    (salesToFilter: typeof sales) => {
      if (dateFilter === 'all') return salesToFilter;

      const now = new Date();
      let filterStartDate: Date;
      let filterEndDate: Date;

      if (dateFilter === 'specific') {
        if (!specificDate) return salesToFilter;
        const [year, month, day] = specificDate.split('-').map(Number);
        filterStartDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        filterEndDate = new Date(year, month - 1, day, 23, 59, 59, 999);
      } else if (dateFilter === 'custom') {
        if (!startDate || !endDate) return salesToFilter;
        const [startYear, startMonth, startDay] = startDate
          .split('-')
          .map(Number);
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
        filterStartDate = new Date(
          startYear,
          startMonth - 1,
          startDay,
          0,
          0,
          0,
          0
        );
        filterEndDate = new Date(
          endYear,
          endMonth - 1,
          endDay,
          23,
          59,
          59,
          999
        );
      } else {
        switch (dateFilter) {
          case 'today':
            filterStartDate = new Date(now);
            filterStartDate.setHours(0, 0, 0, 0);
            filterEndDate = new Date(now);
            filterEndDate.setHours(23, 59, 59, 999);
            break;
          case 'yesterday':
            filterStartDate = new Date(now);
            filterStartDate.setDate(filterStartDate.getDate() - 1);
            filterStartDate.setHours(0, 0, 0, 0);
            filterEndDate = new Date(filterStartDate);
            filterEndDate.setHours(23, 59, 59, 999);
            break;
          case 'last7':
            filterStartDate = new Date(now);
            filterStartDate.setDate(filterStartDate.getDate() - 6);
            filterStartDate.setHours(0, 0, 0, 0);
            filterEndDate = new Date(now);
            filterEndDate.setHours(23, 59, 59, 999);
            break;
          case 'last30':
            filterStartDate = new Date(now);
            filterStartDate.setDate(filterStartDate.getDate() - 29);
            filterStartDate.setHours(0, 0, 0, 0);
            filterEndDate = new Date(now);
            filterEndDate.setHours(23, 59, 59, 999);
            break;
          case 'thisMonth':
            filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
            filterEndDate = new Date(now);
            filterEndDate.setHours(23, 59, 59, 999);
            break;
          case 'lastMonth':
            filterStartDate = new Date(
              now.getFullYear(),
              now.getMonth() - 1,
              1
            );
            filterEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
            filterEndDate.setHours(23, 59, 59, 999);
            break;
          default:
            return salesToFilter;
        }
      }

      return salesToFilter.filter((sale) => {
        const saleDate = new Date(sale.completed_at);
        return saleDate >= filterStartDate && saleDate <= filterEndDate;
      });
    },
    [dateFilter, endDate, specificDate, startDate]
  );
  const [filteredSaleItems, setFilteredSaleItems] = useState<SaleItem[]>([]);

  const calculateMetrics = useCallback(async () => {
    await db.init();
    const allSaleItems = await db.getAll<SaleItem>('sale_items');

    const dateFilteredSales = filterSalesByDate(sales);

    let filteredSaleItems = allSaleItems;

    if (categoryFilter !== 'all') {
      filteredSaleItems = filteredSaleItems.filter((item) => {
        const product = products.find((p) => p.id === item.product_id);
        return product?.category === categoryFilter;
      });
    }

    if (productFilter !== 'all') {
      filteredSaleItems = filteredSaleItems.filter((item) => {
        const product = products.find((p) => p.id === item.product_id);
        return product?.id === productFilter;
      });
    }

    const relevantSaleIds = new Set(
      filteredSaleItems.map((item) => item.sale_id)
    );

    const filteredSales = dateFilteredSales.filter(
      (sale) => categoryFilter === 'all' || relevantSaleIds.has(sale.id)
    );

    setFilteredSalesState(filteredSales);

    const filteredSaleIds = new Set(filteredSales.map((s) => s.id));
    const dateAndCategoryFilteredItems = filteredSaleItems.filter((item) =>
      filteredSaleIds.has(item.sale_id)
    );

    setFilteredSaleItems(dateAndCategoryFilteredItems);

    // Separate combo items and regular items
    const regularItems = dateAndCategoryFilteredItems.filter(
      (item: SaleItem) => !item.combo_name
    );
    const comboItems = dateAndCategoryFilteredItems.filter(
      (item: SaleItem) => item.combo_name
    );

    const productSales: {
      [key: string]: { quantity: number; revenue: number; profit: number };
    } = {};
    let profit = 0;
    let revenue = 0;

    // Process regular items
    regularItems.forEach((item: SaleItem) => {
      if (!productSales[item.product_name]) {
        productSales[item.product_name] = {
          quantity: 0,
          revenue: 0,
          profit: 0,
        };
      }
      const itemProfit =
        (item.product_price - (item.production_cost || 0)) * item.quantity;
      productSales[item.product_name].quantity += item.quantity;
      productSales[item.product_name].revenue += item.subtotal;
      productSales[item.product_name].profit += itemProfit;
      profit += itemProfit;
      revenue += item.subtotal;
    });

    // Process combo items - include individual product values
    // Track combo instances for calculating the combo discount/adjustment
    const processedComboInstances = new Set<string>();
    const comboInstanceData = new Map<
      string,
      { comboPrice: number; productsTotal: number; productionCost: number }
    >();

    // First pass: collect data for each combo instance
    comboItems.forEach((item: SaleItem) => {
      const instanceId = item.combo_instance_id || item.id;
      const existing = comboInstanceData.get(instanceId) || {
        comboPrice: item.combo_unit_price || 0,
        productsTotal: 0,
        productionCost: 0,
      };
      existing.productsTotal += item.product_price * item.quantity;
      existing.productionCost += (item.production_cost || 0) * item.quantity;
      comboInstanceData.set(instanceId, existing);
    });

    // Second pass: add to product stats and totals
    comboItems.forEach((item: SaleItem) => {
      const instanceId = item.combo_instance_id || item.id;

      // Add combo product to product stats with individual values
      if (!productSales[item.product_name]) {
        productSales[item.product_name] = {
          quantity: 0,
          revenue: 0,
          profit: 0,
        };
      }
      const itemProfit =
        (item.product_price - (item.production_cost || 0)) * item.quantity;
      productSales[item.product_name].quantity += item.quantity;
      productSales[item.product_name].revenue += item.product_price * item.quantity;
      productSales[item.product_name].profit += itemProfit;

      // Add to totals only once per combo instance
      if (!processedComboInstances.has(instanceId)) {
        processedComboInstances.add(instanceId);
        const instanceData = comboInstanceData.get(instanceId)!;
        // Revenue is the combo price (what customer actually paid)
        revenue += instanceData.comboPrice;
        // Profit is combo price minus total production cost
        profit += instanceData.comboPrice - instanceData.productionCost;
      }
    });

    setTotalProfit(profit);
    setFilteredRevenue(revenue);

    const allSoldProductsData = Object.entries(productSales)
      .map(([name, data]) => ({
        product_name: name,
        quantity: data.quantity,
        revenue: data.revenue,
        profit: data.profit,
      }))
      .sort((a, b) => b.quantity - a.quantity);

    const topProductsData = allSoldProductsData.slice(0, 5);

    const mostProfitableData = Object.entries(productSales)
      .map(([name, data]) => ({
        product_name: name,
        quantity: data.quantity,
        revenue: data.revenue,
        profit: data.profit,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    setTopProducts(topProductsData);
    setAllSoldProducts(allSoldProductsData);
    setMostProfitableProducts(mostProfitableData);
  }, [
    categoryFilter,
    filterSalesByDate,
    productFilter,
    products,
    sales,
    comboNames,
  ]);
  const filteredProducts =
    categoryFilter === 'all'
      ? products
      : products.filter((p) => p.category === categoryFilter);

  const inventoryFilteredProducts =
    productFilter === 'all'
      ? filteredProducts
      : filteredProducts.filter((p) => p.id === productFilter);

  const totalRevenue = filteredRevenue;
  const totalSales = filteredSalesState.length;
  const averageSale = totalSales > 0 ? totalRevenue / totalSales : 0;

  // Calculate delivery time metrics
  const deliveryMetrics = (() => {
    const deliverySales = filteredSalesState.filter(
      (sale) =>
        sale.order_type === 'delivery' &&
        sale.scheduled_time &&
        sale.delivered_at
    );

    if (deliverySales.length === 0) {
      return {
        count: 0,
        averageDelay: 0,
        onTimeCount: 0,
        lateCount: 0,
        earlyCount: 0,
        onTimePercentage: 0,
      };
    }

    let totalDelayMinutes = 0;
    let onTimeCount = 0;
    let lateCount = 0;
    let earlyCount = 0;

    deliverySales.forEach((sale) => {
      const scheduled = new Date(sale.scheduled_time!).getTime();
      const delivered = new Date(sale.delivered_at!).getTime();
      const diffMinutes = (delivered - scheduled) / (1000 * 60);

      totalDelayMinutes += diffMinutes;

      // Consider "on time" if within 5 minutes
      if (Math.abs(diffMinutes) <= 5) {
        onTimeCount++;
      } else if (diffMinutes > 5) {
        lateCount++;
      } else {
        earlyCount++;
      }
    });

    return {
      count: deliverySales.length,
      averageDelay: totalDelayMinutes / deliverySales.length,
      onTimeCount,
      lateCount,
      earlyCount,
      onTimePercentage: (onTimeCount / deliverySales.length) * 100,
    };
  })();

  const productsWithoutRawMaterials = inventoryFilteredProducts.filter(
    (p) => !p.uses_materia_prima
  );
  const productsInventoryValue = productsWithoutRawMaterials.reduce(
    (sum, product) => sum + product.production_cost * product.stock,
    0
  );

  const [productMateriaPrimaLinks, setProductMateriaPrimaLinks] = useState<
    ProductMateriaPrima[]
  >([]);

  const filteredRawMaterials = (() => {
    if (productFilter !== 'all') {
      const selectedProduct = products.find((p) => p.id === productFilter);
      if (selectedProduct && selectedProduct.uses_materia_prima) {
        const links = productMateriaPrimaLinks.filter(
          (link) => link.product_id === productFilter
        );
        const materiaPrimaIds = links.map((link) => link.materia_prima_id);
        return materiaPrima.filter((mp) => materiaPrimaIds.includes(mp.id));
      }
      return [];
    }

    if (categoryFilter === 'all') {
      return materiaPrima;
    }

    const categoryProducts = products.filter(
      (p) => p.uses_materia_prima && p.category === categoryFilter
    );
    const productIds = categoryProducts.map((p) => p.id);
    const links = productMateriaPrimaLinks.filter((link) =>
      productIds.includes(link.product_id)
    );
    const materiaPrimaIds = links.map((link) => link.materia_prima_id);
    return materiaPrima.filter((mp) => materiaPrimaIds.includes(mp.id));
  })();

  const rawMaterialsValue = filteredRawMaterials.reduce(
    (sum, mp) => sum + mp.cost_per_unit * mp.stock,
    0
  );

  const totalInventoryValue = productsInventoryValue + rawMaterialsValue;

  const categories = [
    { value: 'all', label: 'Todas las Categorías' },
    { value: 'hamburguesas', label: 'Hamburguesas' },
    { value: 'papas fritas', label: 'Papas Fritas' },
    { value: 'bebidas', label: 'Bebidas' },
  ];

  const dateFilters = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7', label: 'Last 7 Days' },
    { value: 'last30', label: 'Last 30 Days' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'specific', label: 'Specific Date' },
    { value: 'custom', label: 'Custom Range' },
  ];

  useEffect(() => {
    const loadLinks = async () => {
      await db.init();
      const links = await db.getAll<ProductMateriaPrima>(
        'product_materia_prima'
      );
      setProductMateriaPrimaLinks(links);
    };
    loadLinks();
  }, []);

  useEffect(() => {
    calculateMetrics();
  }, [
    sales,
    categoryFilter,
    productFilter,
    dateFilter,
    startDate,
    endDate,
    specificDate,
    calculateMetrics,
  ]);

  useEffect(() => {
    setProductFilter('all');
  }, [categoryFilter]);

  return (
    <div className='p-6'>
      <div className='mb-6'>
        <h1
          className='text-3xl font-bold flex items-center gap-3'
          style={{ color: 'var(--color-text)' }}
        >
          <BarChart3 style={{ color: 'var(--color-primary)' }} />
          Métricas y Análisis
        </h1>
        <p className='opacity-60 mt-2' style={{ color: 'var(--color-text)' }}>
          Analizá el rendimiento de tu negocio con métricas detalladas y
          reportes visuales
        </p>
        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex items-center gap-2'>
            <Filter size={20} style={{ color: 'var(--color-text)' }} />
            <span
              className='text-sm opacity-60'
              style={{ color: 'var(--color-text)' }}
            >
              Category:
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className='px-4 py-2 rounded-lg border font-semibold'
              style={{
                backgroundColor: 'var(--color-background-accent)',
                color: 'var(--color-text)',
                borderColor: 'var(--color-primary)',
              }}
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {categoryFilter !== 'all' && (
            <div className='flex items-center gap-2'>
              <span
                className='text-sm opacity-60'
                style={{ color: 'var(--color-text)' }}
              >
                Product:
              </span>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className='px-4 py-2 rounded-lg border font-semibold'
                style={{
                  backgroundColor: 'var(--color-background-accent)',
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-primary)',
                }}
              >
                <option value='all'>All Products</option>
                {filteredProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className='flex items-center gap-2'>
            <span
              className='text-sm opacity-60'
              style={{ color: 'var(--color-text)' }}
            >
              Date:
            </span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className='px-4 py-2 rounded-lg border font-semibold'
              style={{
                backgroundColor: 'var(--color-background-accent)',
                color: 'var(--color-text)',
                borderColor: 'var(--color-primary)',
              }}
            >
              {dateFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>

          {dateFilter === 'specific' && (
            <input
              type='date'
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className='px-4 py-2 rounded-lg border'
              style={{
                backgroundColor: 'var(--color-background-accent)',
                color: 'var(--color-text)',
                borderColor: 'var(--color-primary)',
              }}
            />
          )}

          {dateFilter === 'custom' && (
            <>
              <input
                type='date'
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className='px-4 py-2 rounded-lg border'
                style={{
                  backgroundColor: 'var(--color-background-accent)',
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-primary)',
                }}
              />
              <span
                className='text-sm opacity-60'
                style={{ color: 'var(--color-text)' }}
              >
                to
              </span>
              <input
                type='date'
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className='px-4 py-2 rounded-lg border'
                style={{
                  backgroundColor: 'var(--color-background-accent)',
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-primary)',
                }}
              />
            </>
          )}
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6'>
        <div
          className='rounded-lg shadow-md p-4'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <div className='flex items-center justify-between mb-1'>
            <div
              className='opacity-60 text-xs'
              style={{ color: 'var(--color-text)' }}
            >
              Ingresos Totales
            </div>
            <DollarSign size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div
            className='text-xl font-bold'
            style={{ color: 'var(--color-text)' }}
          >
            {formatPrice(totalRevenue)}
          </div>
        </div>

        <div
          className='rounded-lg shadow-md p-4'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <div className='flex items-center justify-between mb-1'>
            <div
              className='opacity-60 text-xs'
              style={{ color: 'var(--color-text)' }}
            >
              Ventas Totales
            </div>
            <ShoppingCart size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div
            className='text-xl font-bold'
            style={{ color: 'var(--color-text)' }}
          >
            {totalSales}
          </div>
        </div>

        <div
          className='rounded-lg shadow-md p-4'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <div className='flex items-center justify-between mb-1'>
            <div
              className='opacity-60 text-xs'
              style={{ color: 'var(--color-text)' }}
            >
              Venta Promedio
            </div>
            <TrendingUp size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div
            className='text-xl font-bold'
            style={{ color: 'var(--color-text)' }}
          >
            {formatPrice(averageSale)}
          </div>
        </div>

        <div
          className='rounded-lg shadow-md p-4'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <div className='flex items-center justify-between mb-1'>
            <div
              className='opacity-60 text-xs'
              style={{ color: 'var(--color-text)' }}
            >
              Ganancia Total
            </div>
            <TrendingUp size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div
            className='text-xl font-bold'
            style={{ color: 'var(--color-text)' }}
          >
            {formatPrice(totalProfit)}
          </div>
        </div>

        <div
          className='rounded-lg shadow-md p-4'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <div className='flex items-center justify-between mb-1'>
            <div
              className='opacity-60 text-xs'
              style={{ color: 'var(--color-text)' }}
            >
              Valor Inventario
            </div>
            <Package size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div
            className='text-xl font-bold'
            style={{ color: 'var(--color-text)' }}
          >
            {formatPrice(totalInventoryValue)}
          </div>
        </div>

        {/* Delivery Time Metric */}
        <div
          className='rounded-lg shadow-md p-4'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <div className='flex items-center justify-between mb-1'>
            <div
              className='opacity-60 text-xs'
              style={{ color: 'var(--color-text)' }}
            >
              Tiempo Entrega
            </div>
            <Clock size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          {deliveryMetrics.count > 0 ? (
            <div>
              <div
                className='text-xl font-bold'
                style={{
                  color:
                    Math.abs(deliveryMetrics.averageDelay) <= 5
                      ? '#10b981'
                      : deliveryMetrics.averageDelay > 0
                      ? '#ef4444'
                      : '#3b82f6',
                }}
              >
                {deliveryMetrics.averageDelay > 0 ? '+' : ''}
                {Math.round(deliveryMetrics.averageDelay)} min
              </div>
              <div
                className='text-xs space-y-0.5'
                style={{ color: 'var(--color-text)', opacity: 0.7 }}
              >
                <div>
                  A tiempo: {deliveryMetrics.onTimeCount} (
                  {deliveryMetrics.onTimePercentage.toFixed(0)}%)
                </div>
                <div>
                  Tarde: {deliveryMetrics.lateCount} | Temp:{' '}
                  {deliveryMetrics.earlyCount}
                </div>
              </div>
            </div>
          ) : (
            <div
              className='text-sm'
              style={{ color: 'var(--color-text)', opacity: 0.6 }}
            >
              Sin datos
            </div>
          )}
        </div>
      </div>

      <div className='mb-6'>
        <SalesChart sales={filteredSalesState} saleItems={filteredSaleItems} />
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div
          className='rounded-lg shadow-md p-6'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <h2
            className='text-xl font-bold mb-4'
            style={{ color: 'var(--color-text)' }}
          >
            Productos Más Rentables
          </h2>
          <div className='space-y-4'>
            {mostProfitableProducts.length === 0 ? (
              <div
                className='text-center py-8'
                style={{ color: 'var(--color-text)', opacity: 0.6 }}
              >
                Aún no hay ventas de productos
              </div>
            ) : (
              mostProfitableProducts.map((product, index) => (
                <div
                  key={product.product_name}
                  className='p-4 rounded-lg'
                  style={{ backgroundColor: 'var(--color-background-accent)' }}
                >
                  <div className='flex items-center gap-3 mb-2'>
                    <div
                      className='w-8 h-8 rounded-full flex items-center justify-center font-bold'
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                      }}
                    >
                      {index + 1}
                    </div>
                    <div className='flex-1'>
                      <div
                        className='font-semibold'
                        style={{ color: 'var(--color-text)' }}
                      >
                        {product.product_name}
                      </div>
                      <div
                        className='text-sm opacity-60 mt-1'
                        style={{ color: 'var(--color-text)' }}
                      >
                        {formatNumber(product.quantity)} unidad/es vendidas
                      </div>
                      <div
                        className='text-xs mt-1 opacity-60'
                        style={{ color: 'var(--color-text)' }}
                      >
                        Ingreso: {formatPrice(product.revenue)}
                      </div>
                    </div>
                    <div className='text-right'>
                      <div
                        className='text-xs opacity-60 mb-1'
                        style={{ color: 'var(--color-text)' }}
                      >
                        Ganancia
                      </div>
                      <div
                        className='text-lg font-bold'
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {formatPrice(product.profit)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div
          className='rounded-lg shadow-md p-6'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <h2
            className='text-xl font-bold mb-4'
            style={{ color: 'var(--color-text)' }}
          >
            Productos Más Vendidos
          </h2>
          <div className='space-y-4'>
            {topProducts.length === 0 ? (
              <div
                className='text-center py-8'
                style={{ color: 'var(--color-text)', opacity: 0.6 }}
              >
                Aún no hay ventas de productos
              </div>
            ) : (
              topProducts.map((product, index) => (
                <div
                  key={product.product_name}
                  className='p-4 rounded-lg'
                  style={{ backgroundColor: 'var(--color-background-accent)' }}
                >
                  <div className='flex items-center gap-3 mb-2'>
                    <div
                      className='w-8 h-8 rounded-full flex items-center justify-center font-bold'
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                      }}
                    >
                      {index + 1}
                    </div>
                    <div className='flex-1'>
                      <div
                        className='font-semibold'
                        style={{ color: 'var(--color-text)' }}
                      >
                        {product.product_name}
                      </div>
                      <div
                        className='text-sm opacity-60 mt-1'
                        style={{ color: 'var(--color-text)' }}
                      >
                        {formatNumber(product.quantity)} unidad/es vendidas
                      </div>
                      <div
                        className='text-xs mt-1 opacity-60'
                        style={{ color: 'var(--color-text)' }}
                      >
                        Ingreso: {formatPrice(product.revenue)}
                      </div>
                    </div>
                    <div className='text-right'>
                      <div
                        className='text-xs opacity-60 mb-1'
                        style={{ color: 'var(--color-text)' }}
                      >
                        Ganancia
                      </div>
                      <div
                        className='text-lg font-bold'
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {formatPrice(product.profit)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div
          className='rounded-lg shadow-md p-6 flex flex-col'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <h2
            className='text-xl font-bold mb-4'
            style={{ color: 'var(--color-text)' }}
          >
            Productos Vendidos
          </h2>
          <div
            className='space-y-4 overflow-y-auto scrollbar-hide'
            style={{ maxHeight: '500px' }}
          >
            {allSoldProducts.length === 0 ? (
              <div
                className='text-center py-8'
                style={{ color: 'var(--color-text)', opacity: 0.6 }}
              >
                Aún no hay ventas de productos
              </div>
            ) : (
              (() => {
                const productsByCategory = allSoldProducts.reduce(
                  (acc, product) => {
                    const productInfo = products.find(
                      (p) => p.name === product.product_name
                    );
                    const category = productInfo?.category || 'N/A';
                    if (!acc[category]) {
                      acc[category] = [];
                    }
                    acc[category].push(product);
                    return acc;
                  },
                  {} as Record<string, typeof topProducts>
                );

                const sortedCategories = Object.keys(productsByCategory).sort();

                return sortedCategories.map((category) => (
                  <div key={category} className='space-y-2'>
                    <div
                      className='font-semibold text-sm uppercase tracking-wide opacity-60 px-2'
                      style={{ color: 'var(--color-text)' }}
                    >
                      {category}
                    </div>
                    {productsByCategory[category].map((product) => (
                      <div
                        key={product.product_name}
                        className='flex justify-between items-center p-3 rounded-lg'
                        style={{
                          backgroundColor: 'var(--color-background-accent)',
                        }}
                      >
                        <div className='flex-1'>
                          <div
                            className='font-semibold'
                            style={{ color: 'var(--color-text)' }}
                          >
                            {product.product_name}
                          </div>
                        </div>
                        <div className='text-right'>
                          <div
                            className='text-lg font-bold'
                            style={{ color: 'var(--color-primary)' }}
                          >
                            {formatNumber(product.quantity)}
                          </div>
                          <div
                            className='text-xs opacity-60'
                            style={{ color: 'var(--color-text)' }}
                          >
                            unidad/es
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ));
              })()
            )}
          </div>
        </div>

        <div
          className='rounded-lg shadow-md p-6'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <h2
            className='text-xl font-bold mb-4'
            style={{ color: 'var(--color-text)' }}
          >
            Estado del Inventario
          </h2>
          <div className='space-y-4'>
            {(categoryFilter === 'all'
              ? ['hamburguesas', 'papas fritas', 'bebidas']
              : [categoryFilter]
            ).map((category) => {
              const InventoryStats = () => {
                const [stats, setStats] = React.useState({
                  totalStock: 0,
                  totalValue: 0,
                  totalCost: 0,
                  productCount: 0,
                });

                React.useEffect(() => {
                  const calculateStats = async () => {
                    const categoryProducts = products.filter(
                      (p) => p.category === category
                    );

                    const regularProducts = categoryProducts.filter(
                      (p) => !p.uses_materia_prima
                    );
                    const materiaPrimaProducts = categoryProducts.filter(
                      (p) => p.uses_materia_prima
                    );

                    let totalStock = 0;
                    let totalValue = 0;
                    let totalCost = 0;

                    for (const product of regularProducts) {
                      totalStock += product.stock;
                      totalValue += product.price * product.stock;
                      totalCost += product.production_cost * product.stock;
                    }

                    // For materia prima products - check if they share ingredients
                    if (materiaPrimaProducts.length > 0) {
                      // Get materia prima IDs for each product
                      const productMPIds = materiaPrimaProducts.map((p) => {
                        const links = productMateriaPrimaLinks.filter(
                          (link) => link.product_id === p.id
                        );
                        return links.map((l) => l.materia_prima_id);
                      });

                      // Check if any products share ingredients
                      const allMPIds = productMPIds.flat();
                      const uniqueMPIds = new Set(allMPIds);
                      const hasSharedIngredients =
                        allMPIds.length !== uniqueMPIds.size;

                      if (hasSharedIngredients) {
                        // Shared ingredients - find MAX
                        let maxStock = 0;
                        for (const product of materiaPrimaProducts) {
                          const availableStock = await calculateAvailableStock(
                            product.id
                          );
                          if (availableStock > maxStock) {
                            maxStock = availableStock;
                          }
                        }
                        // Use average price/cost for shared pool
                        const avgPrice =
                          materiaPrimaProducts.reduce(
                            (sum, p) => sum + p.price,
                            0
                          ) / materiaPrimaProducts.length;
                        const avgCost =
                          materiaPrimaProducts.reduce(
                            (sum, p) => sum + p.production_cost,
                            0
                          ) / materiaPrimaProducts.length;
                        totalStock += maxStock;
                        totalValue += avgPrice * maxStock;
                        totalCost += avgCost * maxStock;
                      } else {
                        // Independent ingredients - SUM all
                        for (const product of materiaPrimaProducts) {
                          const availableStock = await calculateAvailableStock(
                            product.id
                          );
                          totalStock += availableStock;
                          totalValue += product.price * availableStock;
                          totalCost += product.production_cost * availableStock;
                        }
                      }
                    }

                    setStats({
                      totalStock,
                      totalValue,
                      totalCost,
                      productCount: categoryProducts.length,
                    });
                  };

                  calculateStats();
                }, []);

                const potentialProfit = stats.totalValue - stats.totalCost;

                return (
                  <div
                    className='p-4 rounded-lg'
                    style={{
                      backgroundColor: 'var(--color-background-accent)',
                    }}
                  >
                    <div className='flex justify-between items-center mb-2'>
                      <div
                        className='font-semibold capitalize'
                        style={{ color: 'var(--color-text)' }}
                      >
                        {category}
                      </div>
                      <div
                        className='text-sm'
                        style={{ color: 'var(--color-text)', opacity: 0.7 }}
                      >
                        {stats.productCount} productos
                      </div>
                    </div>

                    <div className='flex justify-between text-sm'>
                      <span
                        style={{ color: 'var(--color-text)', opacity: 0.7 }}
                      >
                        Unidades Totales:
                      </span>
                      <span
                        className='font-bold'
                        style={{ color: 'var(--color-text)' }}
                      >
                        {formatNumber(stats.totalStock)}
                      </span>
                    </div>

                    <div className='flex justify-between text-sm'>
                      <span
                        style={{ color: 'var(--color-text)', opacity: 0.7 }}
                      >
                        Costo Total:
                      </span>
                      <span
                        className='font-bold'
                        style={{ color: 'var(--color-text)' }}
                      >
                        {formatPrice(stats.totalCost)}
                      </span>
                    </div>

                    <div className='flex justify-between text-sm'>
                      <span
                        style={{ color: 'var(--color-text)', opacity: 0.7 }}
                      >
                        Valor de Venta:
                      </span>
                      <span
                        className='font-bold'
                        style={{ color: 'var(--color-text)' }}
                      >
                        {formatPrice(stats.totalValue)}
                      </span>
                    </div>

                    <div
                      className='flex justify-between text-sm mt-2 pt-2 border-t'
                      style={{ borderColor: 'var(--color-primary)' }}
                    >
                      <span
                        style={{ color: 'var(--color-text)', opacity: 0.7 }}
                      >
                        Ganancia Potencial:
                      </span>
                      <span
                        className='font-bold'
                        style={{ color: 'var(--color-accent)' }}
                      >
                        {formatPrice(potentialProfit)}
                      </span>
                    </div>
                  </div>
                );
              };

              return <InventoryStats key={category} />;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
