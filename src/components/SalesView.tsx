import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Package,
  History,
  User,
  Truck,
  Home,
  MapPin,
  Clock,
} from 'lucide-react';
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
                    <div className='font-semibold capitalize'>
                      {selectedSale.payment_method}
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
                    // Group items by combo_name
                    const comboGroups: Record<string, typeof saleItems> = {};
                    const standaloneItems: typeof saleItems = [];

                    saleItems.forEach((item) => {
                      if (item.combo_name) {
                        if (!comboGroups[item.combo_name]) {
                          comboGroups[item.combo_name] = [];
                        }
                        comboGroups[item.combo_name].push(item);
                      } else {
                        standaloneItems.push(item);
                      }
                    });

                    // Helper to create a signature for a combo instance
                    const getItemSignature = (item: (typeof saleItems)[0]) => {
                      const removed = (item.removed_ingredients || [])
                        .sort()
                        .join(',');
                      return `${item.product_name}|${removed}`;
                    };

                    // Helper to detect combo size (products per combo instance)
                    const detectComboSize = (items: typeof saleItems) => {
                      if (items.length <= 1) return items.length;
                      // Find when the first product name repeats
                      const firstProductName = items[0].product_name;
                      for (let i = 1; i < items.length; i++) {
                        if (items[i].product_name === firstProductName) {
                          return i;
                        }
                      }
                      return items.length; // No repeat found, all items are one combo
                    };

                    // Helper to get signature for a combo instance (array of items)
                    const getComboInstanceSignature = (
                      items: typeof saleItems
                    ) => {
                      return items.map(getItemSignature).join('::');
                    };

                    // Process combo groups into unique instances with quantities
                    type ComboInstance = {
                      comboName: string;
                      items: typeof saleItems;
                      quantity: number;
                      total: number;
                    };

                    const processedCombos: ComboInstance[] = [];

                    Object.entries(comboGroups).forEach(
                      ([comboName, allItems]) => {
                        const comboSize = detectComboSize(allItems);
                        const instances: (typeof saleItems)[] = [];

                        // Split items into individual combo instances
                        for (let i = 0; i < allItems.length; i += comboSize) {
                          instances.push(allItems.slice(i, i + comboSize));
                        }

                        // Group identical instances
                        const instanceMap = new Map<
                          string,
                          { items: typeof saleItems; count: number }
                        >();

                        instances.forEach((instance) => {
                          const signature = getComboInstanceSignature(instance);
                          const existing = instanceMap.get(signature);
                          if (existing) {
                            existing.count++;
                          } else {
                            instanceMap.set(signature, {
                              items: instance,
                              count: 1,
                            });
                          }
                        });

                        // Convert to processed combos
                        instanceMap.forEach(({ items, count }) => {
                          const instanceTotal = items.reduce(
                            (sum, item) => sum + item.subtotal,
                            0
                          );
                          processedCombos.push({
                            comboName,
                            items,
                            quantity: count,
                            total: instanceTotal * count,
                          });
                        });
                      }
                    );

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
                                {formatPrice(combo.total)}
                              </div>
                            </div>
                            {/* Combo products */}
                            <div
                              className='pl-3 border-l-2 space-y-1'
                              style={{
                                borderColor: 'var(--color-accent)',
                              }}
                            >
                              {combo.items.map((item, itemIdx) => (
                                <div key={itemIdx}>
                                  <div
                                    className='text-sm'
                                    style={{ color: 'var(--color-text)' }}
                                  >
                                    {combo.quantity > 1
                                      ? `${combo.quantity}x `
                                      : ''}
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
