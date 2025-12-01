import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Plus,
  Minus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  History,
  DoorClosed,
  X,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCashDrawer } from '../hooks/useCashDrawer';
import { useSales } from '../hooks/useSales';
import { CashMovement, Sale, SaleItem } from '../lib/indexeddb';
import { translations as t } from '../lib/translations';
import { formatPrice, formatNumber } from '../lib/utils';
import { Button } from './ui/button';
import { useTheme } from '../contexts/ThemeContext';

export function CashDrawerView() {
  const {
    bills,
    updateBillQuantity,
    getTotalCash,
    getCashMovements,
    resetCashDrawer,
    loading,
  } = useCashDrawer();
  const { theme } = useTheme();
  const { getSaleById, getSaleItems } = useSales();
  const [editingBill, setEditingBill] = useState<number | null>(null);
  const [newQuantity, setNewQuantity] = useState('');
  const [showMovements, setShowMovements] = useState(false);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [filterMovementType, setFilterMovementType] = useState<string>('all');
  const [filterBillDenomination, setFilterBillDenomination] =
    useState<string>('all');

  const loadMovements = useCallback(async () => {
    setLoadingMovements(true);
    const data = await getCashMovements();
    setMovements(data);
    setLoadingMovements(false);
  }, [getCashMovements]);

  useEffect(() => {
    if (showMovements) {
      loadMovements();
    }
  }, [loadMovements, showMovements]);

  const handleUpdateQuantity = async (billValue: number, quantity: number) => {
    try {
      const bill = bills.find((b) => b.denomination === billValue);
      const isIncrease = bill && quantity > bill.quantity;
      const logType = isIncrease ? 'manual_add' : 'manual_remove';
      const description = isIncrease
        ? 'Ajuste manual (agregado)'
        : 'Ajuste manual (retiro)';

      await updateBillQuantity(billValue, quantity, logType, description);
      setEditingBill(null);
      setNewQuantity('');
      if (showMovements) {
        loadMovements();
      }
    } catch (error) {
      toast.error(t.cashDrawer.errorUpdating);
      console.error(error);
    }
  };

  const handleQuickAdjust = async (billValue: number, change: number) => {
    const bill = bills.find((b) => b.denomination === billValue);
    if (bill) {
      const newQty = Math.max(0, bill.quantity + change);
      await handleUpdateQuantity(billValue, newQty);
    }
  };

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

  const getMovementTypeLabel = (type: CashMovement['movement_type']) => {
    switch (type) {
      case 'sale':
        return t.cashDrawer.movementSale;
      case 'manual_add':
        return t.cashDrawer.movementManualAdd;
      case 'manual_remove':
        return t.cashDrawer.movementManualRemove;
      case 'change_given':
        return t.cashDrawer.movementChangeGiven;
      case 'cash_closing':
        return t.cashDrawer.movementCashClosing;
    }
  };

  const getMovementColor = (type: CashMovement['movement_type']) => {
    switch (type) {
      case 'sale':
      case 'manual_add':
        return 'text-green-600 dark:text-green-400';
      case 'manual_remove':
      case 'change_given':
        return 'text-red-600 dark:text-red-400';
      case 'cash_closing':
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  const filteredMovements = movements.filter((movement) => {
    if (
      filterMovementType !== 'all' &&
      movement.movement_type !== filterMovementType
    ) {
      return false;
    }

    if (filterBillDenomination !== 'all') {
      const hasBillIn =
        movement.bills_in &&
        Object.keys(movement.bills_in).includes(filterBillDenomination);
      const hasBillOut =
        movement.bills_out &&
        Object.keys(movement.bills_out).includes(filterBillDenomination);
      if (!hasBillIn && !hasBillOut) {
        return false;
      }
    }

    return true;
  });

  const handleResetCashDrawer = () => {
    const totalCash = getTotalCash();

    if (totalCash === 0) {
      toast.error('La caja ya está vacía');
      return;
    }

    toast('Cierre de Caja', {
      description: `¿Estás seguro de que deseas cerrar la caja? Se registrará el estado actual (${formatPrice(
        totalCash
      )}) y todos los billetes se establecerán a 0.`,
      action: {
        label: 'Cerrar',
        onClick: async () => {
          try {
            await resetCashDrawer();
            toast.success('Caja cerrada correctamente');
            if (showMovements) {
              loadMovements();
            }
          } catch (error) {
            toast.error('Error al cerrar la caja');
            console.error(error);
          }
        },
      },
      cancel: {
        label: 'Cancelar',
        onClick: () => {},
      },
    });
  };

  const handleViewSale = async (saleId: string) => {
    try {
      const sale = await getSaleById(saleId);
      if (sale) {
        setSelectedSale(sale);
        const items = await getSaleItems(saleId);
        setSaleItems(items);
        setShowSaleModal(true);
      } else {
        toast.error('No se pudo cargar la venta');
      }
    } catch (error) {
      toast.error('Error al cargar los detalles de la venta');
      console.error(error);
    }
  };

  if (loading) {
    return <div className='p-6 dark:text-white'>{t.cashDrawer.loading}</div>;
  }

  const totalCash = getTotalCash();

  return (
    <div className='p-6'>
      <div className='mb-6'>
        <h1
          className='text-3xl font-bold flex items-center gap-3'
          style={{ color: 'var(--color-text)' }}
        >
          <Wallet style={{ color: 'var(--color-primary)' }} />
          {t.cashDrawer.title}
        </h1>
        <p className='opacity-60 mt-2' style={{ color: 'var(--color-text)' }}>
          {t.cashDrawer.subtitle}
        </p>
      </div>

      <div
        className='rounded-lg shadow-lg p-6 mb-6'
        style={{ backgroundColor: 'var(--color-background-secondary)' }}
      >
        <div className='flex items-center justify-between mb-4'>
          <div>
            <div
              className='text-sm opacity-60 mb-1'
              style={{ color: 'var(--color-text)' }}
            >
              {t.cashDrawer.totalCash}
            </div>
            <div
              className='text-4xl font-bold'
              style={{ color: 'var(--color-primary)' }}
            >
              {formatPrice(totalCash)}
            </div>
          </div>
          <Wallet size={64} className='text-gray-300 dark:text-gray-600' />
        </div>
        <Button
          onClick={handleResetCashDrawer}
          disabled={totalCash === 0}
          className='w-full py-2 px-4 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-colors'
          variant='secondary'
        >
          <DoorClosed size={18} />
          Cierre de Caja
        </Button>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6'>
        {bills.map((bill) => (
          <div
            key={bill.denomination}
            className='rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow'
            style={{ backgroundColor: 'var(--color-background-secondary)' }}
          >
            <div className='flex items-center justify-between mb-4'>
              <div>
                <div
                  className='text-sm opacity-60'
                  style={{ color: 'var(--color-text)' }}
                >
                  {t.cashDrawer.billValue}
                </div>
                <div
                  className='text-2xl font-bold'
                  style={{ color: 'var(--color-text)' }}
                >
                  {formatPrice(bill.denomination)}
                </div>
              </div>
              <div className='text-right'>
                <div
                  className='text-sm opacity-60'
                  style={{ color: 'var(--color-text)' }}
                >
                  {t.cashDrawer.quantity}
                </div>
                {editingBill === bill.denomination ? (
                  <div className='flex items-center gap-2 mt-1'>
                    <input
                      type='number'
                      min='0'
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      className='w-20 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                      autoFocus
                    />
                    <button
                      onClick={() =>
                        handleUpdateQuantity(
                          bill.denomination,
                          parseInt(newQuantity) || 0
                        )
                      }
                      className='px-2 py-1 rounded text-white text-sm'
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      {t.cashDrawer.save}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingBill(bill.denomination);
                      setNewQuantity(bill.quantity.toString());
                    }}
                    className='text-3xl font-bold hover:opacity-70'
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatNumber(bill.quantity)}
                  </button>
                )}
              </div>
            </div>

            <div className='flex items-center justify-between mb-3'>
              <span
                className='text-sm opacity-60'
                style={{ color: 'var(--color-text)' }}
              >
                {t.cashDrawer.totalValue}
              </span>
              <span
                className='font-bold text-lg'
                style={{ color: 'var(--color-text)' }}
              >
                {formatPrice(bill.denomination * bill.quantity)}
              </span>
            </div>

            <div className='flex gap-2'>
              <button
                onClick={() => handleQuickAdjust(bill.denomination, -1)}
                disabled={bill.quantity === 0}
                className='flex-1 py-2 px-3 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1'
              >
                <Minus size={16} />
                {t.cashDrawer.remove}
              </button>
              <button
                onClick={() => handleQuickAdjust(bill.denomination, 1)}
                className='flex-1 py-2 px-3 rounded text-white hover:opacity-90 flex items-center justify-center gap-1'
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                }}
              >
                <Plus size={16} />
                {t.cashDrawer.add}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div
        className='mt-6 rounded-lg p-4 mb-6 border transition-colors'
        style={{
          backgroundColor: 'var(--color-background-accent)',
          borderColor: 'var(--color-accent)',
        }}
      >
        <div className='flex items-start gap-3'>
          <RefreshCw
            size={20}
            className='mt-0.5'
            style={{ color: 'var(--color-accent)' }}
          />
          <div className='text-sm' style={{ color: 'var(--color-text)' }}>
            <div
              className='font-semibold mb-1'
              style={{ color: 'var(--color-accent)' }}
            >
              {t.cashDrawer.automaticUpdates}
            </div>
            <div style={{ opacity: 0.9 }}>
              {t.cashDrawer.automaticUpdatesDesc}
            </div>
          </div>
        </div>
      </div>

      <div
        className='rounded-lg shadow-md'
        style={{ backgroundColor: 'var(--color-background-secondary)' }}
      >
        {/* Header button */}
        <button
          onClick={() => setShowMovements(!showMovements)}
          className='w-full p-6 flex items-center justify-between hover:opacity-80 transition-opacity'
        >
          <div className='flex items-center gap-3'>
            <History size={24} style={{ color: 'var(--color-primary)' }} />
            <div className='text-left'>
              <h2
                className='text-xl font-bold'
                style={{ color: 'var(--color-text)' }}
              >
                {t.cashDrawer.movementsLog}
              </h2>
              <p
                className='text-sm'
                style={{ color: 'var(--color-text)', opacity: 0.7 }}
              >
                {t.cashDrawer.movementsLogDesc}
              </p>
            </div>
          </div>
          {showMovements ? (
            <ChevronUp size={24} style={{ color: 'var(--color-text)' }} />
          ) : (
            <ChevronDown size={24} style={{ color: 'var(--color-text)' }} />
          )}
        </button>

        {showMovements && (
          <div
            className='border-t p-6'
            style={{ borderColor: 'var(--color-background-accent)' }}
          >
            {loadingMovements ? (
              <div
                className='text-center py-8'
                style={{ color: 'var(--color-text)', opacity: 0.6 }}
              >
                {t.cashDrawer.loading}
              </div>
            ) : movements.length === 0 ? (
              <div
                className='text-center py-8'
                style={{ color: 'var(--color-text)', opacity: 0.6 }}
              >
                {t.cashDrawer.noMovements}
              </div>
            ) : (
              <>
                {/* Filters */}
                <div className='mb-4 grid grid-cols-1 md:grid-cols-2 gap-3'>
                  <div>
                    <label
                      className='block text-sm font-medium mb-2'
                      style={{ color: 'var(--color-text)' }}
                    >
                      Filtrar por Tipo
                    </label>
                    <select
                      value={filterMovementType}
                      onChange={(e) => setFilterMovementType(e.target.value)}
                      className='w-full px-3 py-2 rounded-lg border'
                      style={{
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text)',
                        borderColor: 'var(--color-background-accent)',
                      }}
                    >
                      <option value='all'>Todos</option>
                      <option value='sale'>Venta</option>
                      <option value='change_given'>Cambio Dado</option>
                      <option value='cash_closing'>Cierre de Caja</option>
                      <option value='manual_add'>Agregado Manual</option>
                      <option value='manual_remove'>Retiro Manual</option>
                    </select>
                  </div>
                  <div>
                    <label
                      className='block text-sm font-medium mb-2'
                      style={{ color: 'var(--color-text)' }}
                    >
                      Filtrar por Billete
                    </label>
                    <select
                      value={filterBillDenomination}
                      onChange={(e) =>
                        setFilterBillDenomination(e.target.value)
                      }
                      className='w-full px-3 py-2 rounded-lg border'
                      style={{
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text)',
                        borderColor: 'var(--color-background-accent)',
                      }}
                    >
                      <option value='all'>Todos</option>
                      {bills.map((bill) => (
                        <option
                          key={bill.denomination}
                          value={bill.denomination.toString()}
                        >
                          {formatPrice(bill.denomination)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Filtered results */}
                {filteredMovements.length === 0 ? (
                  <div
                    className='text-center py-8'
                    style={{ color: 'var(--color-text)', opacity: 0.6 }}
                  >
                    No hay movimientos que coincidan con los filtros
                  </div>
                ) : (
                  <div className='space-y-3 max-h-96 overflow-auto scrollbar-hide'>
                    {filteredMovements.map((movement) => (
                      <div
                        key={movement.id}
                        className='p-4 rounded-lg'
                        style={{
                          backgroundColor: 'var(--color-background-accent)',
                        }}
                      >
                        <div className='flex items-start justify-between mb-2'>
                          <div className='flex-1'>
                            <div className='flex items-center gap-2 mb-1'>
                              <span
                                className={`font-semibold ${getMovementColor(
                                  movement.movement_type
                                )}`}
                              >
                                {getMovementTypeLabel(movement.movement_type)}
                              </span>

                              {movement.sale_id && (
                                <button
                                  onClick={() =>
                                    handleViewSale(movement.sale_id!)
                                  }
                                  className='text-xs px-2 py-0 rounded border transition-colors cursor-pointer'
                                  style={{
                                    borderColor: 'var(--color-accent)',
                                    backgroundColor:
                                      'var(--color-background-secondary)',
                                    color: 'var(--color-accent)',
                                  }}
                                >
                                  ID: {movement.sale_id.slice(0, 8)}
                                </button>
                              )}
                            </div>

                            <div
                              className='text-sm'
                              style={{
                                color: 'var(--color-text)',
                                opacity: 0.9,
                              }}
                            >
                              {movement.bills_in &&
                                Object.keys(movement.bills_in).length > 0 && (
                                  <div className='flex flex-wrap gap-1 mt-2'>
                                    {Object.entries(movement.bills_in)
                                      .sort(([a], [b]) => Number(b) - Number(a))
                                      .map(([denom, qty]) => (
                                        <span
                                          key={denom}
                                          className={`
    inline-flex items-center text-xs font-semibold px-2 py-1 rounded-full
    ${
      theme === 'light'
        ? 'bg-emerald-800 text-emerald-100 ring-1 ring-emerald-900'
        : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
    }
  `}
                                        >
                                          {formatNumber(qty)}x{' '}
                                          {formatPrice(Number(denom))}
                                        </span>
                                      ))}
                                  </div>
                                )}

                              {movement.bills_out &&
                                Object.keys(movement.bills_out).length > 0 && (
                                  <div className='flex flex-wrap gap-1 mt-2'>
                                    {Object.entries(movement.bills_out)
                                      .sort(([a], [b]) => Number(b) - Number(a))
                                      .map(([denom, qty]) => (
                                        <span
                                          key={denom}
                                          className={`
    inline-flex items-center text-xs font-semibold px-2 py-1 rounded-full
    ${
      theme === 'light'
        ? 'bg-rose-800 text-rose-100 ring-1 ring-rose-900'
        : 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'
    }
  `}
                                        >
                                          {formatNumber(qty)}x{' '}
                                          {formatPrice(Number(denom))}
                                        </span>
                                      ))}
                                  </div>
                                )}
                            </div>

                            {movement.notes && (
                              <div
                                className='text-xs mt-1'
                                style={{
                                  color: 'var(--color-text)',
                                  opacity: 0.6,
                                }}
                              >
                                {movement.notes}
                              </div>
                            )}
                          </div>

                          <div
                            className='text-right text-xs'
                            style={{ color: 'var(--color-text)', opacity: 0.6 }}
                          >
                            {formatDate(movement.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showSaleModal && selectedSale && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
          <div
            className='rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto'
            style={{ backgroundColor: 'var(--color-background-secondary)' }}
          >
            <div
              className='sticky top-0 z-10 flex items-center justify-between p-6 border-b'
              style={{
                backgroundColor: 'var(--color-background-secondary)',
                borderColor: 'var(--color-background-accent)',
              }}
            >
              <h2
                className='text-2xl font-bold'
                style={{ color: 'var(--color-text)' }}
              >
                Detalles de Venta
              </h2>
              <button
                onClick={() => setShowSaleModal(false)}
                className='flex justify-center p-2 rounded-lg transition-colors'
                style={{
                  color: 'var(--color-text)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'var(--color-background-accent)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'transparent';
                }}
              >
                <X size={24} />
              </button>
            </div>

            <div className='p-6'>
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
                    selectedSale.sale_number.replace(/^S-/, ''),
                    10
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

              <div
                className='border-t pt-4 space-y-2'
                style={{ borderColor: 'var(--color-background-accent)' }}
              >
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
                                  className={`
                            inline-flex items-center text-xs font-semibold px-2 py-1 rounded-full
                            ${
                              theme === 'light'
                                ? 'bg-emerald-800 text-emerald-100 ring-1 ring-emerald-900'
                                : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
                            }
  `}
                                >
                                  {formatNumber(quantity)}x{' '}
                                  {formatPrice(Number(denomination))}
                                </span>
                              ))}
                          </div>
                        )}
                    </div>

                    <div className='pt-2'>
                      <div
                        className='flex justify-between text-sm mb-2'
                        style={{ color: 'var(--color-text)' }}
                      >
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
                                  className={`
                                    inline-flex items-center text-xs font-semibold px-2 py-1 rounded-full
                                    ${
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
          </div>
        </div>
      )}
    </div>
  );
}
