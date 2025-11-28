import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Minus, RefreshCw, ChevronDown, ChevronUp, History } from 'lucide-react';
import { toast } from 'sonner';
import { useCashDrawer } from '../hooks/useCashDrawer';
import { CashMovement } from '../lib/indexeddb';
import { translations as t } from '../lib/translations';
import { formatPrice, formatNumber } from '../lib/utils';

export function CashDrawerView() {
  const { bills, updateBillQuantity, getTotalCash, getCashMovements, loading } = useCashDrawer();
  const [editingBill, setEditingBill] = useState<number | null>(null);
  const [newQuantity, setNewQuantity] = useState('');
  const [showMovements, setShowMovements] = useState(false);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  useEffect(() => {
    if (showMovements) {
      loadMovements();
    }
  }, [showMovements]);

  const loadMovements = async () => {
    setLoadingMovements(true);
    const data = await getCashMovements();
    setMovements(data);
    setLoadingMovements(false);
  };

  const handleUpdateQuantity = async (billValue: number, quantity: number) => {
    try {
      await updateBillQuantity(billValue, quantity, 'manual_add', 'Ajuste manual');
      setEditingBill(null);
      setNewQuantity('');
      if (showMovements) {
        loadMovements();
      }
    } catch (error) {
      toast.error(t.cashDrawer.errorUpdating);
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
    }
  };

  if (loading) {
    return <div className="p-6 dark:text-white">{t.cashDrawer.loading}</div>;
  }

  const totalCash = getTotalCash();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--color-text)' }}>
          <Wallet style={{ color: 'var(--color-primary)' }} />
          {t.cashDrawer.title}
        </h1>
        <p className="opacity-60 mt-2" style={{ color: 'var(--color-text)' }}>
          {t.cashDrawer.subtitle}
        </p>
      </div>

      <div className="rounded-lg shadow-lg p-6 mb-6" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-60 mb-1" style={{ color: 'var(--color-text)' }}>{t.cashDrawer.totalCash}</div>
            <div className="text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>
              {formatPrice(totalCash)}
            </div>
          </div>
          <Wallet size={64} className="text-gray-300 dark:text-gray-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {bills.map((bill) => (
          <div
            key={bill.denomination}
            className="rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            style={{ backgroundColor: 'var(--color-background-secondary)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>{t.cashDrawer.billValue}</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{formatPrice(bill.denomination)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>{t.cashDrawer.quantity}</div>
                {editingBill === bill.denomination ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      min="0"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      className="w-20 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdateQuantity(bill.denomination, parseInt(newQuantity) || 0)}
                      className="px-2 py-1 rounded text-white text-sm"
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
                    className="text-3xl font-bold hover:opacity-70"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatNumber(bill.quantity)}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>{t.cashDrawer.totalValue}</span>
              <span className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>
                {formatPrice(bill.denomination * bill.quantity)}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleQuickAdjust(bill.denomination, -1)}
                disabled={bill.quantity === 0}
                className="flex-1 py-2 px-3 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                <Minus size={16} />
                {t.cashDrawer.remove}
              </button>
              <button
                onClick={() => handleQuickAdjust(bill.denomination, 1)}
                className="flex-1 py-2 px-3 rounded text-white hover:opacity-90 flex items-center justify-center gap-1"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Plus size={16} />
                {t.cashDrawer.add}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <RefreshCw size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-400">
            <div className="font-semibold mb-1">{t.cashDrawer.automaticUpdates}</div>
            <div>{t.cashDrawer.automaticUpdatesDesc}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg shadow-md" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
        <button
          onClick={() => setShowMovements(!showMovements)}
          className="w-full p-6 flex items-center justify-between hover:opacity-70 transition-colors"
        >
          <div className="flex items-center gap-3">
            <History size={24} style={{ color: 'var(--color-primary)' }} />
            <div className="text-left">
              <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{t.cashDrawer.movementsLog}</h2>
              <p className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>{t.cashDrawer.movementsLogDesc}</p>
            </div>
          </div>
          {showMovements ? <ChevronUp size={24} className="dark:text-white" /> : <ChevronDown size={24} className="dark:text-white" />}
        </button>

        {showMovements && (
          <div className="border-t dark:border-gray-700 p-6">
            {loadingMovements ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t.cashDrawer.loading}</div>
            ) : movements.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t.cashDrawer.noMovements}</div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-auto scrollbar-hide">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-semibold ${getMovementColor(movement.movement_type)}`}>
                            {getMovementTypeLabel(movement.movement_type)}
                          </span>
                          {movement.sale_id && (
                            <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 dark:text-white">
                              Venta #{movement.sale_id.slice(0, 8)}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                          {movement.bills_in && Object.entries(movement.bills_in).map(([denom, qty]) => (
                            <div key={denom} className="text-green-600 dark:text-green-400">
                              +{qty}x ${denom}
                            </div>
                          ))}
                          {movement.bills_out && Object.entries(movement.bills_out).map(([denom, qty]) => (
                            <div key={denom} className="text-red-600 dark:text-red-400">
                              -{qty}x ${denom}
                            </div>
                          ))}
                        </div>
                        {movement.notes && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {movement.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(movement.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
