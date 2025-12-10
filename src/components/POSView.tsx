import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Trash2,
  CreditCard,
  Banknote,
  RotateCcw,
  Undo,
  Lock,
  Unlock,
  Eye,
  ChefHat,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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

interface KDSOrderItem {
  product_name: string;
  quantity: number;
  product_price: number;
}

interface KDSOrder {
  id: string;
  sale_number: string;
  items: KDSOrderItem[];
  total: number;
  status: 'preparing' | 'finished';
  created_at: string;
  finished_at?: string;
}

interface SaleItem {
  product_id: string;
  product_name: string;
  product_price: number;
  production_cost: number;
  quantity: number;
}

const BILLS = [10, 20, 50, 100, 200, 500, 1000, 2000, 10000, 20000];

interface SortableProductItemProps {
  product: Product;
  isLocked: boolean;
  onAddToCart: (product: Product) => void;
  getStock: (product: Product) => number;
}

function SortableProductItem({
  product,
  isLocked,
  onAddToCart,
  getStock,
}: SortableProductItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: product.id,
    disabled: isLocked,
    data: { type: 'product' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: isLocked ? 'auto' : 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className='relative'
      {...(isLocked ? {} : { ...attributes, ...listeners })}
    >
      <button
        onClick={() => onAddToCart(product)}
        className={`w-full p-6 rounded-lg shadow-md transition-all duration-200 ${
          isLocked ? 'hover:shadow-xl hover:scale-105' : 'cursor-move'
        }`}
        style={{
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-on-primary)',
        }}
      >
        <div className='text-lg font-bold mb-2'>{product.name}</div>
        <div className='text-2xl font-bold mb-1'>
          {formatPrice(product.price)}
        </div>
        <div className='text-sm opacity-90'>
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

function SortableCategory({
  category,
  isLocked,
  children,
}: SortableCategoryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `category-${category}`,
    disabled: isLocked,
    data: { type: 'category' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className='mb-8'>
      <h2
        {...(isLocked ? {} : { ...attributes, ...listeners })}
        className={`text-xl font-semibold capitalize mb-4 ${
          isLocked ? '' : 'cursor-move hover:opacity-80 transition-opacity'
        }`}
        style={{
          color: 'var(--color-text)',
          touchAction: isLocked ? 'auto' : 'none',
        }}
      >
        {category}
      </h2>
      {children}
    </div>
  );
}

export function POSView() {
  const { products, refresh: refreshProducts, updateProduct } = useProducts();
  const { createSale } = useSales();
  const { calculateOptimalChange, processChange, processCashReceived } =
    useCashDrawer();
  const {
    checkStockAvailability,
    deductMateriaPrimaStock,
    calculateAvailableStock,
    refresh: refreshMateriaPrima,
  } = useMateriaPrima();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [cashReceived, setCashReceived] = useState(0);
  const [changeBreakdown, setChangeBreakdown] = useState<
    ChangeBreakdown[] | null
  >(null);
  const [processing, setProcessing] = useState(false);
  const [billHistory, setBillHistory] = useState<number[]>([]);
  const [productStocks, setProductStocks] = useState<Record<string, number>>(
    {}
  );
  const [sortedProducts, setSortedProducts] = useState<Product[]>([]);
  const [isLayoutLocked, setIsLayoutLocked] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [nextSaleNumber, setNextSaleNumber] = useState<number | null>(null);
  const [kdsEnabled, setKdsEnabled] = useState(false);
  const [kdsUrl, setKdsUrl] = useState('');
  const [showKdsPanel, setShowKdsPanel] = useState(false);
  const [kdsOrders, setKdsOrders] = useState<KDSOrder[]>([]);
  const kdsPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedOrdersRef = useRef<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      // Small delay so tap still works as tap
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadSettings = useCallback(async () => {
    try {
      await db.init();
      const settings = await db.get<AppSettings>('app_settings', 'default');
      if (settings) {
        setIsLayoutLocked(settings.pos_layout_locked);
        if (settings.category_order) {
          setCategoryOrder(settings.category_order);
        }
        setKdsEnabled(settings.kds_enabled || false);
        setKdsUrl(settings.kds_url || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  const loadStocks = useCallback(async () => {
    const materiaPrimaProducts = products.filter((p) => p.uses_materia_prima);

    if (materiaPrimaProducts.length === 0) {
      setProductStocks({});
      return;
    }

    const entries = await Promise.all(
      materiaPrimaProducts.map(async (product) => {
        const available = await calculateAvailableStock(product.id);
        return [product.id, available] as const;
      })
    );

    setProductStocks(Object.fromEntries(entries));
  }, [products, calculateAvailableStock]);

  const getProductStock = (product: Product) => {
    if (product.uses_materia_prima) {
      return productStocks[product.id] || 0;
    }
    return product.stock;
  };

  const activeProducts = sortedProducts.filter(
    (p) => p.active && getProductStock(p) > 0
  );

  const allCategories = Array.from(
    new Set(activeProducts.map((p) => p.category))
  );

  const categories =
    categoryOrder.length > 0
      ? [
          // ordered categories that exist
          ...categoryOrder.filter((cat) => allCategories.includes(cat)),
          // plus any new categories not yet in order
          ...allCategories.filter((cat) => !categoryOrder.includes(cat)),
        ]
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

    setCart((prevCart) => {
      const prevExisting = prevCart.find((item) => item.id === product.id);
      if (prevExisting) {
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => {
      const newCart = prevCart.filter((item) => item.id !== productId);

      if (newCart.length === 0) {
        setShowPayment(false);
        setCashReceived(0);
        setChangeBreakdown(null);
        setBillHistory([]);
        setPaymentMethod('cash');
      }

      return newCart;
    });
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
      const hasStock = await checkStockAvailability(product.id);
      if (!hasStock) {
        toast.error('Materia prima insuficiente para esta cantidad');
        return;
      }
    }

    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const change = cashReceived - total;

  const addCash = (amount: number) => {
    setCashReceived((prev) => {
      const newTotal = prev + amount;
      const newChange = newTotal - total;

      setBillHistory((prevHistory) => [...prevHistory, amount]);

      if (newTotal >= total) {
        const breakdown = calculateOptimalChange(newChange);
        setChangeBreakdown(breakdown);
      } else {
        setChangeBreakdown(null);
      }

      return newTotal;
    });
  };

  const undoLastBill = () => {
    setBillHistory((prevHistory) => {
      if (prevHistory.length === 0) return prevHistory;

      const lastBill = prevHistory[prevHistory.length - 1];

      setCashReceived((prevCash) => {
        const newTotal = Math.max(0, prevCash - lastBill);
        const newChange = newTotal - total;

        if (newTotal >= total) {
          const breakdown = calculateOptimalChange(newChange);
          setChangeBreakdown(breakdown);
        } else {
          setChangeBreakdown(null);
        }

        return newTotal;
      });

      return prevHistory.slice(0, -1);
    });
  };

  const resetCash = () => {
    setCashReceived(0);
    setChangeBreakdown(null);
    setBillHistory([]);
  };

  const sendToKDS = async (
    saleNumber: string,
    items: SaleItem[],
    total: number
  ) => {
    try {
      await db.init();
      const settings = await db.get<AppSettings>('app_settings', 'default');

      if (!settings?.kds_enabled || !settings?.kds_url) {
        return;
      }

      const response = await fetch(`${settings.kds_url}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sale_number: saleNumber,
          items: items.map((item) => ({
            product_name: item.product_name,
            quantity: item.quantity,
            product_price: item.product_price,
          })),
          total,
          payment_method: paymentMethod,
        }),
      });

      if (!response.ok) {
        console.error('Failed to send order to KDS:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending order to KDS:', error);
    }
  };

  const fetchKdsOrders = useCallback(async () => {
    if (!kdsEnabled || !kdsUrl) return;

    try {
      const response = await fetch(`${kdsUrl}/api/orders`);
      if (response.ok) {
        const orders: KDSOrder[] = await response.json();

        // Check for newly finished orders
        orders.forEach((order) => {
          if (
            order.status === 'finished' &&
            !finishedOrdersRef.current.has(order.id)
          ) {
            finishedOrdersRef.current.add(order.id);
            // Auto-remove after 2 seconds
            setTimeout(() => {
              setKdsOrders((prev) => prev.filter((o) => o.id !== order.id));
              finishedOrdersRef.current.delete(order.id);
            }, 2000);
          }
        });

        setKdsOrders(orders);
      }
    } catch (error) {
      console.error('Error fetching KDS orders:', error);
    }
  }, [kdsEnabled, kdsUrl]);

  const updateKdsOrderStatus = async (
    orderId: string,
    status: 'preparing' | 'finished'
  ) => {
    if (!kdsUrl) return;

    try {
      const response = await fetch(`${kdsUrl}/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        if (status === 'finished') {
          finishedOrdersRef.current.add(orderId);
          // Auto-remove after 2 seconds
          setTimeout(() => {
            setKdsOrders((prev) => prev.filter((o) => o.id !== orderId));
            finishedOrdersRef.current.delete(orderId);
          }, 2000);
        }
        // Update local state immediately
        setKdsOrders((prev) =>
          prev.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  status,
                  finished_at:
                    status === 'finished'
                      ? new Date().toISOString()
                      : undefined,
                }
              : order
          )
        );
      }
    } catch (error) {
      console.error('Error updating KDS order status:', error);
      toast.error('Error al actualizar el estado del pedido');
    }
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

      const materiaPrimaItems = cart.filter((item) => item.uses_materia_prima);

      await Promise.all(
        materiaPrimaItems.map((item) =>
          deductMateriaPrimaStock(item.id, item.quantity)
        )
      );

      if (paymentMethod === 'cash' && saleData) {
        const billsReceivedData = await processCashReceived(
          billHistory,
          saleData.id
        );

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

      if (saleData) {
        await sendToKDS(saleData.sale_number, items, total);
      }

      await refreshProducts();
      await refreshMateriaPrima();
      // No need to call loadStocks here: it will run after products change via the effect.

      setCart([]);
      setCashReceived(0);
      setChangeBreakdown(null);
      setShowPayment(false);
      setPaymentMethod('cash');
      setBillHistory([]);
      setNextSaleNumber((prev) => (prev !== null ? prev + 1 : prev));

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

  const saveProductOrder = useCallback(
    async (productsToSave?: Product[]) => {
      const list = productsToSave ?? sortedProducts;
      try {
        await Promise.all(
          list.map((product, index) =>
            updateProduct(product.id, { ...product, display_order: index })
          )
        );
      } catch (error) {
        console.error('Error saving product order:', error);
      }
    },
    [sortedProducts, updateProduct]
  );

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
        const settings = (await db.get<AppSettings>(
          'app_settings',
          'default'
        )) || {
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

      // No cross-category drag
      if (activeProduct.category !== overProduct.category) {
        return;
      }

      const newProducts = arrayMove(sortedProducts, oldIndex, newIndex);
      setSortedProducts(newProducts);
      await saveProductOrder(newProducts);
    }
  };

  const activeProduct =
    activeId && !activeId.toString().startsWith('category-')
      ? sortedProducts.find((p) => p.id === activeId)
      : null;

  const activeCategory =
    activeId && activeId.toString().startsWith('category-')
      ? activeId.toString().replace('category-', '')
      : null;

  const loadNextSaleNumber = useCallback(async () => {
    try {
      await db.init();
      const allSales = await db.getAll<Sale>('sales');
      const lastSaleNumber =
        allSales.length > 0
          ? Math.max(
              ...allSales.map((s) => {
                const numStr = s.sale_number.replace(/^S-/, '');
                return parseInt(numStr) || 0;
              })
            )
          : 0;
      setNextSaleNumber(lastSaleNumber + 1);
    } catch (error) {
      console.error('Error loading next sale number:', error);
    }
  }, []);

  const toggleLayoutLock = useCallback(async () => {
    try {
      await db.init();
      const newLockState = !isLayoutLocked;

      // If locking, save current product order
      if (newLockState) {
        await saveProductOrder();
      }

      const existingSettings = (await db.get<AppSettings>(
        'app_settings',
        'default'
      )) || {
        id: 'default',
        pos_layout_locked: false,
        category_order: [], // optional default
        updated_at: new Date().toISOString(),
      };

      const updatedSettings: AppSettings = {
        ...existingSettings,
        pos_layout_locked: newLockState,
        category_order:
          categoryOrder.length > 0
            ? categoryOrder
            : existingSettings.category_order,
        updated_at: new Date().toISOString(),
      };

      await db.put('app_settings', updatedSettings);
      setIsLayoutLocked(newLockState);
    } catch (error) {
      console.error('Error toggling POS layout lock:', error);
      toast.error('Error al cambiar el estado del bloqueo');
    }
  }, [isLayoutLocked, categoryOrder, saveProductOrder]);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  useEffect(() => {
    loadSettings();
    loadNextSaleNumber();
    // we no longer use global events for lock/save
  }, [loadSettings, loadNextSaleNumber]);

  useEffect(() => {
    const sorted = [...products].sort((a, b) => {
      const orderA = a.display_order ?? 999999;
      const orderB = b.display_order ?? 999999;
      return orderA - orderB;
    });
    setSortedProducts(sorted);
  }, [products]);

  // KDS polling when panel is open
  useEffect(() => {
    if (showKdsPanel && kdsEnabled && kdsUrl) {
      fetchKdsOrders();
      kdsPollingRef.current = setInterval(fetchKdsOrders, 3000);
    }

    return () => {
      if (kdsPollingRef.current) {
        clearInterval(kdsPollingRef.current);
        kdsPollingRef.current = null;
      }
    };
  }, [showKdsPanel, kdsEnabled, kdsUrl, fetchKdsOrders]);

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
        <div className='flex-1 p-6 overflow-auto scrollbar-hide relative'>
          <div className='absolute top-2 right-2 z-20 flex items-center gap-2'>
            {kdsEnabled && (
              <button
                type='button'
                onClick={() => setShowKdsPanel(true)}
                className='p-2 transition-transform'
                aria-label='Ver pedidos KDS'
              >
                <Eye size={20} style={{ color: 'var(--color-accent)' }} />
              </button>
            )}
            <button
              type='button'
              onClick={toggleLayoutLock}
              className='p-2 transition-transform'
              aria-label={
                isLayoutLocked
                  ? 'Desbloquear diseño del POS'
                  : 'Bloquear diseño del POS'
              }
            >
              {isLayoutLocked ? (
                <Lock size={20} style={{ color: 'var(--color-accent)' }} />
              ) : (
                <Unlock size={20} style={{ color: 'var(--color-accent)' }} />
              )}
            </button>
          </div>
          <SortableContext
            items={categories.map((cat) => `category-${cat}`)}
            disabled={isLayoutLocked}
          >
            {categories.map((category) => {
              const categoryProducts = activeProducts.filter(
                (p) => p.category === category
              );
              const categoryProductIds = categoryProducts.map((p) => p.id);

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
            <div
              className='text-sm font-semibold'
              style={{ color: 'var(--color-text)' }}
            >
              Venta #
              {nextSaleNumber !== null
                ? nextSaleNumber.toLocaleString('es-AR')
                : '...'}
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
                            backgroundColor:
                              'var(--color-background-secondary)',
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
                            backgroundColor:
                              'var(--color-background-secondary)',
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
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-on-accent)',
                }}
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
                      className='py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all'
                      style={
                        paymentMethod === 'cash'
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
                      <Banknote size={20} />
                      Efectivo
                    </button>
                    <button
                      onClick={() => setPaymentMethod('online')}
                      className='py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all'
                      style={
                        paymentMethod === 'online'
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
                              className='text-xs px-2 py-1 rounded border flex items-center gap-1'
                              style={{
                                backgroundColor:
                                  'var(--color-background-secondary)',
                                borderColor: 'var(--color-accent)',
                                color: 'var(--color-accent)',
                              }}
                            >
                              <Undo size={12} />
                              Deshacer
                            </button>
                          )}
                          {cashReceived > 0 && (
                            <button
                              onClick={resetCash}
                              className='text-xs px-2 py-1 rounded flex items-center gap-1'
                              style={{
                                backgroundColor:
                                  'var(--color-background-accent)',
                                color: 'var(--color-text)',
                              }}
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
                        <div
                          className='mt-3 p-3 rounded-lg border'
                          style={{
                            backgroundColor: 'var(--color-background-accent)',
                            borderColor: 'var(--color-accent)',
                          }}
                        >
                          <div
                            className='text-sm font-semibold mb-2'
                            style={{ color: 'var(--color-accent)' }}
                          >
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
                          <div
                            className='mt-3 p-3 rounded-lg border'
                            style={{
                              backgroundColor: 'var(--color-background-accent)',
                              borderColor: 'var(--color-primary)',
                            }}
                          >
                            <div
                              className='text-sm'
                              style={{ color: 'var(--color-primary)' }}
                            >
                              No se puede dar cambio exacto con los billetes
                              disponibles
                            </div>
                          </div>
                        )}
                    </div>

                    <div className='mb-4'>
                      <div
                        className='text-xs mb-2'
                        style={{ color: 'var(--color-text)', opacity: 0.7 }}
                      >
                        Agregar billetes:
                      </div>
                      <div className='grid grid-cols-5 gap-2'>
                        {BILLS.map((bill) => (
                          <button
                            key={bill}
                            onClick={() => addCash(bill)}
                            className='py-2 px-3 rounded font-semibold'
                            style={{
                              backgroundColor: 'var(--color-background-accent)',
                              color: 'var(--color-text)',
                            }}
                          >
                            +{formatPrice(bill)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className='mb-4 p-4 rounded-lg border'
                    style={{
                      backgroundColor: 'var(--color-background-accent)',
                      borderColor: 'var(--color-accent)',
                    }}
                  >
                    <div
                      className='text-center'
                      style={{ color: 'var(--color-accent)' }}
                    >
                      <CreditCard size={32} className='mx-auto mb-2' />
                      <div className='font-semibold'>Pago en Línea</div>
                      <div
                        className='text-sm mt-1'
                        style={{ color: 'var(--color-text)' }}
                      >
                        El cliente pagará electrónicamente
                      </div>
                    </div>
                  </div>
                )}

                <div className='space-y-2'>
                  <button
                    onClick={completeSale}
                    disabled={!canComplete() || processing}
                    className='w-full py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed'
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-on-primary)',
                    }}
                  >
                    {processing ? 'Procesando...' : 'Completar Venta'}
                  </button>
                  <button
                    onClick={cancelPayment}
                    className='w-full py-3 rounded-lg font-bold'
                    style={{
                      backgroundColor: 'var(--color-background-accent)',
                      color: 'var(--color-text)',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KDS Orders Panel */}
      {showKdsPanel && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
          <div
            className='w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col'
            style={{ backgroundColor: 'var(--color-background-secondary)' }}
          >
            <div
              className='px-6 py-4 flex items-center justify-between border-b'
              style={{ borderColor: 'var(--color-background-accent)' }}
            >
              <div className='flex items-center gap-3'>
                <ChefHat size={24} style={{ color: 'var(--color-primary)' }} />
                <h2
                  className='text-xl font-bold'
                  style={{ color: 'var(--color-text)' }}
                >
                  Pedidos en Cocina (KDS)
                </h2>
              </div>
              <button
                onClick={() => setShowKdsPanel(false)}
                className='flex justify-center items-center p-1 rounded-lg hover:opacity-80 transition-opacity'
                style={{ backgroundColor: 'var(--color-background-accent)' }}
              >
                <X size={20} style={{ color: 'var(--color-text)' }} />
              </button>
            </div>

            <div className='flex-1 overflow-auto p-6'>
              {kdsOrders.length === 0 ? (
                <div
                  className='text-center py-12 opacity-60'
                  style={{ color: 'var(--color-text)' }}
                >
                  <ChefHat size={48} className='mx-auto mb-4 opacity-40' />
                  <p>No hay pedidos en cocina</p>
                </div>
              ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                  {kdsOrders.map((order) => (
                    <div
                      key={order.id}
                      className={`rounded-lg p-4 border-2 transition-all duration-300 ${
                        order.status === 'finished' ? 'opacity-50 scale-95' : ''
                      }`}
                      style={{
                        backgroundColor: 'var(--color-background)',
                        borderColor:
                          order.status === 'preparing'
                            ? 'var(--color-accent)'
                            : 'var(--color-primary)',
                      }}
                    >
                      <div className='flex items-center justify-between mb-3'>
                        <span
                          className='font-bold text-lg'
                          style={{ color: 'var(--color-text)' }}
                        >
                          #{order.sale_number}
                        </span>
                        <span
                          className='px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1'
                          style={{
                            backgroundColor:
                              order.status === 'preparing'
                                ? 'var(--color-accent)'
                                : 'var(--color-primary)',
                            color:
                              order.status === 'preparing'
                                ? 'var(--color-on-accent)'
                                : 'var(--color-on-primary)',
                          }}
                        >
                          {order.status === 'preparing' ? (
                            <>
                              <ChefHat size={12} />
                              Preparando
                            </>
                          ) : (
                            <>
                              <CheckCircle size={12} />
                              Listo
                            </>
                          )}
                        </span>
                      </div>

                      <div className='space-y-2 mb-4'>
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className='flex justify-between text-sm'
                            style={{ color: 'var(--color-text)' }}
                          >
                            <span>
                              {item.quantity}x {item.product_name}
                            </span>
                            <span className='opacity-60'>
                              {formatPrice(item.product_price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div
                        className='flex justify-between items-center pt-3 border-t'
                        style={{
                          borderColor: 'var(--color-background-accent)',
                        }}
                      >
                        <span
                          className='font-bold'
                          style={{ color: 'var(--color-primary)' }}
                        >
                          {formatPrice(order.total)}
                        </span>

                        {order.status === 'preparing' && (
                          <button
                            onClick={() =>
                              updateKdsOrderStatus(order.id, 'finished')
                            }
                            className='px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90'
                            style={{
                              backgroundColor: 'var(--color-primary)',
                              color: 'var(--color-on-primary)',
                            }}
                          >
                            Marcar Listo
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DragOverlay>
        {activeProduct ? (
          <div className='opacity-80 rotate-3 scale-105 shadow-2xl'>
            <button
              className='w-full p-6 rounded-lg'
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
              }}
            >
              <div className='text-lg font-bold mb-2'>{activeProduct.name}</div>
              <div className='text-2xl font-bold mb-1'>
                {formatPrice(activeProduct.price)}
              </div>
              <div className='text-sm opacity-90'>
                Stock: {formatNumber(getProductStock(activeProduct))}
              </div>
            </button>
          </div>
        ) : activeCategory ? (
          <div
            className='opacity-80 scale-105 shadow-2xl backdrop-blur-sm rounded-lg px-4 py-2'
            style={{ backgroundColor: 'var(--color-background-secondary)' }}
          >
            <h2
              className='text-xl font-semibold capitalize'
              style={{ color: 'var(--color-text)' }}
            >
              {activeCategory}
            </h2>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
