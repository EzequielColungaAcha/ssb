import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Package,
  History,
  User,
  Monitor,
  Truck,
  Home,
  MapPin,
  Clock,
  CreditCard,
  Banknote,
  Smartphone,
  Filter,
  X,
  DollarSign,
} from 'lucide-react';
import { useSales } from '../hooks/useSales';
import { db, Sale, SaleItem, AppSettings, Product, KDSOrder, resolveKdsMode } from '../lib/indexeddb';
import { formatPrice, formatNumber } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';
import { ViewLoader } from './LoadingScreen';

// Filter types
type PaymentMethodFilter = 'cash' | 'online' | 'card' | 'on_delivery';
type OrderTypeFilter = 'pickup' | 'delivery' | 'all';
type PaymentStatusFilter = 'paid' | 'unpaid' | 'all';

// Payment method labels for consistent display
const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  online: 'Transferencia',
  card: 'Tarjeta',
  on_delivery: 'Contra Entrega',
  unpaid: 'Sin Pagar',
};

// Bill denominations for Argentina
const BILL_DENOMINATIONS = [20000, 10000, 5000, 2000, 1000, 500, 200, 100];

export function SalesView() {
  const { theme } = useTheme();
  const { sales, getSaleItems, loading, updateSale, refresh } = useSales();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [paymentMethodFilters, setPaymentMethodFilters] = useState<Set<PaymentMethodFilter>>(new Set());
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('all');

  // Mark as paid state
  const [markPaymentMethod, setMarkPaymentMethod] = useState<
    'cash' | 'online' | 'card' | 'on_delivery'
  >('cash');
  const [markCashReceived, setMarkCashReceived] = useState(0);
  const [markBillHistory, setMarkBillHistory] = useState<number[]>([]);

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // Date from filter
      if (dateFrom) {
        const saleDate = new Date(sale.completed_at);
        const [year, month, day] = dateFrom.split('-').map(Number);
        const fromDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        if (saleDate < fromDate) return false;
      }

      // Date to filter
      if (dateTo) {
        const saleDate = new Date(sale.completed_at);
        const [year, month, day] = dateTo.split('-').map(Number);
        const toDate = new Date(year, month - 1, day, 23, 59, 59, 999);
        if (saleDate > toDate) return false;
      }

      // Payment method filter
      if (paymentMethodFilters.size > 0) {
        if (!paymentMethodFilters.has(sale.payment_method as PaymentMethodFilter)) {
          return false;
        }
      }

      // Order type filter
      if (orderTypeFilter !== 'all') {
        if (sale.order_type !== orderTypeFilter) return false;
      }

      // Payment status filter
      if (paymentStatusFilter !== 'all') {
        const isPaid = sale.payment_method !== 'unpaid';
        if (paymentStatusFilter === 'paid' && !isPaid) return false;
        if (paymentStatusFilter === 'unpaid' && isPaid) return false;
      }

      return true;
    });
  }, [sales, dateFrom, dateTo, paymentMethodFilters, orderTypeFilter, paymentStatusFilter]);

  // Toggle payment method filter
  const togglePaymentMethodFilter = (method: PaymentMethodFilter) => {
    setPaymentMethodFilters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(method)) {
        newSet.delete(method);
      } else {
        newSet.add(method);
      }
      return newSet;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setPaymentMethodFilters(new Set());
    setOrderTypeFilter('all');
    setPaymentStatusFilter('all');
  };

  // Check if any filters are active
  const hasActiveFilters = dateFrom || dateTo || paymentMethodFilters.size > 0 || orderTypeFilter !== 'all' || paymentStatusFilter !== 'all';

  const loadSaleItems = useCallback(
    async (saleId: string) => {
      const items = await getSaleItems(saleId);
      setSaleItems(items);
    },
    [getSaleItems]
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  useEffect(() => {
    if (selectedSale) {
      loadSaleItems(selectedSale.id);
      // Reset mark as paid state when selecting a new sale
      setMarkPaymentMethod('cash');
      setMarkCashReceived(0);
      setMarkBillHistory([]);
    }
  }, [loadSaleItems, selectedSale]);

  // Calculate change for mark as paid
  const markChange = useMemo(() => {
    if (!selectedSale) return 0;
    return markCashReceived - selectedSale.total_amount;
  }, [selectedSale, markCashReceived]);

  // Calculate change breakdown
  const markChangeBreakdown = useMemo(() => {
    if (markChange <= 0) return null;

    let remaining = markChange;
    const breakdown: { bill_value: number; quantity: number }[] = [];

    for (const denom of BILL_DENOMINATIONS) {
      if (remaining >= denom) {
        const count = Math.floor(remaining / denom);
        breakdown.push({ bill_value: denom, quantity: count });
        remaining = remaining % denom;
      }
    }

    // If there's remaining change we can't give with bills, return null
    if (remaining > 0) return null;
    return breakdown;
  }, [markChange]);

  const addMarkCash = (amount: number) => {
    setMarkCashReceived((prev) => prev + amount);
    setMarkBillHistory((prev) => [...prev, amount]);
  };

  const undoLastMarkBill = () => {
    if (markBillHistory.length > 0) {
      const lastBill = markBillHistory[markBillHistory.length - 1];
      setMarkCashReceived((prev) => prev - lastBill);
      setMarkBillHistory((prev) => prev.slice(0, -1));
    }
  };

  const resetMarkCash = () => {
    setMarkCashReceived(0);
    setMarkBillHistory([]);
  };

  const canMarkAsPaid = () => {
    if (!selectedSale || selectedSale.payment_method !== 'unpaid') return false;
    if (markPaymentMethod !== 'cash') return true;
    if (markCashReceived < selectedSale.total_amount) return false;
    if (markChange > 0 && !markChangeBreakdown) return false;
    return true;
  };

  const handleMarkAsPaid = async () => {
    if (!selectedSale || !canMarkAsPaid()) return;

    try {
      const updates: Partial<Sale> = {
        payment_method: markPaymentMethod,
      };

      if (markPaymentMethod === 'cash') {
        updates.cash_received = markCashReceived;
        updates.change_given = markChange;
        if (markChangeBreakdown) {
          const billsChange: Record<string, number> = {};
          markChangeBreakdown.forEach((b) => {
            billsChange[b.bill_value.toString()] = b.quantity;
          });
          updates.bills_change = billsChange;
        }
        // Track bills received
        const billsReceived: Record<string, number> = {};
        markBillHistory.forEach((bill) => {
          billsReceived[bill.toString()] =
            (billsReceived[bill.toString()] || 0) + 1;
        });
        updates.bills_received = billsReceived;
      }

      await updateSale(selectedSale.id, updates);
      // Refresh the selected sale
      const updatedSales = sales.map((s) =>
        s.id === selectedSale.id ? { ...s, ...updates } : s
      );
      const updatedSale = updatedSales.find((s) => s.id === selectedSale.id);
      if (updatedSale) {
        setSelectedSale(updatedSale as Sale);
      }
      await refresh();

      // Reset state
      setMarkCashReceived(0);
      setMarkBillHistory([]);
      setMarkPaymentMethod('cash');

      toast.success('¡Pago registrado correctamente!');
    } catch (error) {
      console.error('Error marking sale as paid:', error);
      toast.error('Error al registrar el pago');
    }
  };

  const sendSaleToKDS = async () => {
    if (!selectedSale || saleItems.length === 0) {
      toast.error('No hay venta seleccionada o la venta no tiene artículos');
      return;
    }

    try {
      // Load KDS settings
      await db.init();
      const settings = await db.get<AppSettings>('app_settings', 'default');
      const mode = resolveKdsMode(settings);

      if (mode === 'off') {
        toast.error('KDS no está habilitado');
        return;
      }

      if (mode === 'server' && !settings?.kds_url) {
        toast.error('No hay URL de servidor KDS configurada');
        return;
      }

      // Fetch product categories for items
      const itemsWithCategory = await Promise.all(
        saleItems.map(async (item) => {
          let category = 'otros';
          try {
            const product = await db.get<Product>('products', item.product_id);
            if (product?.category) {
              category = product.category;
            }
          } catch (error) {
            console.warn(`Could not fetch category for product ${item.product_id}:`, error);
          }

          return {
            product_name: item.product_name,
            quantity: item.quantity,
            product_price: item.product_price,
            removed_ingredients: item.removed_ingredients || [],
            combo_name: item.combo_name || null,
            category: category,
            variable_ingredients: item.variable_ingredients
              ? item.variable_ingredients.map((v) => ({
                  name: v.name,
                  quantity: v.quantity,
                }))
              : null,
          };
        })
      );

      const orderData = {
        sale_number: selectedSale.sale_number,
        items: itemsWithCategory,
        total: selectedSale.total_amount,
        payment_method: selectedSale.payment_method,
        scheduled_time: selectedSale.scheduled_time || null,
        customer_name: selectedSale.customer_name || null,
        order_type: selectedSale.order_type || null,
        delivery_address:
          selectedSale.order_type === 'delivery'
            ? selectedSale.delivery_address || null
            : null,
        created_at: new Date().toISOString(),
      };

      if (mode === 'local') {
        const localOrder: KDSOrder = {
          id: crypto.randomUUID(),
          ...orderData,
          status: 'pending',
        } as KDSOrder;
        await db.put('kds_orders', localOrder);
        toast.success(`Venta #${selectedSale.sale_number} enviada a KDS correctamente`);
        return;
      }

      // Server mode
      const response = await fetch(`${settings!.kds_url}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to send order to KDS:', response.statusText, errorText);
        toast.error(`Error al enviar a KDS: ${response.statusText}`);
        return;
      }

      toast.success(`Venta #${selectedSale.sale_number} enviada a KDS correctamente`);
    } catch (error) {
      console.error('Error sending sale to KDS:', error);
      toast.error('Error al enviar la venta a KDS');
    }
  };

  if (loading) {
    return <ViewLoader />;
  }

  return (
    <div className='p-6'>
      <div className='mb-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h1
              className='text-3xl font-bold flex items-center gap-3'
              style={{ color: 'var(--color-text)' }}
            >
              <History style={{ color: 'var(--color-primary)' }} />
              Historial de Ventas
            </h1>
            <p className='opacity-60 mt-2' style={{ color: 'var(--color-text)' }}>
              Consultá el registro completo de todas las transacciones realizadas
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className='flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all'
            style={{
              backgroundColor: hasActiveFilters ? 'var(--color-accent)' : 'var(--color-background-secondary)',
              color: hasActiveFilters ? 'var(--color-on-accent)' : 'var(--color-text)',
            }}
          >
            <Filter size={18} />
            Filtros
            {hasActiveFilters && (
              <span
                className='w-5 h-5 rounded-full text-xs flex items-center justify-center'
                style={{
                  backgroundColor: 'var(--color-on-accent)',
                  color: 'var(--color-accent)',
                }}
              >
                {(dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + paymentMethodFilters.size + (orderTypeFilter !== 'all' ? 1 : 0) + (paymentStatusFilter !== 'all' ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div
            className='mt-4 p-4 rounded-lg'
            style={{ backgroundColor: 'var(--color-background-secondary)' }}
          >
            <div className='flex items-center justify-between mb-4'>
              <h3
                className='font-semibold'
                style={{ color: 'var(--color-text)' }}
              >
                Filtros
              </h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className='text-sm flex items-center gap-1 hover:opacity-80'
                  style={{ color: 'var(--color-primary)' }}
                >
                  <X size={14} />
                  Limpiar filtros
                </button>
              )}
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
              {/* Date Range */}
              <div>
                <label
                  className='block text-sm font-medium mb-2'
                  style={{ color: 'var(--color-text)' }}
                >
                  Fecha desde
                </label>
                <input
                  type='date'
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className='w-full px-3 py-2 rounded-lg'
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-background-accent)',
                  }}
                />
              </div>
              <div>
                <label
                  className='block text-sm font-medium mb-2'
                  style={{ color: 'var(--color-text)' }}
                >
                  Fecha hasta
                </label>
                <input
                  type='date'
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className='w-full px-3 py-2 rounded-lg'
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-background-accent)',
                  }}
                />
              </div>

              {/* Order Type */}
              <div>
                <label
                  className='block text-sm font-medium mb-2'
                  style={{ color: 'var(--color-text)' }}
                >
                  Tipo de pedido
                </label>
                <div className='flex gap-1'>
                  {(['all', 'pickup', 'delivery'] as OrderTypeFilter[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setOrderTypeFilter(type)}
                      className='flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all'
                      style={{
                        backgroundColor: orderTypeFilter === type ? 'var(--color-accent)' : 'var(--color-background)',
                        color: orderTypeFilter === type ? 'var(--color-on-accent)' : 'var(--color-text)',
                      }}
                    >
                      {type === 'all' ? 'Todos' : type === 'pickup' ? 'Retiro' : 'Delivery'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Status */}
              <div>
                <label
                  className='block text-sm font-medium mb-2'
                  style={{ color: 'var(--color-text)' }}
                >
                  Estado de pago
                </label>
                <div className='flex gap-1'>
                  {(['all', 'paid', 'unpaid'] as PaymentStatusFilter[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => setPaymentStatusFilter(status)}
                      className='flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all'
                      style={{
                        backgroundColor: paymentStatusFilter === status ? 'var(--color-accent)' : 'var(--color-background)',
                        color: paymentStatusFilter === status ? 'var(--color-on-accent)' : 'var(--color-text)',
                      }}
                    >
                      {status === 'all' ? 'Todos' : status === 'paid' ? 'Pagado' : 'Sin pagar'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className='mt-4'>
              <label
                className='block text-sm font-medium mb-2'
                style={{ color: 'var(--color-text)' }}
              >
                Método de pago
              </label>
              <div className='flex flex-wrap gap-2'>
                {(
                  [
                    { key: 'cash', label: 'Efectivo', icon: Banknote },
                    { key: 'online', label: 'Transferencia', icon: Smartphone },
                    { key: 'card', label: 'Tarjeta', icon: CreditCard },
                    { key: 'on_delivery', label: 'Contra Entrega', icon: Truck },
                  ] as const
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => togglePaymentMethodFilter(key)}
                    className='flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all'
                    style={{
                      backgroundColor: paymentMethodFilters.has(key) ? 'var(--color-accent)' : 'var(--color-background)',
                      color: paymentMethodFilters.has(key) ? 'var(--color-on-accent)' : 'var(--color-text)',
                    }}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div
          className='rounded-lg shadow-md p-6'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <div className='flex justify-between items-center mb-4'>
            <h2
              className='text-xl font-bold'
              style={{ color: 'var(--color-text)' }}
            >
              Ventas Recientes
            </h2>
            <span
              className='text-sm opacity-60'
              style={{ color: 'var(--color-text)' }}
            >
              {filteredSales.length} {filteredSales.length === 1 ? 'venta' : 'ventas'}
              {hasActiveFilters && ` (de ${sales.length})`}
            </span>
          </div>
          <div className='space-y-3 max-h-[60vh] overflow-auto scrollbar-hide'>
            {filteredSales.length === 0 ? (
              <div className='text-center text-gray-400 py-8'>
                {hasActiveFilters ? 'No hay ventas que coincidan con los filtros' : 'Aún no hay ventas'}
              </div>
            ) : (
              filteredSales.map((sale) => (
                <div
                  key={sale.id}
                  onClick={() => setSelectedSale(sale)}
                  className={`p-4 rounded-lg cursor-pointer transition-all ${
                    selectedSale?.id === sale.id ? '' : 'hover:opacity-70'
                  } ${sale.payment_method === 'unpaid' ? 'border-l-4' : ''}`}
                  style={{
                    backgroundColor:
                      selectedSale?.id === sale.id
                        ? 'var(--color-primary)'
                        : sale.payment_method === 'unpaid'
                        ? 'var(--color-accent-light, rgba(239, 68, 68, 0.1))'
                        : 'var(--color-background-accent)',
                    color:
                      selectedSale?.id === sale.id
                        ? 'var(--color-on-primary)'
                        : 'var(--color-text)',
                    borderLeftColor:
                      sale.payment_method === 'unpaid' ? '#ef4444' : undefined,
                  }}
                >
                  <div className='flex justify-between items-start mb-2'>
                    <div className='flex items-center gap-3'>
                      <div
                        className='text-2xl font-bold'
                        style={{
                          color:
                            selectedSale?.id === sale.id
                              ? 'var(--color-on-primary)'
                              : 'var(--color-text)',
                        }}
                      >
                        #{parseInt(
                            sale.sale_number.replace(/^S-/, '')
                          ).toLocaleString('es-AR')}
                      </div>
                      {sale.payment_method === 'unpaid' && (
                        <span
                          className='text-xs px-2 py-0.5 rounded-full font-bold'
                          style={{
                            backgroundColor: '#ef4444',
                            color: 'white',
                          }}
                        >
                          SIN PAGAR
                        </span>
                      )}
                    </div>
                    <div className='text-lg font-bold'>
                      {formatPrice(sale.total_amount)}
                    </div>
                  </div>
                  <div className='text-sm opacity-90 flex items-center gap-2'>
                    <Calendar size={14} />
                    {formatDate(sale.completed_at)}
                  </div>
                  <div className='text-sm opacity-90 mt-1'>
                    Pago:{' '}
                    {PAYMENT_LABELS[sale.payment_method] || sale.payment_method}
                    {sale.cash_received &&
                      ` | Recibido: ${formatPrice(sale.cash_received)}`}
                  </div>
                  {/* Customer name and order type */}
                  <div className='flex items-center gap-2 mt-2 flex-wrap'>
                    {sale.customer_name && (
                      <span className='text-xs flex items-center gap-1 opacity-80'>
                        <User size={12} />
                        {sale.customer_name}
                      </span>
                    )}
                    {sale.order_type && (
                      <span
                        className='text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1'
                        style={{
                          backgroundColor:
                            sale.order_type === 'delivery'
                              ? '#3b82f6'
                              : '#10b981',
                          color: 'white',
                        }}
                      >
                        {sale.order_type === 'delivery' ? (
                          <>
                            <Truck size={10} /> Delivery
                          </>
                        ) : (
                          <>
                            <Home size={10} /> Retiro
                          </>
                        )}
                      </span>
                    )}
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
            Detalles de Venta
          </h2>
          {selectedSale ? (
            <div>
              <div
                className='mb-6 p-4 rounded-lg'
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                }}
              >
                <div className='text-sm opacity-90 mb-1'>Venta</div>
                <div className='text-2xl font-bold mb-3'>
                  #
                  {parseInt(
                    selectedSale.sale_number.replace(/^S-/, '')
                  ).toLocaleString('es-AR')}
                </div>
                <div className='grid grid-cols-2 gap-4 text-sm'>
                  <div>
                    <div className='opacity-90'>Fecha</div>
                    <div className='font-semibold'>
                      {formatDate(selectedSale.completed_at)}
                    </div>
                  </div>
                  <div>
                    <div className='opacity-90'>Pago</div>
                    <div className='font-semibold'>
                      {PAYMENT_LABELS[selectedSale.payment_method] ||
                        selectedSale.payment_method}
                    </div>
                  </div>
                  {selectedSale.customer_name && (
                    <div>
                      <div className='opacity-90'>Cliente</div>
                      <div className='font-semibold flex items-center gap-1'>
                        <User size={12} />
                        {selectedSale.customer_name}
                      </div>
                    </div>
                  )}
                  {selectedSale.order_type && (
                    <div>
                      <div className='opacity-90'>Tipo</div>
                      <div className='font-semibold flex items-center gap-1'>
                        {selectedSale.order_type === 'delivery' ? (
                          <>
                            <Truck size={12} /> Delivery
                          </>
                        ) : (
                          <>
                            <Home size={12} /> Retiro
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {selectedSale.delivery_address && (
                  <div className='mt-3 text-sm'>
                    <div className='opacity-90'>Dirección</div>
                    <div className='font-semibold flex items-center gap-1'>
                      <MapPin size={12} />
                      {selectedSale.delivery_address}
                    </div>
                  </div>
                )}
                {selectedSale.scheduled_time && (
                  <div className='mt-3 text-sm'>
                    <div className='opacity-90'>Hora programada</div>
                    <div className='font-semibold flex items-center gap-1'>
                      <Clock size={12} />
                      {new Date(selectedSale.scheduled_time).toLocaleTimeString(
                        'es-AR',
                        { hour: '2-digit', minute: '2-digit', hour12: false }
                      )}
                    </div>
                  </div>
                )}
                {selectedSale.delivered_at && (
                  <div className='mt-3 text-sm'>
                    <div className='opacity-90'>Entregado</div>
                    <div className='font-semibold'>
                      {formatDate(selectedSale.delivered_at)}
                    </div>
                  </div>
                )}
              </div>

              <div className='mb-4'>
                <h3
                  className='font-semibold mb-3 flex items-center gap-2'
                  style={{ color: 'var(--color-text)' }}
                >
                  <Package size={18} />
                  Artículos
                </h3>
                <div className='space-y-2'>
                  {(() => {
                    // Group items by combo_instance_id (for combos) or leave as standalone
                    const comboInstanceGroups: Map<string, { comboName: string; items: typeof saleItems }> = new Map();
                    const standaloneItems: typeof saleItems = [];

                    saleItems.forEach((item) => {
                      if (item.combo_instance_id && item.combo_name) {
                        // New format: use combo_instance_id
                        const existing = comboInstanceGroups.get(item.combo_instance_id);
                        if (existing) {
                          existing.items.push(item);
                        } else {
                          comboInstanceGroups.set(item.combo_instance_id, {
                            comboName: item.combo_name,
                            items: [item],
                          });
                        }
                      } else if (item.combo_name && !item.combo_instance_id) {
                        // Legacy format: fallback to old grouping by combo_name
                        // Find or create a group for this combo_name
                        let foundGroup = false;
                        comboInstanceGroups.forEach((group, key) => {
                          if (key.startsWith('legacy-') && group.comboName === item.combo_name) {
                            group.items.push(item);
                            foundGroup = true;
                          }
                        });
                        if (!foundGroup) {
                          comboInstanceGroups.set(`legacy-${item.combo_name}-${crypto.randomUUID()}`, {
                            comboName: item.combo_name,
                            items: [item],
                          });
                        }
                      } else {
                        standaloneItems.push(item);
                      }
                    });

                    // Helper to create a signature for a combo instance (for grouping identical combos)
                    const getItemSignature = (item: (typeof saleItems)[0]) => {
                      const removed = (item.removed_ingredients || [])
                        .sort()
                        .join(',');
                      return `${item.product_name}|${removed}`;
                    };

                    // Create signature for grouping identical combos
                    // Sort by combo_slot_index to ensure consistent ordering for signature
                    const getComboInstanceSignature = (
                      items: typeof saleItems
                    ) => {
                      // Sort by slot index for consistent signature (identical combos should match)
                      const sortedItems = [...items].sort((a, b) => 
                        (a.combo_slot_index ?? 0) - (b.combo_slot_index ?? 0)
                      );
                      return sortedItems.map(getItemSignature).join('::');
                    };

                    // Process combo instances and group identical ones
                    type ComboInstance = {
                      comboName: string;
                      items: typeof saleItems;
                      quantity: number;
                      unitPrice: number;
                      total: number;
                    };

                    const processedCombos: ComboInstance[] = [];
                    const signatureMap = new Map<string, ComboInstance>();

                    comboInstanceGroups.forEach(({ comboName, items }) => {
                      const signature = `${comboName}::${getComboInstanceSignature(items)}`;
                      // Use combo_unit_price if available, otherwise fall back to sum of products
                      const comboUnitPrice = items[0]?.combo_unit_price;
                      const instanceTotal = comboUnitPrice !== undefined
                        ? comboUnitPrice
                        : items.reduce((sum, item) => sum + item.subtotal, 0);
                      const existing = signatureMap.get(signature);
                      if (existing) {
                        existing.quantity++;
                        existing.total += instanceTotal;
                      } else {
                        const newCombo: ComboInstance = {
                          comboName,
                          items,
                          quantity: 1,
                          unitPrice: instanceTotal,
                          total: instanceTotal,
                        };
                        signatureMap.set(signature, newCombo);
                        processedCombos.push(newCombo);
                      }
                    });

                    return (
                      <>
                        {/* Render combo groups */}
                        {processedCombos.map((combo, comboIdx) => (
                          <div
                            key={`${combo.comboName}-${comboIdx}`}
                            className='p-3 rounded-lg'
                            style={{
                              backgroundColor: 'var(--color-background-accent)',
                            }}
                          >
                            {/* Combo header */}
                            <div className='flex justify-between items-center mb-2'>
                              <div
                                className='font-bold flex items-center gap-2'
                                style={{ color: 'var(--color-text)' }}
                              >
                                <span
                                  className='text-xs px-1.5 py-0.5 rounded'
                                  style={{
                                    backgroundColor: 'var(--color-accent)',
                                    color: 'var(--color-on-accent)',
                                  }}
                                >
                                  {combo.quantity > 1
                                    ? `${combo.quantity}x COMBO`
                                    : 'COMBO'}
                                </span>
                                {combo.comboName}
                              </div>
                              <div
                                className='font-bold'
                                style={{ color: 'var(--color-text)' }}
                              >
                                {combo.quantity > 1 ? (
                                  <span>
                                    {formatPrice(combo.unitPrice)} × {combo.quantity} = {formatPrice(combo.total)}
                                  </span>
                                ) : (
                                  <span>{formatPrice(combo.total)}</span>
                                )}
                              </div>
                            </div>
                            {/* Combo products - sorted by slot index for proper order */}
                            <div
                              className='pl-3 border-l-2 space-y-1'
                              style={{
                                borderColor: 'var(--color-accent)',
                              }}
                            >
                              {[...combo.items]
                                .sort((a, b) => (a.combo_slot_index ?? 0) - (b.combo_slot_index ?? 0))
                                .map((item, itemIdx) => (
                                <div key={itemIdx}>
                                  <div
                                    className='text-sm'
                                    style={{ color: 'var(--color-text)' }}
                                  >
                                    {item.product_name}
                                  </div>
                                  {item.removed_ingredients &&
                                    item.removed_ingredients.length > 0 && (
                                      <div
                                        className='text-xs italic'
                                        style={{
                                          color: 'var(--color-primary)',
                                        }}
                                      >
                                        Sin:{' '}
                                        {item.removed_ingredients.join(', ')}
                                      </div>
                                    )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        {/* Render standalone items */}
                        {standaloneItems.map((item) => (
                          <div
                            key={item.id}
                            className='p-3 rounded-lg'
                            style={{
                              backgroundColor: 'var(--color-background-accent)',
                            }}
                          >
                            <div className='flex justify-between items-center'>
                              <div>
                                <div
                                  className='font-semibold'
                                  style={{ color: 'var(--color-text)' }}
                                >
                                  {item.product_name}
                                </div>
                                <div
                                  className='text-sm opacity-60'
                                  style={{ color: 'var(--color-text)' }}
                                >
                                  {formatPrice(item.product_price)} ×{' '}
                                  {formatNumber(item.quantity)}
                                </div>
                              </div>
                              <div
                                className='font-bold'
                                style={{ color: 'var(--color-text)' }}
                              >
                                {formatPrice(item.subtotal)}
                              </div>
                            </div>
                            {item.removed_ingredients &&
                              item.removed_ingredients.length > 0 && (
                                <div
                                  className='text-xs italic mt-1'
                                  style={{ color: 'var(--color-primary)' }}
                                >
                                  Sin: {item.removed_ingredients.join(', ')}
                                </div>
                              )}
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className='border-t pt-4 space-y-2'>
                <div
                  className='flex justify-between text-lg'
                  style={{ color: 'var(--color-text)' }}
                >
                  <span>Total:</span>
                  <span className='font-bold'>
                    {formatPrice(selectedSale.total_amount)}
                  </span>
                </div>
                {selectedSale.cash_received && (
                  <>
                    <div className='pt-2'>
                      <div
                        className='flex justify-between text-sm mb-2'
                        style={{ color: 'var(--color-text)' }}
                      >
                        <span className='font-semibold'>
                          Efectivo Recibido:
                        </span>
                        <span className='font-bold'>
                          {formatPrice(selectedSale.cash_received)}
                        </span>
                      </div>
                      {selectedSale.bills_received &&
                        Object.keys(selectedSale.bills_received).length > 0 && (
                          <div className='ml-4 mt-1 flex flex-wrap gap-1'>
                            {Object.entries(selectedSale.bills_received)
                              .sort(([a], [b]) => Number(b) - Number(a))
                              .map(([denomination, quantity]) => (
                                <span
                                  key={denomination}
                                  className={`text-xs px-2 py-1 rounded ${
                                    theme === 'light'
                                      ? 'bg-emerald-800 text-emerald-100 ring-1 ring-emerald-900'
                                      : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
                                  }`}
                                >
                                  {formatNumber(quantity)}x{' '}
                                  {formatPrice(Number(denomination))}
                                </span>
                              ))}
                          </div>
                        )}
                    </div>

                    <div className='pt-2'>
                      <div className='flex justify-between text-sm dark:text-gray-300 mb-2'>
                        <span className='font-semibold'>Cambio Entregado:</span>
                        <span className='font-bold'>
                          {formatPrice(selectedSale.change_given || 0)}
                        </span>
                      </div>
                      {selectedSale.bills_change &&
                        Object.keys(selectedSale.bills_change).length > 0 && (
                          <div className='ml-4 mt-1 flex flex-wrap gap-1'>
                            {Object.entries(selectedSale.bills_change)
                              .sort(([a], [b]) => Number(b) - Number(a))
                              .map(([denomination, quantity]) => (
                                <span
                                  key={denomination}
                                  className={`text-xs px-2 py-1 rounded ${
                                    theme === 'light'
                                      ? 'bg-rose-800 text-rose-100 ring-1 ring-rose-900'
                                      : 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'
                                  }`}
                                >
                                  {formatNumber(quantity)}x{' '}
                                  {formatPrice(Number(denomination))}
                                </span>
                              ))}
                          </div>
                        )}
                    </div>
                  </>
                )}
              </div>

              {/* Send to KDS Button */}
              <div className='mt-6'>
                <button
                  onClick={sendSaleToKDS}
                  disabled={!selectedSale || saleItems.length === 0}
                  className='w-full py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all'
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                  }}
                >
                  <Monitor size={18} />
                  Enviar a KDS
                </button>
              </div>

              {/* Mark as Paid Section - Only shows for unpaid sales */}
              {selectedSale.payment_method === 'unpaid' && (
                <div
                  className='mt-6 p-4 rounded-lg border-2 border-dashed'
                  style={{ borderColor: 'var(--color-accent)' }}
                >
                  <h3
                    className='font-bold mb-4 flex items-center gap-2'
                    style={{ color: 'var(--color-text)' }}
                  >
                    <DollarSign size={18} />
                    Marcar como Pagado
                  </h3>

                  {/* Payment Method Selector */}
                  <div className='grid grid-cols-2 gap-2 mb-4'>
                    <button
                      onClick={() => setMarkPaymentMethod('cash')}
                      className='py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm'
                      style={
                        markPaymentMethod === 'cash'
                          ? {
                              backgroundColor: 'var(--color-primary)',
                              color: 'var(--color-on-primary)',
                            }
                          : {
                              backgroundColor: 'var(--color-background-accent)',
                              color: 'var(--color-text)',
                            }
                      }
                    >
                      <Banknote size={16} />
                      Efectivo
                    </button>
                    <button
                      onClick={() => setMarkPaymentMethod('online')}
                      className='py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm'
                      style={
                        markPaymentMethod === 'online'
                          ? {
                              backgroundColor: 'var(--color-primary)',
                              color: 'var(--color-on-primary)',
                            }
                          : {
                              backgroundColor: 'var(--color-background-accent)',
                              color: 'var(--color-text)',
                            }
                      }
                    >
                      <Smartphone size={16} />
                      Transferencia
                    </button>
                    <button
                      onClick={() => setMarkPaymentMethod('card')}
                      className='py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm'
                      style={
                        markPaymentMethod === 'card'
                          ? {
                              backgroundColor: 'var(--color-primary)',
                              color: 'var(--color-on-primary)',
                            }
                          : {
                              backgroundColor: 'var(--color-background-accent)',
                              color: 'var(--color-text)',
                            }
                      }
                    >
                      <CreditCard size={16} />
                      Tarjeta
                    </button>
                    <button
                      onClick={() => setMarkPaymentMethod('on_delivery')}
                      className='py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm'
                      style={
                        markPaymentMethod === 'on_delivery'
                          ? {
                              backgroundColor: 'var(--color-primary)',
                              color: 'var(--color-on-primary)',
                            }
                          : {
                              backgroundColor: 'var(--color-background-accent)',
                              color: 'var(--color-text)',
                            }
                      }
                    >
                      <Truck size={16} />
                      Contra Entrega
                    </button>
                  </div>

                  {/* Cash Calculator - Only for cash payment */}
                  {markPaymentMethod === 'cash' && (
                    <div className='mb-4'>
                      <div className='flex items-center justify-between mb-2'>
                        <span
                          className='text-sm'
                          style={{ color: 'var(--color-text)' }}
                        >
                          Efectivo Recibido:
                        </span>
                        <span
                          className='font-bold'
                          style={{ color: 'var(--color-text)' }}
                        >
                          {formatPrice(markCashReceived)}
                        </span>
                      </div>

                      {/* Bill denomination buttons */}
                      <div className='grid grid-cols-4 gap-2 mb-3'>
                        {BILL_DENOMINATIONS.map((denom) => (
                          <button
                            key={denom}
                            onClick={() => addMarkCash(denom)}
                            className='py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80'
                            style={{
                              backgroundColor: 'var(--color-background-accent)',
                              color: 'var(--color-text)',
                            }}
                          >
                            {formatPrice(denom)}
                          </button>
                        ))}
                      </div>

                      {/* Undo and Reset buttons */}
                      <div className='flex gap-2 mb-3'>
                        <button
                          onClick={undoLastMarkBill}
                          disabled={markBillHistory.length === 0}
                          className='flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-50'
                          style={{
                            backgroundColor: 'var(--color-background-accent)',
                            color: 'var(--color-text)',
                          }}
                        >
                          Deshacer
                        </button>
                        <button
                          onClick={resetMarkCash}
                          disabled={markCashReceived === 0}
                          className='flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-50'
                          style={{
                            backgroundColor: 'var(--color-background-accent)',
                            color: 'var(--color-text)',
                          }}
                        >
                          Reiniciar
                        </button>
                      </div>

                      {/* Change display */}
                      {markCashReceived >= selectedSale.total_amount && (
                        <div
                          className='p-3 rounded-lg'
                          style={{
                            backgroundColor: 'var(--color-background-accent)',
                          }}
                        >
                          <div
                            className='flex justify-between mb-2'
                            style={{ color: 'var(--color-text)' }}
                          >
                            <span>Cambio:</span>
                            <span className='font-bold'>
                              {formatPrice(markChange)}
                            </span>
                          </div>
                          {markChangeBreakdown && markChange > 0 && (
                            <div className='flex flex-wrap gap-1'>
                              {markChangeBreakdown.map((b, idx) => (
                                <span
                                  key={idx}
                                  className='text-xs px-2 py-1 rounded'
                                  style={{
                                    backgroundColor: 'var(--color-accent)',
                                    color: 'var(--color-on-accent)',
                                  }}
                                >
                                  {b.quantity}x {formatPrice(b.bill_value)}
                                </span>
                              ))}
                            </div>
                          )}
                          {!markChangeBreakdown && markChange > 0 && (
                            <div
                              className='text-xs text-center opacity-70'
                              style={{ color: 'var(--color-text)' }}
                            >
                              No se puede dar cambio exacto
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Confirm Button */}
                  <button
                    onClick={handleMarkAsPaid}
                    disabled={!canMarkAsPaid()}
                    className='w-full py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed'
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-on-primary)',
                    }}
                  >
                    Confirmar Pago
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className='text-center text-gray-400 py-12'>
              Selecciona una venta para ver detalles
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
