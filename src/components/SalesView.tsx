import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Package, History } from 'lucide-react';
import { useSales } from '../hooks/useSales';
import { Sale, SaleItem } from '../lib/indexeddb';
import { formatPrice, formatNumber } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';

export function SalesView() {
  const { theme } = useTheme();
  const { sales, getSaleItems, loading } = useSales();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);

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
    }
  }, [loadSaleItems, selectedSale]);

  if (loading) {
    return <div className='p-6 dark:text-white'>Cargando...</div>;
  }

  return (
    <div className='p-6'>
      <div className='mb-6'>
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
              {sales.length} {sales.length === 1 ? 'venta' : 'ventas'}
            </span>
          </div>
          <div className='space-y-3 max-h-[60vh] overflow-auto scrollbar-hide'>
            {sales.length === 0 ? (
              <div className='text-center text-gray-400 py-8'>
                Aún no hay ventas
              </div>
            ) : (
              sales.map((sale, index) => (
                <div
                  key={sale.id}
                  onClick={() => setSelectedSale(sale)}
                  className={`p-4 rounded-lg cursor-pointer transition-all ${
                    selectedSale?.id === sale.id ? '' : 'hover:opacity-70'
                  }`}
                  style={{
                    backgroundColor:
                      selectedSale?.id === sale.id
                        ? 'var(--color-primary)'
                        : 'var(--color-background-accent)',
                    color:
                      selectedSale?.id === sale.id
                        ? 'var(--color-on-primary)'
                        : 'var(--color-text)',
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
                        #{sales.length - index}
                      </div>
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
                    Pago: {sale.payment_method}
                    {sale.cash_received &&
                      ` | Recibido: ${formatPrice(sale.cash_received)}`}
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
                    <div className='font-semibold capitalize'>
                      {selectedSale.payment_method}
                    </div>
                  </div>
                </div>
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
                  {saleItems.map((item) => (
                    <div
                      key={item.id}
                      className='flex justify-between items-center p-3 rounded-lg'
                      style={{
                        backgroundColor: 'var(--color-background-accent)',
                      }}
                    >
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
                  ))}
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
