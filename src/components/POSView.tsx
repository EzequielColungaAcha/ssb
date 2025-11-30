import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  X,
  Trash2,
  Wallet,
  CreditCard,
  Banknote,
  RotateCcw,
  Undo,
  GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Product, db, AppSettings, Sale } from '../lib/indexeddb';
import { useProducts } from '../hooks/useProducts';
import { useSales } from '../hooks/useSales';
import { useCashDrawer, ChangeBreakdown } from '../hooks/useCashDrawer';
import { useMateriaPrima } from '../hooks/useMateriaPrima';
import { formatPrice, formatNumber } from '../lib/utils';

interface CartItem extends Product {
  quantity: number;
}

const BILLS = [10, 20, 50, 100, 200, 500, 1000, 2000, 10000, 20000];

interface SortableProductItemProps {
  product: Product;
  isLocked: boolean;
  onAddToCart: (product: Product) => void;
  getStock: (product: Product) => number;
}

function SortableProductItem({ product, isLocked, onAddToCart, getStock }: SortableProductItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id, disabled: isLocked, data: { type: 'product' } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {!isLocked && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-10 opacity-70 hover:opacity-100 transition-opacity bg-black/30 rounded p-1 backdrop-blur-sm cursor-move"
        >
          <GripVertical size={18} className="text-white" />
        </div>
      )}
      <button
        onClick={() => onAddToCart(product)}
        className="w-full p-6 rounded-lg shadow-md hover:shadow-xl transition-all duration-200 hover:scale-105"
        style={{
          backgroundColor: 'var(--color-primary)',
          color: 'white',
        }}
      >
        <div className="text-lg font-bold mb-2">{product.name}</div>
        <div className="text-2xl font-bold mb-1">
          {formatPrice(product.price)}
        </div>
        <div className="text-sm opacity-90">
          Stock: {formatNumber(getStock(product))}
        </div>
      </button>
    </div>
  );
}

interface SortableCategoryProps {
  category: string;
  isLocked: boolean;
  children: React.ReactNode;
}

function SortableCategory({ category, isLocked, children }: SortableCategoryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `category-${category}`, disabled: isLocked, data: { type: 'category' } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        {!isLocked && (
          <div
            {...attributes}
            {...listeners}
            className="opacity-70 hover:opacity-100 transition-opacity cursor-move"
            style={{ color: 'var(--color-text)' }}
          >
            <GripVertical size={20} />
          </div>
        )}
        <h2
          className="text-xl font-semibold capitalize"
          style={{ color: 'var(--color-text)' }}
        >
          {category}
        </h2>
      </div>
      {children}
    </div>
  );
}

export function POSView() {
  const { products, refresh: refreshProducts, updateProduct } = useProducts();
  const { createSale } = useSales();
  const { calculateOptimalChange, processChange, processCashReceived } =
    useCashDrawer();
  const { checkStockAvailability, deductMateriaPrimaStock, calculateAvailableStock, refresh: refreshMateriaPrima } = useMateriaPrima();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [cashReceived, setCashReceived] = useState(0);
  const [changeBreakdown, setChangeBreakdown] = useState<
    ChangeBreakdown[] | null
  >(null);
  const [processing, setProcessing] = useState(false);
  const [billHistory, setBillHistory] = useState<number[]>([]);
  const [productStocks, setProductStocks] = useState<Record<string, number>>({});
  const [sortedProducts, setSortedProducts] = useState<Product[]>([]);
  const [isLayoutLocked, setIsLayoutLocked] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [nextSaleNumber, setNextSaleNumber] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const loadStocks = async () => {
      const stocks: Record<string, number> = {};
      for (const product of products) {
        if (product.uses_materia_prima) {
          stocks[product.id] = await calculateAvailableStock(product.id);
        }
      }
      setProductStocks(stocks);
    };

    if (products.length > 0) {
      loadStocks();
    }
  }, [products]);

  useEffect(() => {
    loadSettings();

    const handleLockChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ locked: boolean }>;
      setIsLayoutLocked(customEvent.detail.locked);
    };

    const handleSaveOrder = () => {
      saveProductOrder();
    };

    window.addEventListener('pos-layout-lock-changed', handleLockChange);
    window.addEventListener('pos-layout-save-order', handleSaveOrder);
    return () => {
      window.removeEventListener('pos-layout-lock-changed', handleLockChange);
      window.removeEventListener('pos-layout-save-order', handleSaveOrder);
    };
  }, [sortedProducts]);

  useEffect(() => {
    const sorted = [...products].sort((a, b) => {
      const orderA = a.display_order ?? 999999;
      const orderB = b.display_order ?? 999999;
      return orderA - orderB;
    });
    setSortedProducts(sorted);
  }, [products]);

  useEffect(() => {
    const loadNextSaleNumber = async () => {
      try {
        await db.init();
        const allSales = await db.getAll<Sale>('sales');
        const lastSaleNumber = allSales.length > 0
          ? Math.max(...allSales.map(s => {
              const numStr = s.sale_number.replace(/^S-/, '');
              return parseInt(numStr) || 0;
            }))
          : 0;
        const nextNumber = lastSaleNumber + 1;
        const formatted = nextNumber.toLocaleString('es-CL');
        setNextSaleNumber(formatted);
      } catch (error) {
        console.error('Error loading next sale number:', error);
      }
    };

    loadNextSaleNumber();
  }, [cart]);

  const loadSettings = async () => {
    try {
      await db.init();
      const settings = await db.get<AppSettings>('app_settings', 'default');
      if (settings) {
        setIsLayoutLocked(settings.pos_layout_locked);
        if (settings.category_order) {
          setCategoryOrder(settings.category_order);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadStocks = async () => {
    const stocks: Record<string, number> = {};
    for (const product of products) {
      if (product.uses_materia_prima) {
        stocks[product.id] = await calculateAvailableStock(product.id);
      }
    }
    setProductStocks(stocks);
  };

  const getProductStock = (product: Product) => {
    if (product.uses_materia_prima) {
      return productStocks[product.id] || 0;
    }
    return product.stock;
  };

  const activeProducts = sortedProducts.filter((p) => p.active && getProductStock(p) > 0);
  const allCategories = Array.from(new Set(activeProducts.map((p) => p.category)));

  const categories = categoryOrder.length > 0
    ? categoryOrder.filter(cat => allCategories.includes(cat))
    : allCategories;

  const addToCart = async (product: Product) => {
    const existing = cart.find((item) => item.id === product.id);
    const newQuantity = existing ? existing.quantity + 1 : 1;
    const availableStock = getProductStock(product);

    if (newQuantity > availableStock) {
      toast.error('Stock insuficiente');
      return;
    }

    if (product.uses_materia_prima) {
      const hasStock = await checkStockAvailability(product.id);
      if (!hasStock) {
        toast.error('Materia prima insuficiente para este producto');
        return;
      }
    }

    if (existing) {
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => {
    const newCart = cart.filter((item) => item.id !== productId);
    setCart(newCart);

    if (newCart.length === 0) {
      setShowPayment(false);
      setCashReceived(0);
      setChangeBreakdown(null);
      setBillHistory([]);
      setPaymentMethod('cash');
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const availableStock = getProductStock(product);

    if (quantity > availableStock) {
      toast.error('Stock insuficiente');
      return;
    }

    if (product.uses_materia_prima) {
      const hasStock = await checkStockAvailability(product.id, quantity);
      if (!hasStock) {
        toast.error('Materia prima insuficiente para esta cantidad');
        return;
      }
    }

    setCart(
      cart.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
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
        toast.error(
          'No se puede dar cambio exacto con los billetes disponibles'
        );
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

      let billsChangeData: Record<number, number> | undefined;

      if (paymentMethod === 'cash' && changeBreakdown) {
        billsChangeData = {};
        changeBreakdown.forEach((b) => {
          billsChangeData![b.bill_value] = b.quantity;
        });
      }

      const saleData = await createSale(
        items,
        paymentMethod,
        paymentMethod === 'cash' ? cashReceived : undefined,
        undefined,
        billsChangeData
      );

      for (const item of cart) {
        if (item.uses_materia_prima) {
          await deductMateriaPrimaStock(item.id, item.quantity);
        }
      }

      if (paymentMethod === 'cash' && saleData) {
        const billsReceivedData = await processCashReceived(billHistory, saleData.id);

        if (changeBreakdown && changeBreakdown.length > 0) {
          await processChange(changeBreakdown, saleData.id);
        }

        const updatedSale = {
          ...saleData,
          bills_received: billsReceivedData,
        };
        await db.init();
        await db.put('sales', updatedSale);
      }

      await refreshProducts();
      await refreshMateriaPrima();
      await loadStocks();

      setCart([]);
      setCashReceived(0);
      setChangeBreakdown(null);
      setShowPayment(false);
      setPaymentMethod('cash');
      setBillHistory([]);

      toast.success(`¡Venta completada!`);
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === 'category' && overData?.type === 'category') {
      const activeCategory = (active.id as string).replace('category-', '');
      const overCategory = (over.id as string).replace('category-', '');

      const oldIndex = categories.indexOf(activeCategory);
      const newIndex = categories.indexOf(overCategory);

      const newCategoryOrder = arrayMove(categories, oldIndex, newIndex);
      setCategoryOrder(newCategoryOrder);

      try {
        await db.init();
        const settings = await db.get<AppSettings>('app_settings', 'default') || {
          id: 'default',
          pos_layout_locked: isLayoutLocked,
          updated_at: new Date().toISOString(),
        };
        settings.category_order = newCategoryOrder;
        settings.updated_at = new Date().toISOString();
        await db.put('app_settings', settings);
      } catch (error) {
        console.error('Error saving category order:', error);
      }
    } else if (activeData?.type === 'product' && overData?.type === 'product') {
      const oldIndex = sortedProducts.findIndex((p) => p.id === active.id);
      const newIndex = sortedProducts.findIndex((p) => p.id === over.id);

      const activeProduct = sortedProducts[oldIndex];
      const overProduct = sortedProducts[newIndex];

      if (activeProduct.category !== overProduct.category) {
        return;
      }

      const newProducts = arrayMove(sortedProducts, oldIndex, newIndex);
      setSortedProducts(newProducts);

      try {
        for (let i = 0; i < newProducts.length; i++) {
          const product = newProducts[i];
          await updateProduct(product.id, { ...product, display_order: i });
        }
      } catch (error) {
        console.error('Error saving product order:', error);
      }
    }
  };

  const saveProductOrder = async () => {
    try {
      for (let i = 0; i < sortedProducts.length; i++) {
        const product = sortedProducts[i];
        await updateProduct(product.id, { ...product, display_order: i });
      }
    } catch (error) {
      console.error('Error saving product order:', error);
    }
  };

  const activeProduct = activeId && !activeId.toString().startsWith('category-')
    ? sortedProducts.find(p => p.id === activeId)
    : null;

  const activeCategory = activeId && activeId.toString().startsWith('category-')
    ? activeId.toString().replace('category-', '')
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className='flex h-screen'
        style={{ backgroundColor: 'var(--color-background)' }}
      >
        <div className='flex-1 p-6 overflow-auto scrollbar-hide'>
          <SortableContext
            items={categories.map(cat => `category-${cat}`)}
            disabled={isLayoutLocked}
          >
            {categories.map((category) => {
              const categoryProducts = activeProducts.filter((p) => p.category === category);
              const categoryProductIds = categoryProducts.map(p => p.id);

              return (
                <SortableCategory
                  key={category}
                  category={category}
                  isLocked={isLayoutLocked}
                >
                  <SortableContext
                    items={categoryProductIds}
                    strategy={rectSortingStrategy}
                    disabled={isLayoutLocked}
                  >
                    <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
                      {categoryProducts.map((product) => (
                        <SortableProductItem
                          key={product.id}
                          product={product}
                          isLocked={isLayoutLocked}
                          onAddToCart={addToCart}
                          getStock={getProductStock}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </SortableCategory>
              );
            })}
          </SortableContext>
        </div>

        <div
          className='w-96 shadow-xl p-6 flex flex-col'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
        <div className='flex items-center justify-between mb-6'>
          <div className='text-sm font-semibold' style={{ color: 'var(--color-text)' }}>
            Venta #{nextSaleNumber}
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => {
                setCart([]);
                setShowPayment(false);
                setCashReceived(0);
                setChangeBreakdown(null);
                setBillHistory([]);
                setPaymentMethod('cash');
              }}
              className='text-red-500 hover:text-red-700'
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>

        <div className='flex-1 overflow-auto scrollbar-hide mb-6'>
          {cart.length === 0 ? (
            <div
              className='text-center opacity-60 mt-12'
              style={{ color: 'var(--color-text)' }}
            >
              El carrito está vacío
            </div>
          ) : (
            <div className='space-y-3'>
              {cart.map((item) => (
                <div
                  key={item.id}
                  className='p-3 rounded-lg'
                  style={{ backgroundColor: 'var(--color-background)' }}
                >
                  <div className='flex items-center justify-between mb-2'>
                    <div
                      className='font-semibold'
                      style={{ color: 'var(--color-text)' }}
                    >
                      {item.name}
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className='text-red-500'
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        className='w-8 h-8 rounded'
                        style={{
                          backgroundColor: 'var(--color-background-secondary)',
                          color: 'var(--color-text)',
                        }}
                      >
                        -
                      </button>
                      <span
                        className='w-8 text-center'
                        style={{ color: 'var(--color-text)' }}
                      >
                        {formatNumber(item.quantity)}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        className='w-8 h-8 rounded'
                        style={{
                          backgroundColor: 'var(--color-background-secondary)',
                          color: 'var(--color-text)',
                        }}
                      >
                        +
                      </button>
                    </div>
                    <div
                      className='font-bold'
                      style={{ color: 'var(--color-text)' }}
                    >
                      {formatPrice(item.price * item.quantity)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='border-t pt-4'>
          <div
            className='flex justify-between text-2xl font-bold mb-4'
            style={{ color: 'var(--color-text)' }}
          >
            <span>Total:</span>
            <span style={{ color: 'var(--color-primary)' }}>
              {formatPrice(total)}
            </span>
          </div>

          {!showPayment ? (
            <button
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
              className='w-full py-4 rounded-lg text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90'
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              Proceder al Pago
            </button>
          ) : (
            <div>
              <div className='mb-4'>
                <div className='text-sm mb-2 dark:text-white'>
                  Método de Pago:
                </div>
                <div className='grid grid-cols-2 gap-2 mb-4'>
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
                    style={
                      paymentMethod === 'cash'
                        ? { backgroundColor: 'var(--color-primary)' }
                        : undefined
                    }
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
                    style={
                      paymentMethod === 'online'
                        ? { backgroundColor: 'var(--color-primary)' }
                        : undefined
                    }
                  >
                    <CreditCard size={20} />
                    Online
                  </button>
                </div>
              </div>

              {paymentMethod === 'cash' ? (
                <div>
                  <div className='mb-4'>
                    <div className='flex items-center justify-between mb-2'>
                      <div className='text-sm dark:text-white'>
                        Efectivo Recibido:
                      </div>
                      <div className='flex gap-2'>
                        {billHistory.length > 0 && (
                          <button
                            onClick={undoLastBill}
                            className='text-xs px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 flex items-center gap-1'
                          >
                            <Undo size={12} />
                            Deshacer
                          </button>
                        )}
                        {cashReceived > 0 && (
                          <button
                            onClick={resetCash}
                            className='text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-1'
                          >
                            <RotateCcw size={12} />
                            Reiniciar
                          </button>
                        )}
                      </div>
                    </div>
                    <div
                      className='text-3xl font-bold mb-2'
                      style={{ color: 'var(--color-accent)' }}
                    >
                      {formatPrice(cashReceived)}
                    </div>
                    <div className='text-sm mb-2 dark:text-white'>
                      Cambio:{' '}
                      <span className='font-bold'>
                        {change >= 0 ? formatPrice(change) : '$0'}
                      </span>
                    </div>

                    {changeBreakdown && change > 0 && (
                      <div className='mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg'>
                        <div className='text-sm font-semibold mb-2 text-green-700 dark:text-green-400'>
                          Entregar cambio:
                        </div>
                        <div className='space-y-1'>
                          {changeBreakdown.map((item) => (
                            <div
                              key={item.bill_value}
                              className='flex justify-between text-sm text-green-700 dark:text-green-400'
                            >
                              <span>{formatNumber(item.quantity)}x</span>
                              <span className='font-bold'>
                                {formatPrice(item.bill_value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {change > 0 &&
                      !changeBreakdown &&
                      cashReceived >= total && (
                        <div className='mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg'>
                          <div className='text-sm text-red-700 dark:text-red-400'>
                            No se puede dar cambio exacto con los billetes
                            disponibles
                          </div>
                        </div>
                      )}
                  </div>

                  <div className='mb-4'>
                    <div className='text-xs text-gray-500 dark:text-gray-400 mb-2'>
                      Agregar billetes:
                    </div>
                    <div className='grid grid-cols-5 gap-2'>
                      {BILLS.map((bill) => (
                        <button
                          key={bill}
                          onClick={() => addCash(bill)}
                          className='py-2 px-3 rounded bg-gray-200 dark:bg-gray-700 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold'
                        >
                          +{formatPrice(bill)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className='mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
                  <div className='text-center text-blue-700 dark:text-blue-400'>
                    <CreditCard size={32} className='mx-auto mb-2' />
                    <div className='font-semibold'>Pago en Línea</div>
                    <div className='text-sm mt-1'>
                      El cliente pagará electrónicamente
                    </div>
                  </div>
                </div>
              )}

              <div className='space-y-2'>
                <button
                  onClick={completeSale}
                  disabled={!canComplete() || processing}
                  className='w-full py-3 rounded-lg text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed'
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {processing ? 'Procesando...' : 'Completar Venta'}
                </button>
                <button
                  onClick={cancelPayment}
                  className='w-full py-3 rounded-lg bg-gray-300 dark:bg-gray-600 dark:text-white font-bold'
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      <DragOverlay>
        {activeProduct ? (
          <div className="opacity-80 rotate-3 scale-105 shadow-2xl">
            <button
              className="w-full p-6 rounded-lg"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'white',
              }}
            >
              <div className="text-lg font-bold mb-2">{activeProduct.name}</div>
              <div className="text-2xl font-bold mb-1">
                {formatPrice(activeProduct.price)}
              </div>
              <div className="text-sm opacity-90">
                Stock: {formatNumber(getProductStock(activeProduct))}
              </div>
            </button>
          </div>
        ) : activeCategory ? (
          <div className="opacity-80 scale-105 shadow-2xl bg-gray-800/90 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center gap-2">
              <GripVertical size={20} className="text-white" />
              <h2 className="text-xl font-semibold capitalize text-white">
                {activeCategory}
              </h2>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
