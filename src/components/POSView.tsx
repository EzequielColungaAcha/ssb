import React, { useState } from 'react';
import { ShoppingCart, X, Trash2, Wallet, CreditCard, Banknote, RotateCcw, Undo } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '../lib/indexeddb';
import { useProducts } from '../hooks/useProducts';
import { useSales } from '../hooks/useSales';
import { useCashDrawer, ChangeBreakdown } from '../hooks/useCashDrawer';
import { formatPrice, formatNumber } from '../lib/utils';

interface CartItem extends Product {
  quantity: number;
}

const BILLS = [10, 20, 50, 100, 200, 500, 1000, 2000, 10000, 20000];

export function POSView() {
  const { products } = useProducts();
  const { createSale } = useSales();
  const { calculateOptimalChange, processChange, processCashReceived } = useCashDrawer();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [cashReceived, setCashReceived] = useState(0);
  const [changeBreakdown, setChangeBreakdown] = useState<ChangeBreakdown[] | null>(null);
  const [processing, setProcessing] = useState(false);
  const [billHistory, setBillHistory] = useState<number[]>([]);

  const activeProducts = products.filter((p) => p.active && p.stock > 0);
  const categories = Array.from(new Set(activeProducts.map((p) => p.category)));

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      if (existing.quantity < product.stock) {
        setCart(cart.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)));
      }
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    if (quantity <= 0) {
      removeFromCart(productId);
    } else if (quantity <= product.stock) {
      setCart(cart.map((item) => (item.id === productId ? { ...item, quantity } : item)));
    }
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const change = cashReceived - total;

  const addCash = (amount: number) => {
    const newTotal = cashReceived + amount;
    setCashReceived(newTotal);
    setBillHistory([...billHistory, amount]);

    if (newTotal >= total) {
      const changeAmount = newTotal - total;
      const breakdown = calculateOptimalChange(changeAmount);
      setChangeBreakdown(breakdown);
    } else {
      setChangeBreakdown(null);
    }
  };

  const undoLastBill = () => {
    if (billHistory.length === 0) return;

    const lastBill = billHistory[billHistory.length - 1];
    const newTotal = Math.max(0, cashReceived - lastBill);
    setCashReceived(newTotal);
    setBillHistory(billHistory.slice(0, -1));

    if (newTotal >= total) {
      const changeAmount = newTotal - total;
      const breakdown = calculateOptimalChange(changeAmount);
      setChangeBreakdown(breakdown);
    } else {
      setChangeBreakdown(null);
    }
  };

  const resetCash = () => {
    setCashReceived(0);
    setChangeBreakdown(null);
    setBillHistory([]);
  };

  const completeSale = async () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'cash') {
      if (cashReceived < total) return;
      if (change > 0 && !changeBreakdown) {
        toast.error('No se puede dar cambio exacto con los billetes disponibles');
        return;
      }
    }

    setProcessing(true);
    try {
      const items = cart.map((item) => ({
        product_id: item.id,
        product_name: item.name,
        product_price: item.price,
        production_cost: item.production_cost,
        quantity: item.quantity,
      }));

      let billsReceivedData: Record<number, number> | undefined;
      let billsChangeData: Record<number, number> | undefined;

      if (paymentMethod === 'cash') {
        billsReceivedData = await processCashReceived(cashReceived, '');

        if (changeBreakdown) {
          billsChangeData = {};
          changeBreakdown.forEach(b => {
            billsChangeData![b.bill_value] = b.quantity;
          });
        }
      }

      const saleData = await createSale(
        items,
        paymentMethod,
        paymentMethod === 'cash' ? cashReceived : undefined,
        billsReceivedData,
        billsChangeData
      );

      if (paymentMethod === 'cash' && saleData && changeBreakdown) {
        await processChange(changeBreakdown, saleData.id);
      }

      setCart([]);
      setCashReceived(0);
      setChangeBreakdown(null);
      setShowPayment(false);
      setPaymentMethod('cash');
      setBillHistory([]);

      if (paymentMethod === 'cash' && change > 0) {
        const changeMessage = changeBreakdown
          ?.map((b) => `${formatNumber(b.quantity)}x ${formatPrice(b.bill_value)}`)
          .join(', ');
        toast.success(`¡Venta completada!`, {
          description: `Cambio: ${formatPrice(change)} - Entregar: ${changeMessage}`,
        });
      } else {
        toast.success('¡Venta completada!');
      }
    } catch (error) {
      console.error('Error completing sale:', error);
      toast.error('Error al completar la venta');
    } finally {
      setProcessing(false);
    }
  };

  const cancelPayment = () => {
    setCashReceived(0);
    setChangeBreakdown(null);
    setShowPayment(false);
    setPaymentMethod('cash');
    setBillHistory([]);
  };

  const canComplete = () => {
    if (cart.length === 0) return false;
    if (paymentMethod === 'online') return true;
    if (paymentMethod === 'cash') {
      if (cashReceived < total) return false;
      if (change > 0 && !changeBreakdown) return false;
      return true;
    }
    return false;
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="flex-1 p-6 overflow-auto scrollbar-hide">
        {categories.map((category) => (
          <div key={category} className="mb-8">
            <h2 className="text-xl font-semibold mb-4 capitalize" style={{ color: 'var(--color-text)' }}>
              {category}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {activeProducts
                .filter((p) => p.category === category)
                .map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="p-6 rounded-lg shadow-md hover:shadow-lg transition-all"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                  >
                    <div className="text-lg font-bold mb-2">{product.name}</div>
                    <div className="text-2xl font-bold mb-1">{formatPrice(product.price)}</div>
                    <div className="text-sm opacity-90">Stock: {formatNumber(product.stock)}</div>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="w-96 shadow-xl p-6 flex flex-col" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
        <div className="flex items-center justify-end mb-6">
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto scrollbar-hide mb-6">
          {cart.length === 0 ? (
            <div className="text-center opacity-60 mt-12" style={{ color: 'var(--color-text)' }}>El carrito está vacío</div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold" style={{ color: 'var(--color-text)' }}>{item.name}</div>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-500">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 rounded"
                        style={{ backgroundColor: 'var(--color-background-secondary)', color: 'var(--color-text)' }}
                      >
                        -
                      </button>
                      <span className="w-8 text-center" style={{ color: 'var(--color-text)' }}>{formatNumber(item.quantity)}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 rounded"
                        style={{ backgroundColor: 'var(--color-background-secondary)', color: 'var(--color-text)' }}
                      >
                        +
                      </button>
                    </div>
                    <div className="font-bold" style={{ color: 'var(--color-text)' }}>
                      {formatPrice(item.price * item.quantity)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between text-2xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
            <span>Total:</span>
            <span style={{ color: 'var(--color-primary)' }}>{formatPrice(total)}</span>
          </div>

          {!showPayment ? (
            <button
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
              className="w-full py-4 rounded-lg text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              Proceder al Pago
            </button>
          ) : (
            <div>
              <div className="mb-4">
                <div className="text-sm mb-2 dark:text-white">Método de Pago:</div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    onClick={() => {
                      setPaymentMethod('cash');
                      setCashReceived(0);
                      setChangeBreakdown(null);
                      setBillHistory([]);
                    }}
                    className={`py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                      paymentMethod === 'cash'
                        ? 'text-white'
                        : 'bg-gray-200 dark:bg-gray-700 dark:text-white'
                    }`}
                    style={paymentMethod === 'cash' ? { backgroundColor: 'var(--color-primary)' } : undefined}
                  >
                    <Banknote size={20} />
                    Efectivo
                  </button>
                  <button
                    onClick={() => setPaymentMethod('online')}
                    className={`py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                      paymentMethod === 'online'
                        ? 'text-white'
                        : 'bg-gray-200 dark:bg-gray-700 dark:text-white'
                    }`}
                    style={paymentMethod === 'online' ? { backgroundColor: 'var(--color-primary)' } : undefined}
                  >
                    <CreditCard size={20} />
                    Online
                  </button>
                </div>
              </div>

              {paymentMethod === 'cash' ? (
                <div>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm dark:text-white">Efectivo Recibido:</div>
                      <div className="flex gap-2">
                        {billHistory.length > 0 && (
                          <button
                            onClick={undoLastBill}
                            className="text-xs px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 flex items-center gap-1"
                          >
                            <Undo size={12} />
                            Deshacer
                          </button>
                        )}
                        {cashReceived > 0 && (
                          <button
                            onClick={resetCash}
                            className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-1"
                          >
                            <RotateCcw size={12} />
                            Reiniciar
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-3xl font-bold mb-2" style={{ color: 'var(--color-accent)' }}>
                      {formatPrice(cashReceived)}
                    </div>
                    <div className="text-sm mb-2 dark:text-white">
                      Cambio: <span className="font-bold">{change >= 0 ? formatPrice(change) : '$0'}</span>
                    </div>

                    {changeBreakdown && change > 0 && (
                      <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-sm font-semibold mb-2 text-green-700 dark:text-green-400">
                          Entregar cambio:
                        </div>
                        <div className="space-y-1">
                          {changeBreakdown.map((item) => (
                            <div
                              key={item.bill_value}
                              className="flex justify-between text-sm text-green-700 dark:text-green-400"
                            >
                              <span>{formatNumber(item.quantity)}x</span>
                              <span className="font-bold">{formatPrice(item.bill_value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {change > 0 && !changeBreakdown && cashReceived >= total && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-sm text-red-700 dark:text-red-400">
                          No se puede dar cambio exacto con los billetes disponibles
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Agregar billetes:</div>
                    <div className="grid grid-cols-3 gap-2">
                      {BILLS.map((bill) => (
                        <button
                          key={bill}
                          onClick={() => addCash(bill)}
                          className="py-2 px-3 rounded bg-gray-200 dark:bg-gray-700 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold"
                        >
                          +{formatPrice(bill)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-center text-blue-700 dark:text-blue-400">
                    <CreditCard size={32} className="mx-auto mb-2" />
                    <div className="font-semibold">Pago en Línea</div>
                    <div className="text-sm mt-1">El cliente pagará electrónicamente</div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={completeSale}
                  disabled={!canComplete() || processing}
                  className="w-full py-3 rounded-lg text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {processing ? 'Procesando...' : 'Completar Venta'}
                </button>
                <button
                  onClick={cancelPayment}
                  className="w-full py-3 rounded-lg bg-gray-300 dark:bg-gray-600 dark:text-white font-bold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
