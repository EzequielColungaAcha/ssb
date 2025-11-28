import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, ShoppingCart, Package, TrendingDown, Filter } from 'lucide-react';
import { useSales } from '../hooks/useSales';
import { useProducts } from '../hooks/useProducts';
import { db, SaleItem } from '../lib/indexeddb';
import { formatPrice, formatNumber } from '../lib/utils';
import { SalesChart } from './SalesChart';

interface DailySales {
  date: string;
  total: number;
  count: number;
}

interface ProductSales {
  product_name: string;
  quantity: number;
  revenue: number;
  profit: number;
}

export function MetricsView() {
  const { sales } = useSales();
  const { products } = useProducts();
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [topProducts, setTopProducts] = useState<ProductSales[]>([]);
  const [allSoldProducts, setAllSoldProducts] = useState<ProductSales[]>([]);
  const [mostProfitableProducts, setMostProfitableProducts] = useState<ProductSales[]>([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [specificDate, setSpecificDate] = useState<string>('');
  const [filteredSalesState, setFilteredSalesState] = useState<typeof sales>([]);

  useEffect(() => {
    calculateMetrics();
  }, [sales, categoryFilter, dateFilter, startDate, endDate, specificDate]);

  const filterSalesByDate = (salesToFilter: typeof sales) => {
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
      const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      filterStartDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
      filterEndDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
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
          filterStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          filterEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
          filterEndDate.setHours(23, 59, 59, 999);
          break;
        default:
          return salesToFilter;
      }
    }

    return salesToFilter.filter(sale => {
      const saleDate = new Date(sale.completed_at);
      return saleDate >= filterStartDate && saleDate <= filterEndDate;
    });
  };

  const calculateMetrics = async () => {
    await db.init();
    const allSaleItems = await db.getAll<SaleItem>('sale_items');

    const dateFilteredSales = filterSalesByDate(sales);

    const filteredSaleItems = categoryFilter === 'all'
      ? allSaleItems
      : allSaleItems.filter(item => {
          const product = products.find(p => p.id === item.product_id);
          return product?.category === categoryFilter;
        });

    const relevantSaleIds = new Set(filteredSaleItems.map(item => item.sale_id));

    const salesByDate: { [key: string]: { total: number; count: number } } = {};
    const filteredSales = dateFilteredSales.filter(sale =>
      categoryFilter === 'all' || relevantSaleIds.has(sale.id)
    );

    setFilteredSalesState(filteredSales);

    filteredSales.forEach((sale) => {
      const date = new Date(sale.completed_at).toLocaleDateString('es-AR');
      if (!salesByDate[date]) {
        salesByDate[date] = { total: 0, count: 0 };
      }
      salesByDate[date].total += sale.total_amount;
      salesByDate[date].count += 1;
    });

    const dailyData = Object.entries(salesByDate)
      .map(([date, data]) => ({
        date,
        total: data.total,
        count: data.count,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7);

    setDailySales(dailyData);

    const filteredSaleIds = new Set(filteredSales.map(s => s.id));
    const dateAndCategoryFilteredItems = filteredSaleItems.filter(item =>
      filteredSaleIds.has(item.sale_id)
    );

    const productSales: { [key: string]: { quantity: number; revenue: number; profit: number } } = {};
    let profit = 0;

    dateAndCategoryFilteredItems.forEach((item: SaleItem) => {
      if (!productSales[item.product_name]) {
        productSales[item.product_name] = { quantity: 0, revenue: 0, profit: 0 };
      }
      const itemProfit = (item.product_price - (item.production_cost || 0)) * item.quantity;
      productSales[item.product_name].quantity += item.quantity;
      productSales[item.product_name].revenue += item.subtotal;
      productSales[item.product_name].profit += itemProfit;
      profit += itemProfit;
    });

    setTotalProfit(profit);

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
  };

  const filteredProducts = categoryFilter === 'all' ? products : products.filter(p => p.category === categoryFilter);

  const totalRevenue = filteredSalesState.reduce((sum, sale) => sum + sale.total_amount, 0);
  const totalSales = filteredSalesState.length;
  const averageSale = totalSales > 0 ? totalRevenue / totalSales : 0;
  const totalInventoryValue = filteredProducts.reduce((sum, product) => sum + product.price * product.stock, 0);

  const maxDailySale = Math.max(...dailySales.map((d) => d.total), 1);

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'burgers', label: 'Burgers' },
    { value: 'sides', label: 'Sides' },
    { value: 'drinks', label: 'Drinks' },
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>Metrics & Analytics</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={20} style={{ color: 'var(--color-text)' }} />
            <span className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border font-semibold"
              style={{ backgroundColor: 'var(--color-background-accent)', color: 'var(--color-text)', borderColor: 'var(--color-primary)' }}
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>Date:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border font-semibold"
              style={{ backgroundColor: 'var(--color-background-accent)', color: 'var(--color-text)', borderColor: 'var(--color-primary)' }}
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
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="px-4 py-2 rounded-lg border"
              style={{ backgroundColor: 'var(--color-background-accent)', color: 'var(--color-text)', borderColor: 'var(--color-primary)' }}
            />
          )}

          {dateFilter === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 rounded-lg border"
                style={{ backgroundColor: 'var(--color-background-accent)', color: 'var(--color-text)', borderColor: 'var(--color-primary)' }}
              />
              <span className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 rounded-lg border"
                style={{ backgroundColor: 'var(--color-background-accent)', color: 'var(--color-text)', borderColor: 'var(--color-primary)' }}
              />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
        <div className="rounded-lg shadow-md p-6" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="opacity-60" style={{ color: 'var(--color-text)' }}>Total Revenue</div>
            <DollarSign size={24} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{formatPrice(totalRevenue)}</div>
        </div>

        <div className="rounded-lg shadow-md p-6" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="opacity-60" style={{ color: 'var(--color-text)' }}>Total Sales</div>
            <ShoppingCart size={24} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{totalSales}</div>
        </div>

        <div className="rounded-lg shadow-md p-6" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="opacity-60" style={{ color: 'var(--color-text)' }}>Average Sale</div>
            <TrendingUp size={24} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{formatPrice(averageSale)}</div>
        </div>

        <div className="rounded-lg shadow-md p-6" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="opacity-60" style={{ color: 'var(--color-text)' }}>Total Profit</div>
            <TrendingUp size={24} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{formatPrice(totalProfit)}</div>
        </div>

        <div className="rounded-lg shadow-md p-6" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="opacity-60" style={{ color: 'var(--color-text)' }}>Inventory Value</div>
            <Package size={24} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{formatPrice(totalInventoryValue)}</div>
        </div>
      </div>

      <div className="mb-6">
        <SalesChart sales={filteredSalesState} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="rounded-lg shadow-md p-6" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>Productos Más Rentables</h2>
          <div className="space-y-4">
            {mostProfitableProducts.length === 0 ? (
              <div className="text-center text-gray-400 py-8">Aún no hay ventas de productos</div>
            ) : (
              mostProfitableProducts.map((product, index) => (
                <div key={product.product_name} className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background-accent)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: 'var(--color-accent)' }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{product.product_name}</div>
                      <div className="text-sm opacity-60 mt-1" style={{ color: 'var(--color-text)' }}>
                        {formatNumber(product.quantity)} unidades vendidas
                      </div>
                      <div className="text-xs mt-1 opacity-60" style={{ color: 'var(--color-text)' }}>
                        Revenue: {formatPrice(product.revenue)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs opacity-60 mb-1" style={{ color: 'var(--color-text)' }}>Profit</div>
                      <div className="text-lg font-bold" style={{ color: 'var(--color-accent)' }}>
                        {formatPrice(product.profit)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg shadow-md p-6" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>Productos Más Vendidos</h2>
          <div className="space-y-4">
            {topProducts.length === 0 ? (
              <div className="text-center text-gray-400 py-8">Aún no hay ventas de productos</div>
            ) : (
              topProducts.map((product, index) => (
                <div key={product.product_name} className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background-accent)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{product.product_name}</div>
                      <div className="text-sm opacity-60 mt-1" style={{ color: 'var(--color-text)' }}>
                        {formatNumber(product.quantity)} unidades vendidas
                      </div>
                      <div className="text-xs mt-1 opacity-60" style={{ color: 'var(--color-text)' }}>
                        Revenue: {formatPrice(product.revenue)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs opacity-60 mb-1" style={{ color: 'var(--color-text)' }}>Profit</div>
                      <div className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
                        {formatPrice(product.profit)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg shadow-md p-6 flex flex-col" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>Productos Vendidos</h2>
          <div className="space-y-4 overflow-y-auto scrollbar-hide" style={{ maxHeight: '500px' }}>
            {allSoldProducts.length === 0 ? (
              <div className="text-center text-gray-400 py-8">Aún no hay ventas de productos</div>
            ) : (
              (() => {
                const productsByCategory = allSoldProducts.reduce((acc, product) => {
                  const productInfo = products.find(p => p.name === product.product_name);
                  const category = productInfo?.category || 'N/A';
                  if (!acc[category]) {
                    acc[category] = [];
                  }
                  acc[category].push(product);
                  return acc;
                }, {} as Record<string, typeof topProducts>);

                const sortedCategories = Object.keys(productsByCategory).sort();

                return sortedCategories.map((category) => (
                  <div key={category} className="space-y-2">
                    <div className="font-semibold text-sm uppercase tracking-wide opacity-60 px-2" style={{ color: 'var(--color-text)' }}>
                      {category}
                    </div>
                    {productsByCategory[category].map((product) => (
                      <div
                        key={product.product_name}
                        className="flex justify-between items-center p-3 rounded-lg"
                        style={{ backgroundColor: 'var(--color-background-accent)' }}
                      >
                        <div className="flex-1">
                          <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{product.product_name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
                            {formatNumber(product.quantity)}
                          </div>
                          <div className="text-xs opacity-60" style={{ color: 'var(--color-text)' }}>
                            unidades
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

        <div className="rounded-lg shadow-md p-6" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>Estado del Inventario</h2>
          <div className="space-y-4">
            {(categoryFilter === 'all' ? ['burgers', 'sides', 'drinks'] : [categoryFilter]).map((category) => {
              const categoryProducts = products.filter((p) => p.category === category);
              const totalStock = categoryProducts.reduce((sum, p) => sum + p.stock, 0);
              const totalValue = categoryProducts.reduce((sum, p) => sum + p.price * p.stock, 0);
              const totalCost = categoryProducts.reduce((sum, p) => sum + p.production_cost * p.stock, 0);
              const potentialProfit = totalValue - totalCost;

              return (
                <div key={category} className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background-accent)' }}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-semibold capitalize dark:text-white">{category}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {categoryProducts.length} productos
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Unidades Totales:</span>
                    <span className="font-bold dark:text-white">{formatNumber(totalStock)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Costo Total:</span>
                    <span className="font-bold dark:text-white">{formatPrice(totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Valor de Venta:</span>
                    <span className="font-bold dark:text-white">{formatPrice(totalValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-primary)' }}>
                    <span className="text-gray-600 dark:text-gray-300">Ganancia Potencial:</span>
                    <span className="font-bold" style={{ color: 'var(--color-accent)' }}>{formatPrice(potentialProfit)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
