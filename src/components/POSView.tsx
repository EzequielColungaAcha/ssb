import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
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
  Beef,
  Clock,
  Pencil,
  User,
  Home,
  Truck,
  DollarSign,
  Smartphone,
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
import {
  Product,
  db,
  AppSettings,
  Sale,
  Combo,
  MateriaPrima,
} from '../lib/indexeddb';
import { useProducts } from '../hooks/useProducts';
import { useSales } from '../hooks/useSales';
import { useCashDrawer, ChangeBreakdown } from '../hooks/useCashDrawer';
import { useMateriaPrima } from '../hooks/useMateriaPrima';
import { useCombo, ComboSelection } from '../hooks/useCombo';
import { useTheme } from '../contexts/ThemeContext';
import { formatPrice, formatNumber } from '../lib/utils';

interface CartItem extends Product {
  quantity: number;
  cartItemId: string; // unique per cart entry (allows same product with different mods)
  removedIngredients: string[]; // materia prima names removed
  // Combo-specific fields
  isCombo?: boolean;
  comboId?: string;
  comboName?: string;
  comboSelections?: ComboSelection[];
}

interface KDSOrderItem {
  product_name: string;
  quantity: number;
  product_price: number;
  removed_ingredients?: string[];
  combo_name?: string;
}

interface KDSOrder {
  id: string;
  sale_number: string;
  items: KDSOrderItem[];
  total: number;
  status: 'pending' | 'preparing' | 'on_delivery' | 'completed';
  scheduled_time?: string;
  customer_name?: string;
  order_type?: 'pickup' | 'delivery';
  delivery_address?: string;
  created_at: string;
  finished_at?: string;
}

interface IngredientInfo {
  id: string;
  name: string;
  removed: boolean;
}

const BILLS = [10, 20, 50, 100, 200, 500, 1000, 2000, 10000, 20000];

interface SortableProductItemProps {
  product: Product;
  isLocked: boolean;
  onAddToCart: (product: Product) => void;
  onLongPress: (product: Product) => void;
  getStock: (product: Product) => number;
  hasRemovableIngredients: boolean;
  isOutOfStock: boolean;
}

function SortableProductItem({
  product,
  isLocked,
  onAddToCart,
  onLongPress,
  getStock,
  hasRemovableIngredients,
  isOutOfStock,
}: SortableProductItemProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

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

  const handlePointerDown = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress(product);
    }, 500);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isLongPress.current) {
      onAddToCart(product);
    }
    isLongPress.current = false;
  };

  const handlePointerLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className='relative h-full'
      {...(isLocked ? {} : { ...attributes, ...listeners })}
    >
      <button
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={
          isLocked && !isOutOfStock ? handlePointerDown : undefined
        }
        onPointerUp={isLocked && !isOutOfStock ? handlePointerUp : undefined}
        onPointerLeave={
          isLocked && !isOutOfStock ? handlePointerLeave : undefined
        }
        onClick={
          isLocked && !isOutOfStock
            ? undefined
            : !isOutOfStock
            ? () => onAddToCart(product)
            : undefined
        }
        disabled={isOutOfStock}
        className={`w-full h-full p-6 rounded-lg shadow-md transition-all duration-200 relative flex flex-col justify-between ${
          isOutOfStock
            ? 'opacity-50 cursor-not-allowed'
            : isLocked
            ? 'hover:shadow-xl hover:scale-105 select-none'
            : 'cursor-move'
        }`}
        style={{
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-on-primary)',
        }}
      >
        {isOutOfStock && (
          <div
            className='absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-bold'
            style={{
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: 'white',
            }}
          >
            SIN STOCK
          </div>
        )}
        {hasRemovableIngredients && !isOutOfStock && (
          <div
            className='absolute top-2 right-2 p-1 rounded-md opacity-80'
            style={{ backgroundColor: 'var(--color-on-primary)' }}
            title='Mantené presionado para personalizar'
          >
            <Beef size={14} style={{ color: 'var(--color-primary)' }} />
          </div>
        )}
        <div>
          <div className='text-lg font-bold mb-2'>{product.name}</div>
        </div>
        <div>
          <div className='text-2xl font-bold mb-1'>
            {formatPrice(product.price)}
          </div>
          <div className='text-sm opacity-90'>
            Stock: {formatNumber(getStock(product))}
          </div>
        </div>
      </button>
    </div>
  );
}

interface SortableComboItemProps {
  combo: Combo;
  isLocked: boolean;
  onOpenComboModal: (combo: Combo) => void;
  isOutOfStock: boolean;
}

function SortableComboItem({
  combo,
  isLocked,
  onOpenComboModal,
  isOutOfStock,
}: SortableComboItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `combo-${combo.id}`,
    disabled: isLocked,
    data: { type: 'combo' },
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
      className='relative h-full'
      {...(isLocked ? {} : { ...attributes, ...listeners })}
    >
      <button
        onClick={
          isLocked && !isOutOfStock ? () => onOpenComboModal(combo) : undefined
        }
        disabled={isOutOfStock}
        className={`w-full h-full p-6 rounded-lg shadow-md transition-all duration-200 text-left relative flex flex-col justify-between ${
          isOutOfStock
            ? 'opacity-50 cursor-not-allowed'
            : isLocked
            ? 'hover:shadow-xl hover:scale-105 select-none'
            : 'cursor-move'
        }`}
        style={{
          backgroundColor: 'var(--color-accent)',
          color: 'var(--color-on-accent)',
        }}
      >
        {isOutOfStock && (
          <div
            className='absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-bold z-10'
            style={{
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: 'white',
            }}
          >
            SIN STOCK
          </div>
        )}
        <div>
          <div className='text-lg font-bold mb-2'>{combo.name}</div>
        </div>
        <div>
          <div className='text-2xl font-bold mb-1'>
            {combo.price_type === 'fixed'
              ? formatPrice(combo.fixed_price || 0)
              : combo.discount_type === 'percentage'
              ? `-${combo.discount_value}%`
              : `-${formatPrice(combo.discount_value || 0)}`}
          </div>
          <div className='text-sm opacity-90'>
            {combo.slots.length} producto
            {combo.slots.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div
          className='absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-semibold'
          style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
          }}
        >
          COMBO
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
  const {
    products,
    refresh: refreshProducts,
    updateProduct,
    updateStock,
  } = useProducts();
  const { sales, createSale, updateSale } = useSales();
  const { calculateOptimalChange, processChange, processCashReceived } =
    useCashDrawer();
  const {
    checkStockAvailability,
    calculateAvailableStock,
    refresh: refreshMateriaPrima,
    getProductMateriaPrima,
    materiaPrima,
  } = useMateriaPrima();
  const {
    combos,
    calculateComboPrice,
    getDefaultSelections,
    getSlotProducts,
    updateCombosOrder,
  } = useCombo();
  const { syncThemeToKDS } = useTheme();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'online' | 'card' | 'on_delivery' | 'unpaid'
  >('cash');
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
  const [deliveryChargeAmount, setDeliveryChargeAmount] = useState(0);
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showKdsPanel, setShowKdsPanel] = useState(false);
  const [kdsOrders, setKdsOrders] = useState<KDSOrder[]>([]);
  const [kdsConnectionStatus, setKdsConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const kdsPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const kdsWsRef = useRef<WebSocket | null>(null);
  const kdsWsReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedOrdersRef = useRef<Set<string>>(new Set());

  // KDS inline ingredient editing state
  const [kdsEditingIngredients, setKdsEditingIngredients] = useState<{
    orderId: string;
    itemIndex: number;
  } | null>(null);

  // KDS address editing state
  const [kdsEditingAddress, setKdsEditingAddress] = useState<string | null>(
    null
  );
  const kdsAddressInputRef = useRef<HTMLInputElement>(null);

  // KDS mark as paid state
  const [kdsMarkingPaid, setKdsMarkingPaid] = useState<string | null>(null); // sale_number
  const [kdsMarkPaymentMethod, setKdsMarkPaymentMethod] = useState<
    'cash' | 'online' | 'card' | 'on_delivery'
  >('cash');
  const [kdsMarkCashReceived, setKdsMarkCashReceived] = useState(0);
  const [kdsMarkBillHistory, setKdsMarkBillHistory] = useState<number[]>([]);
  const [kdsUnpaidSales, setKdsUnpaidSales] = useState<Record<string, Sale>>(
    {}
  );
  const [kdsAddressValue, setKdsAddressValue] = useState('');

  // Ingredient customization modal state
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(
    null
  );
  const [ingredientsList, setIngredientsList] = useState<IngredientInfo[]>([]);

  // Combo customization modal state
  const [showComboModal, setShowComboModal] = useState(false);
  const [customizingCombo, setCustomizingCombo] = useState<Combo | null>(null);
  const [comboSelections, setComboSelections] = useState<ComboSelection[]>([]);
  const [comboSlotProducts, setComboSlotProducts] = useState<
    Record<string, Product[]>
  >({});
  const [comboPrice, setComboPrice] = useState(0);

  // Scheduled time for order
  const [scheduledTime, setScheduledTime] = useState<string>('');

  // Time validation helper
  const isValidTime = useCallback((time: string): boolean => {
    if (!time) return true; // Empty is valid (optional)
    const match = time.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return false;
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  }, []);

  // Format and validate time input
  const handleTimeChange = useCallback((value: string) => {
    // Remove non-digits
    let digits = value.replace(/[^0-9]/g, '');

    // Limit to 4 digits
    if (digits.length > 4) digits = digits.slice(0, 4);

    // Auto-format with colon
    let formatted = digits;
    if (digits.length > 2) {
      formatted = digits.slice(0, 2) + ':' + digits.slice(2);
    }

    // Validate and clamp values
    if (digits.length >= 2) {
      let hours = parseInt(digits.slice(0, 2), 10);
      if (hours > 23) hours = 23;
      const hoursStr = hours.toString().padStart(2, '0');

      if (digits.length > 2) {
        let minutes = parseInt(digits.slice(2), 10);
        if (digits.length === 4 && minutes > 59) minutes = 59;
        const minutesStr = minutes.toString().padStart(digits.length - 2, '0');
        formatted = hoursStr + ':' + minutesStr;
      } else {
        formatted = hoursStr;
      }
    }

    setScheduledTime(formatted);
  }, []);

  // Customer info for order
  const [customerName, setCustomerName] = useState<string>('');
  const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Editing order state
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Full-screen edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingKdsOrder, setEditingKdsOrder] = useState<KDSOrder | null>(null);
  const [editModalItems, setEditModalItems] = useState<KDSOrderItem[]>([]);
  const [editScheduledTime, setEditScheduledTime] = useState<string>('');
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editOrderType, setEditOrderType] = useState<'pickup' | 'delivery'>(
    'pickup'
  );
  const [editDeliveryAddress, setEditDeliveryAddress] = useState('');

  // Edit ingredient sub-modal state (within edit order modal)
  const [editIngredientItemIndex, setEditIngredientItemIndex] = useState<
    number | null
  >(null);
  const [editIngredientsList, setEditIngredientsList] = useState<
    { name: string; removed: boolean }[]
  >([]);

  const activeCombos = useMemo(() => combos.filter((c) => c.active), [combos]);

  // State for sorted combos (for drag and drop)
  const [sortedCombos, setSortedCombos] = useState<Combo[]>([]);

  // Track combo stock availability
  const [comboStockStatus, setComboStockStatus] = useState<
    Record<string, boolean>
  >({});

  // Track which products have removable ingredients
  const [
    productsWithRemovableIngredients,
    setProductsWithRemovableIngredients,
  ] = useState<Set<string>>(new Set());

  // Map product name to its removable ingredients
  const [productRemovableIngredients, setProductRemovableIngredients] =
    useState<Record<string, string[]>>({});

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
        setDeliveryChargeAmount(settings.delivery_charge || 0);
        setFreeDeliveryThreshold(settings.free_delivery_threshold || 0);
        console.log('KDS Settings loaded:', {
          kdsEnabled: settings.kds_enabled,
          kdsUrl: settings.kds_url,
        });
      } else {
        console.log('KDS Settings: no settings found in IndexedDB');
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

  const activeProducts = sortedProducts.filter((p) => p.active);

  const productCategories = Array.from(
    new Set(activeProducts.map((p) => p.category))
  );

  // Include "combos" as a category if there are active combos
  const allCategories =
    activeCombos.length > 0
      ? [...productCategories, 'combos']
      : productCategories;

  const categories =
    categoryOrder.length > 0
      ? [
          // ordered categories that exist
          ...categoryOrder.filter((cat) => allCategories.includes(cat)),
          // plus any new categories not yet in order
          ...allCategories.filter((cat) => !categoryOrder.includes(cat)),
        ]
      : allCategories;

  const addToCart = async (
    product: Product,
    removedIngredients: string[] = []
  ) => {
    const removedKey = removedIngredients.sort().join(',');
    // Find existing item with same product AND same removed ingredients
    const existing = cart.find(
      (item) =>
        item.id === product.id &&
        item.removedIngredients.sort().join(',') === removedKey
    );
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
      const prevExisting = prevCart.find(
        (item) =>
          item.id === product.id &&
          item.removedIngredients.sort().join(',') === removedKey
      );
      if (prevExisting) {
        return prevCart.map((item) =>
          item.cartItemId === prevExisting.cartItemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prevCart,
        {
          ...product,
          quantity: 1,
          cartItemId: crypto.randomUUID(),
          removedIngredients,
        },
      ];
    });

    toast.success(`${product.name} agregado`);
  };

  // Handle long-press to open ingredient customization modal
  const handleProductLongPress = async (product: Product) => {
    if (!product.uses_materia_prima) {
      // If product doesn't use materia prima, just add to cart
      addToCart(product);
      return;
    }

    // Fetch product's materia prima
    const productMPs = await getProductMateriaPrima(product.id);

    if (productMPs.length === 0) {
      // No ingredients to customize, just add to cart
      addToCart(product);
      return;
    }

    // Filter only removable ingredients
    const removableMPs = productMPs.filter((pmp) => pmp.removable === true);

    if (removableMPs.length === 0) {
      // No removable ingredients, just add to cart
      addToCart(product);
      return;
    }

    // Build ingredient list with names (only removable ones)
    const ingredients: IngredientInfo[] = removableMPs.map((pmp) => {
      const mp = materiaPrima.find((m) => m.id === pmp.materia_prima_id);
      return {
        id: pmp.materia_prima_id,
        name: mp?.name || 'Desconocido',
        removed: false,
      };
    });

    setIngredientsList(ingredients);
    setCustomizingProduct(product);
    setShowIngredientModal(true);
  };

  // Toggle ingredient removal in modal
  const toggleIngredient = (ingredientId: string) => {
    setIngredientsList((prev) =>
      prev.map((ing) =>
        ing.id === ingredientId ? { ...ing, removed: !ing.removed } : ing
      )
    );
  };

  // Confirm customization and add to cart
  const confirmCustomization = () => {
    if (!customizingProduct) return;

    const removedIngredients = ingredientsList
      .filter((ing) => ing.removed)
      .map((ing) => ing.name);

    addToCart(customizingProduct, removedIngredients);

    // Reset modal state
    setShowIngredientModal(false);
    setCustomizingProduct(null);
    setIngredientsList([]);
  };

  // Cancel customization
  const cancelCustomization = () => {
    setShowIngredientModal(false);
    setCustomizingProduct(null);
    setIngredientsList([]);
  };

  // ===== COMBO FUNCTIONS =====

  // Open combo customization modal
  const openComboModal = async (combo: Combo) => {
    setCustomizingCombo(combo);

    // Load slot products
    const slotProducts: Record<string, Product[]> = {};
    for (const slot of combo.slots) {
      slotProducts[slot.id] = await getSlotProducts(slot);
    }
    setComboSlotProducts(slotProducts);

    // Get default selections
    const defaults = await getDefaultSelections(combo);
    setComboSelections(defaults);

    // Calculate initial price
    const price = await calculateComboPrice(
      combo,
      defaults.map((s) => ({ productId: s.productId, quantity: 1 }))
    );
    setComboPrice(price);

    setShowComboModal(true);
  };

  // Update combo selection for a slot
  const updateComboSelection = async (
    slotId: string,
    slotIndex: number,
    productId: string
  ) => {
    const slot = customizingCombo?.slots.find((s) => s.id === slotId);
    const product = comboSlotProducts[slotId]?.find((p) => p.id === productId);

    if (!slot || !product) return;

    const newSelections = [...comboSelections];
    // Find the selection for this slot at this index
    let count = 0;
    for (let i = 0; i < newSelections.length; i++) {
      if (newSelections[i].slotId === slotId) {
        if (count === slotIndex) {
          newSelections[i] = {
            ...newSelections[i],
            productId: product.id,
            productName: product.name,
            productPrice: product.price,
            removedIngredients: [],
          };
          break;
        }
        count++;
      }
    }

    setComboSelections(newSelections);

    // Recalculate price
    if (customizingCombo) {
      const price = await calculateComboPrice(
        customizingCombo,
        newSelections.map((s) => ({ productId: s.productId, quantity: 1 }))
      );
      setComboPrice(price);
    }
  };

  // Confirm combo and add to cart
  // Helper to create a signature for combo selections (for grouping identical combos)
  const getComboSelectionsSignature = (
    selections: ComboSelection[]
  ): string => {
    return selections
      .map((s) => {
        const removed = (s.removedIngredients || []).slice().sort().join(',');
        return `${s.slotId}:${s.productId}:${removed}`;
      })
      .join('|');
  };

  const confirmComboSelection = async () => {
    if (!customizingCombo) return;

    // Calculate stock requirements per product (including this new combo)
    const stockRequirements = new Map<string, number>();

    // Add requirements from the new combo being added
    for (const selection of comboSelections) {
      const current = stockRequirements.get(selection.productId) || 0;
      stockRequirements.set(selection.productId, current + 1);
    }

    // Add requirements from existing cart items
    for (const cartItem of cart) {
      if (cartItem.isCombo && cartItem.comboSelections) {
        for (const sel of cartItem.comboSelections) {
          const current = stockRequirements.get(sel.productId) || 0;
          stockRequirements.set(sel.productId, current + cartItem.quantity);
        }
      } else if (!cartItem.isCombo) {
        const current = stockRequirements.get(cartItem.id) || 0;
        stockRequirements.set(cartItem.id, current + cartItem.quantity);
      }
    }

    // Validate stock for each product
    for (const [productId, required] of stockRequirements) {
      const product = products.find((p) => p.id === productId);
      if (!product) continue;

      const available = product.uses_materia_prima
        ? await calculateAvailableStock(productId)
        : product.stock;

      if (required > available) {
        toast.error('Stock insuficiente');
        return;
      }
    }

    // Create signature for the new combo
    const newSignature = getComboSelectionsSignature(comboSelections);

    // Check if identical combo already exists in cart
    const existingCombo = cart.find(
      (item) =>
        item.isCombo &&
        item.comboId === customizingCombo.id &&
        item.comboSelections &&
        getComboSelectionsSignature(item.comboSelections) === newSignature
    );

    if (existingCombo) {
      // Increment quantity of existing combo
      setCart((prev) =>
        prev.map((item) =>
          item.cartItemId === existingCombo.cartItemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      // Create a new combo cart item
      const comboCartItem: CartItem = {
        id: customizingCombo.id,
        name: customizingCombo.name,
        price: comboPrice,
        category: 'combos',
        stock: 999,
        active: true,
        production_cost: 0,
        uses_materia_prima: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        quantity: 1,
        cartItemId: `combo_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        removedIngredients: [],
        isCombo: true,
        comboId: customizingCombo.id,
        comboName: customizingCombo.name,
        comboSelections: comboSelections,
      };

      setCart((prev) => [...prev, comboCartItem]);
    }

    toast.success(`${customizingCombo.name} agregado`);

    // Reset modal state
    setShowComboModal(false);
    setCustomizingCombo(null);
    setComboSelections([]);
    setComboSlotProducts({});
    setComboPrice(0);
  };

  // Cancel combo customization
  const cancelComboSelection = () => {
    setShowComboModal(false);
    setCustomizingCombo(null);
    setComboSelections([]);
    setComboSlotProducts({});
    setComboPrice(0);
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prevCart) => {
      const newCart = prevCart.filter((item) => item.cartItemId !== cartItemId);

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

  const updateQuantity = async (cartItemId: string, quantity: number) => {
    const cartItem = cart.find((item) => item.cartItemId === cartItemId);
    if (!cartItem) return;

    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    // For combo items, validate stock of all component products
    if (cartItem.isCombo && cartItem.comboSelections) {
      // Only check if quantity is increasing
      if (quantity > cartItem.quantity) {
        // Calculate stock requirements including the new quantity
        const stockRequirements = new Map<string, number>();

        // Add requirements from this combo with new quantity
        for (const sel of cartItem.comboSelections) {
          const current = stockRequirements.get(sel.productId) || 0;
          stockRequirements.set(sel.productId, current + quantity);
        }

        // Add requirements from other cart items
        for (const otherItem of cart) {
          if (otherItem.cartItemId === cartItemId) continue; // Skip current item

          if (otherItem.isCombo && otherItem.comboSelections) {
            for (const sel of otherItem.comboSelections) {
              const current = stockRequirements.get(sel.productId) || 0;
              stockRequirements.set(
                sel.productId,
                current + otherItem.quantity
              );
            }
          } else if (!otherItem.isCombo) {
            const current = stockRequirements.get(otherItem.id) || 0;
            stockRequirements.set(otherItem.id, current + otherItem.quantity);
          }
        }

        // Validate stock for each product
        for (const [productId, required] of stockRequirements) {
          const product = products.find((p) => p.id === productId);
          if (!product) continue;

          const available = product.uses_materia_prima
            ? await calculateAvailableStock(productId)
            : product.stock;

          if (required > available) {
            toast.error('Stock insuficiente');
            return;
          }
        }
      }
    } else {
      // Regular product stock check
      const availableStock = getProductStock(cartItem);

      if (quantity > availableStock) {
        toast.error('Stock insuficiente');
        return;
      }

      if (cartItem.uses_materia_prima) {
        const hasStock = await checkStockAvailability(cartItem.id);
        if (!hasStock) {
          toast.error('Materia prima insuficiente para esta cantidad');
          return;
        }
      }
    }

    setCart((prevCart) =>
      prevCart.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity } : item
      )
    );
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Calculate delivery charge
  const isDeliveryFree =
    freeDeliveryThreshold > 0 && subtotal >= freeDeliveryThreshold;
  const currentDeliveryCharge =
    orderType === 'delivery' && !isDeliveryFree ? deliveryChargeAmount : 0;
  const total = subtotal + currentDeliveryCharge;

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
    items: Array<{
      product_id: string;
      product_name: string;
      product_price: number;
      production_cost: number;
      quantity: number;
      removedIngredients: string[];
      category: string;
      combo_name?: string;
    }>,
    total: number,
    scheduledTimeISO?: string,
    customerNameParam?: string,
    orderTypeParam?: 'pickup' | 'delivery',
    deliveryAddressParam?: string
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
            removed_ingredients: item.removedIngredients || [],
            combo_name: item.combo_name || null,
            category: item.category || 'otros',
          })),
          total,
          payment_method: paymentMethod,
          scheduled_time: scheduledTimeISO,
          customer_name: customerNameParam || null,
          order_type: orderTypeParam || null,
          delivery_address:
            orderTypeParam === 'delivery' ? deliveryAddressParam || null : null,
          created_at: new Date().toISOString(),
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
    // Read settings directly from IndexedDB to ensure we have the latest
    await db.init();
    const settings = await db.get<AppSettings>('app_settings', 'default');

    const effectiveKdsEnabled = settings?.kds_enabled || false;
    const effectiveKdsUrl = settings?.kds_url || '';

    if (!effectiveKdsEnabled || !effectiveKdsUrl) {
      console.log('fetchKdsOrders: skipped (disabled or no URL)', {
        kdsEnabled: effectiveKdsEnabled,
        kdsUrl: effectiveKdsUrl,
      });
      return;
    }

    console.log('fetchKdsOrders: fetching from', effectiveKdsUrl);

    try {
      // Fetch pending and on_delivery orders
      const response = await fetch(
        `${effectiveKdsUrl}/api/orders?status=pending,on_delivery`
      );
      if (response.ok) {
        const data = await response.json();
        const orders: KDSOrder[] = (data.orders || []).filter(
          (order: KDSOrder) =>
            order.status === 'pending' || order.status === 'on_delivery'
        );

        // Check for newly completed orders
        orders.forEach((order) => {
          if (
            order.status === 'completed' &&
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

        // Sort orders:
        // 1. Orders without scheduled time first (sorted by created_at)
        // 2. Orders with scheduled time (sorted by scheduled_time)
        const sortedOrders = [...orders].sort((a, b) => {
          const aHasTime = !!a.scheduled_time;
          const bHasTime = !!b.scheduled_time;

          // No time first
          if (!aHasTime && bHasTime) return -1;
          if (aHasTime && !bHasTime) return 1;

          // Both have no time - sort by created_at
          if (!aHasTime && !bHasTime) {
            return (
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
            );
          }

          // Both have time - sort by scheduled_time
          return (
            new Date(a.scheduled_time!).getTime() -
            new Date(b.scheduled_time!).getTime()
          );
        });

        setKdsOrders(sortedOrders);
        console.log('fetchKdsOrders: received', sortedOrders.length, 'orders');
      } else {
        console.error(
          'fetchKdsOrders: request failed',
          response.status,
          response.statusText
        );
        toast.error(`Error al cargar pedidos: ${response.status}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('Error fetching KDS orders:', errorMessage, error);
      toast.error(`Error de conexión con KDS: ${errorMessage}`);
    }
  }, []);

  // WebSocket connection for real-time KDS updates
  const connectKdsWebSocket = useCallback(async () => {
    // Read settings directly from IndexedDB
    await db.init();
    const settings = await db.get<AppSettings>('app_settings', 'default');

    const effectiveKdsEnabled = settings?.kds_enabled || false;
    const effectiveKdsUrl = settings?.kds_url || '';

    if (!effectiveKdsEnabled || !effectiveKdsUrl) {
      console.log('KDS WebSocket: disabled or no URL', {
        kdsEnabled: effectiveKdsEnabled,
        kdsUrl: effectiveKdsUrl,
      });
      return;
    }

    // Close existing connection if any
    if (kdsWsRef.current) {
      kdsWsRef.current.close();
    }

    // Convert HTTP URL to WebSocket URL
    const wsUrl = effectiveKdsUrl.replace(/^http/, 'ws');
    console.log('KDS WebSocket: connecting to', wsUrl);
    setKdsConnectionStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('KDS WebSocket connected');
        setKdsConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'new_order') {
            // Add new order if it's pending or on_delivery
            if (
              data.order.status === 'pending' ||
              data.order.status === 'on_delivery'
            ) {
              setKdsOrders((prev) => {
                // Avoid duplicates
                if (prev.some((o) => o.id === data.order.id)) {
                  return prev;
                }
                const newOrders = [data.order, ...prev];
                // Sort orders
                return newOrders.sort((a, b) => {
                  const aHasTime = !!a.scheduled_time;
                  const bHasTime = !!b.scheduled_time;
                  if (!aHasTime && bHasTime) return -1;
                  if (aHasTime && !bHasTime) return 1;
                  if (!aHasTime && !bHasTime) {
                    return (
                      new Date(a.created_at).getTime() -
                      new Date(b.created_at).getTime()
                    );
                  }
                  return (
                    new Date(a.scheduled_time!).getTime() -
                    new Date(b.scheduled_time!).getTime()
                  );
                });
              });
            }
          } else if (data.type === 'order_updated') {
            // Update order status
            setKdsOrders((prev) => {
              if (data.status === 'completed') {
                // Remove completed orders after brief delay
                setTimeout(() => {
                  setKdsOrders((p) => p.filter((o) => o.id !== data.orderId));
                }, 500);
              }
              return prev.map((order) =>
                order.id === data.orderId
                  ? { ...order, status: data.status }
                  : order
              );
            });
          } else if (data.type === 'order_full_update') {
            // Full order update (items, scheduled_time, etc.)
            setKdsOrders((prev) =>
              prev.map((order) =>
                order.id === data.order.id ? data.order : order
              )
            );
          } else if (data.type === 'order_deleted') {
            // Remove deleted order
            setKdsOrders((prev) =>
              prev.filter((order) => order.id !== data.orderId)
            );
          }
        } catch (error) {
          console.error('Error parsing KDS WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('KDS WebSocket disconnected');
        kdsWsRef.current = null;
        setKdsConnectionStatus('disconnected');
        // Attempt to reconnect after 3 seconds if panel is still open
        if (showKdsPanel) {
          kdsWsReconnectRef.current = setTimeout(() => {
            connectKdsWebSocket();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('KDS WebSocket error:', error);
        setKdsConnectionStatus('error');
      };

      kdsWsRef.current = ws;
    } catch (error) {
      console.error('Error creating KDS WebSocket:', error);
    }
  }, [showKdsPanel]);

  const updateKdsOrderStatus = async (
    orderId: string,
    status: 'pending' | 'preparing' | 'on_delivery' | 'completed'
  ) => {
    if (!kdsUrl) return;

    try {
      const response = await fetch(`${kdsUrl}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        // Find the KDS order to get sale_number and order_type
        const kdsOrder = kdsOrders.find((o) => o.id === orderId);

        if (status === 'completed') {
          finishedOrdersRef.current.add(orderId);
          // Auto-remove after 2 seconds
          setTimeout(() => {
            setKdsOrders((prev) => prev.filter((o) => o.id !== orderId));
            finishedOrdersRef.current.delete(orderId);
          }, 2000);

          // If this is a delivery order, update the local Sale with delivered_at
          if (kdsOrder && kdsOrder.order_type === 'delivery') {
            try {
              // Find the sale by sale_number
              const allSales = sales;
              const matchingSale = allSales.find(
                (s) => s.sale_number === kdsOrder.sale_number
              );
              if (matchingSale) {
                await updateSale(matchingSale.id, {
                  delivered_at: new Date().toISOString(),
                });
              }
            } catch (error) {
              console.error('Error updating sale delivered_at:', error);
            }
          }
        }
        // Update local state immediately
        setKdsOrders((prev) =>
          prev.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  status,
                  finished_at:
                    status === 'completed'
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

  // Toggle ingredient for a KDS order item inline
  const toggleKdsOrderIngredient = async (
    orderId: string,
    itemIndex: number,
    ingredientName: string
  ) => {
    if (!kdsUrl) return;

    const order = kdsOrders.find((o) => o.id === orderId);
    if (!order) return;

    const item = order.items[itemIndex];
    if (!item) return;

    const currentRemoved = item.removed_ingredients || [];
    const newRemoved = currentRemoved.includes(ingredientName)
      ? currentRemoved.filter((i) => i !== ingredientName)
      : [...currentRemoved, ingredientName];

    // Update locally first for immediate feedback
    const newItems = [...order.items];
    newItems[itemIndex] = { ...item, removed_ingredients: newRemoved };

    setKdsOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, items: newItems } : o))
    );

    try {
      const response = await fetch(`${kdsUrl}/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: newItems,
          total: order.total,
        }),
      });

      if (!response.ok) {
        // Revert on failure
        setKdsOrders((prev) => prev.map((o) => (o.id === orderId ? order : o)));
        toast.error('Error al actualizar ingredientes');
      }
    } catch (error) {
      // Revert on error
      setKdsOrders((prev) => prev.map((o) => (o.id === orderId ? order : o)));
      console.error('Error updating KDS order ingredients:', error);
      toast.error('Error al actualizar ingredientes');
    }
  };

  // Update KDS order address
  const updateKdsOrderAddress = async (orderId: string, newAddress: string) => {
    if (!kdsUrl) return;

    const order = kdsOrders.find((o) => o.id === orderId);
    if (!order) return;

    // Update locally first for immediate feedback
    setKdsOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, delivery_address: newAddress } : o
      )
    );

    try {
      const response = await fetch(`${kdsUrl}/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_address: newAddress,
        }),
      });

      if (!response.ok) {
        // Revert on failure
        setKdsOrders((prev) => prev.map((o) => (o.id === orderId ? order : o)));
        toast.error('Error al actualizar dirección');
      } else {
        toast.success('Dirección actualizada');
        setKdsEditingAddress(null);
      }
    } catch (error) {
      // Revert on error
      setKdsOrders((prev) => prev.map((o) => (o.id === orderId ? order : o)));
      console.error('Error updating KDS order address:', error);
      toast.error('Error al actualizar dirección');
    }
  };

  const loadOrderForEdit = async (order: KDSOrder) => {
    try {
      // Deep copy items for editing
      const items = order.items.map((item) => ({
        ...item,
        removed_ingredients: [...(item.removed_ingredients || [])],
      }));

      setEditingKdsOrder(order);
      setEditModalItems(items);

      // Set scheduled time if exists
      if (order.scheduled_time) {
        const scheduledDate = new Date(order.scheduled_time);
        const hours = scheduledDate.getHours().toString().padStart(2, '0');
        const minutes = scheduledDate.getMinutes().toString().padStart(2, '0');
        setEditScheduledTime(`${hours}:${minutes}`);
      } else {
        setEditScheduledTime('');
      }

      // Set customer name, order type, and delivery address
      setEditCustomerName(order.customer_name || '');
      setEditOrderType(order.order_type || 'pickup');
      setEditDeliveryAddress(order.delivery_address || '');

      // Open edit modal
      setShowEditModal(true);
    } catch (error) {
      console.error('Error loading order for edit:', error);
      toast.error('Error al cargar el pedido');
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingKdsOrder(null);
    setEditModalItems([]);
    setEditScheduledTime('');
    setEditCustomerName('');
    setEditOrderType('pickup');
    setEditDeliveryAddress('');
  };

  const updateEditItemQuantity = (index: number, delta: number) => {
    setEditModalItems((prev) => {
      const newItems = [...prev];
      const newQty = newItems[index].quantity + delta;
      if (newQty < 1) {
        // Remove item if quantity goes below 1
        newItems.splice(index, 1);
      } else {
        newItems[index] = { ...newItems[index], quantity: newQty };
      }
      return newItems;
    });
  };

  const saveOrderEdit = async () => {
    if (!editingKdsOrder || !kdsUrl) return;

    try {
      // Calculate new total
      const newTotal = editModalItems.reduce(
        (sum, item) => sum + item.product_price * item.quantity,
        0
      );

      // Convert scheduled time to ISO if set
      let scheduledTimeISO: string | null = null;
      if (editScheduledTime) {
        const today = new Date();
        const [hours, minutes] = editScheduledTime.split(':').map(Number);
        today.setHours(hours, minutes, 0, 0);
        // If the time is in the past, assume it's for tomorrow
        if (today < new Date()) {
          today.setDate(today.getDate() + 1);
        }
        scheduledTimeISO = today.toISOString();
      }

      const response = await fetch(
        `${kdsUrl}/api/orders/${editingKdsOrder.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: editModalItems,
            total: newTotal,
            scheduled_time: scheduledTimeISO,
            customer_name: editCustomerName || null,
            order_type: editOrderType,
            delivery_address:
              editOrderType === 'delivery' ? editDeliveryAddress || null : null,
          }),
        }
      );

      if (response.ok) {
        toast.success(`Pedido #${editingKdsOrder.sale_number} actualizado`);
        closeEditModal();
        // Refresh KDS orders
        fetchKdsOrders();
      } else {
        throw new Error('Failed to update order');
      }
    } catch (error) {
      console.error('Error saving order edit:', error);
      toast.error('Error al guardar los cambios');
    }
  };

  // Get available ingredients for a product by name (for edit modal)
  const getRemovableIngredientsForProduct = (productName: string): string[] => {
    return productRemovableIngredients[productName] || [];
  };

  // Open ingredient sub-modal for an item in the edit modal
  const openEditIngredientModal = (itemIndex: number) => {
    const item = editModalItems[itemIndex];
    const removableIngredients = getRemovableIngredientsForProduct(
      item.product_name
    );

    if (removableIngredients.length === 0) {
      toast.info('Este producto no tiene ingredientes removibles');
      return;
    }

    const ingredientsList = removableIngredients.map((name) => ({
      name,
      removed: (item.removed_ingredients || []).includes(name),
    }));

    setEditIngredientItemIndex(itemIndex);
    setEditIngredientsList(ingredientsList);
  };

  // Toggle ingredient in the sub-modal
  const toggleEditIngredient = (ingredientName: string) => {
    setEditIngredientsList((prev) =>
      prev.map((ing) =>
        ing.name === ingredientName ? { ...ing, removed: !ing.removed } : ing
      )
    );
  };

  // Confirm ingredient changes and close sub-modal
  const confirmEditIngredients = () => {
    if (editIngredientItemIndex === null) return;

    const removedIngredients = editIngredientsList
      .filter((ing) => ing.removed)
      .map((ing) => ing.name);

    setEditModalItems((prev) => {
      const newItems = [...prev];
      newItems[editIngredientItemIndex] = {
        ...newItems[editIngredientItemIndex],
        removed_ingredients: removedIngredients,
      };
      return newItems;
    });

    setEditIngredientItemIndex(null);
    setEditIngredientsList([]);
  };

  // Cancel ingredient editing sub-modal
  const cancelEditIngredients = () => {
    setEditIngredientItemIndex(null);
    setEditIngredientsList([]);
  };

  const cancelEdit = () => {
    setEditingOrderId(null);
    setCart([]);
    setScheduledTime('');
    setCustomerName('');
    setOrderType('pickup');
    setDeliveryAddress('');
    setCashReceived(0);
    setChangeBreakdown(null);
    setBillHistory([]);
    setPaymentMethod('cash');
    setShowPayment(false);
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
      // Build items array, expanding combos into individual products
      const items: {
        product_id: string;
        product_name: string;
        product_price: number;
        production_cost: number;
        quantity: number;
        removedIngredients: string[];
        category: string;
        combo_name?: string;
        combo_instance_id?: string;
        combo_slot_index?: number;
        combo_unit_price?: number;
      }[] = [];

      for (const cartItem of cart) {
        if (cartItem.isCombo && cartItem.comboSelections) {
          // Expand combo into individual products for each quantity
          for (let q = 0; q < cartItem.quantity; q++) {
            // Generate unique instance ID for this combo instance
            const comboInstanceId = `${cartItem.cartItemId}-${q}`;
            for (
              let selIndex = 0;
              selIndex < cartItem.comboSelections.length;
              selIndex++
            ) {
              const selection = cartItem.comboSelections[selIndex];
              const comboProduct = products.find(
                (p) => p.id === selection.productId
              );
              items.push({
                product_id: selection.productId,
                product_name: selection.productName,
                product_price: selection.productPrice,
                production_cost: comboProduct?.production_cost || 0,
                quantity: 1,
                removedIngredients: selection.removedIngredients || [],
                category: comboProduct?.category || 'otros',
                combo_name: cartItem.comboName,
                combo_instance_id: comboInstanceId,
                combo_slot_index: selIndex,
                combo_unit_price: cartItem.price, // Store actual combo price
              });
            }
          }
        } else {
          // Regular product
          items.push({
            product_id: cartItem.id,
            product_name: cartItem.name,
            product_price: cartItem.price,
            production_cost: cartItem.production_cost,
            quantity: cartItem.quantity,
            removedIngredients: cartItem.removedIngredients || [],
            category: cartItem.category,
          });
        }
      }

      let billsChangeData: Record<number, number> | undefined;

      if (paymentMethod === 'cash' && changeBreakdown) {
        billsChangeData = {};
        changeBreakdown.forEach((b) => {
          billsChangeData![b.bill_value] = b.quantity;
        });
      }

      // Convert scheduled time to ISO format if set
      let scheduledTimeISO: string | undefined;
      if (scheduledTime) {
        const today = new Date();
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        today.setHours(hours, minutes, 0, 0);
        // If the time is in the past, assume it's for tomorrow
        if (today < new Date()) {
          today.setDate(today.getDate() + 1);
        }
        scheduledTimeISO = today.toISOString();
      }

      const saleData = await createSale(
        items,
        paymentMethod,
        paymentMethod === 'cash' ? cashReceived : undefined,
        undefined,
        billsChangeData,
        scheduledTimeISO,
        customerName || undefined,
        orderType,
        orderType === 'delivery' ? deliveryAddress || undefined : undefined,
        currentDeliveryCharge > 0 ? currentDeliveryCharge : undefined
      );

      // Aggregate all stock deductions before applying
      const productStockDeductions = new Map<string, number>();
      const materiaPrimaDeductions = new Map<string, number>();

      // Helper to aggregate materia prima deductions for a product
      const aggregateMateriaPrimaForProduct = async (
        productId: string,
        quantity: number,
        removedIngredients?: string[]
      ) => {
        const links = await getProductMateriaPrima(productId);
        for (const link of links) {
          // Skip if this ingredient was removed
          if (removedIngredients && removedIngredients.length > 0) {
            const mp = materiaPrima.find((m) => m.id === link.materia_prima_id);
            if (mp && removedIngredients.includes(mp.name)) {
              continue;
            }
          }
          const current =
            materiaPrimaDeductions.get(link.materia_prima_id) || 0;
          materiaPrimaDeductions.set(
            link.materia_prima_id,
            current + link.quantity * quantity
          );
        }
      };

      // Process regular cart items
      for (const item of cart) {
        if (item.isCombo) continue;

        if (item.uses_materia_prima) {
          await aggregateMateriaPrimaForProduct(
            item.id,
            item.quantity,
            item.removedIngredients
          );
        } else {
          const current = productStockDeductions.get(item.id) || 0;
          productStockDeductions.set(item.id, current + item.quantity);
        }
      }

      // Process combo items
      const comboItems = cart.filter(
        (item) => item.isCombo && item.comboSelections
      );

      for (const comboItem of comboItems) {
        for (const selection of comboItem.comboSelections!) {
          const product = products.find((p) => p.id === selection.productId);
          if (!product) continue;

          if (product.uses_materia_prima) {
            await aggregateMateriaPrimaForProduct(
              selection.productId,
              comboItem.quantity,
              selection.removedIngredients || []
            );
          } else {
            const current =
              productStockDeductions.get(selection.productId) || 0;
            productStockDeductions.set(
              selection.productId,
              current + comboItem.quantity
            );
          }
        }
      }

      // Apply all product stock deductions
      for (const [productId, quantity] of productStockDeductions) {
        await updateStock(productId, -quantity);
      }

      // Apply all materia prima deductions
      for (const [mpId, quantity] of materiaPrimaDeductions) {
        const mp = await db.get<MateriaPrima>('materia_prima', mpId);
        if (mp) {
          const newStock = mp.stock - quantity;
          if (newStock >= 0) {
            await db.put('materia_prima', {
              ...mp,
              stock: newStock,
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

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
        await sendToKDS(
          saleData.sale_number,
          items,
          total,
          scheduledTimeISO,
          customerName || undefined,
          orderType,
          deliveryAddress || undefined
        );
        // Sync theme to KDS with each sale to ensure KDS has latest theme
        await syncThemeToKDS();
      }

      await refreshProducts();
      await refreshMateriaPrima();
      // No need to call loadStocks here: it will run after products change via the effect.

      // If editing, mark the old KDS order as completed
      if (editingOrderId) {
        await updateKdsOrderStatus(editingOrderId, 'completed');
        setEditingOrderId(null);
      }

      setCart([]);
      setCashReceived(0);
      setChangeBreakdown(null);
      setShowPayment(false);
      setPaymentMethod('cash');
      setBillHistory([]);
      setScheduledTime('');
      setCustomerName('');
      setOrderType('pickup');
      setDeliveryAddress('');
      setNextSaleNumber((prev) => (prev !== null ? prev + 1 : prev));

      toast.success(
        editingOrderId ? '¡Pedido actualizado!' : '¡Venta completada!'
      );
    } catch (error) {
      console.error('Error completing sale:', error);
      toast.error('Error al completar la venta');
    } finally {
      setProcessing(false);
    }
  };

  // Send order without payment
  const sendUnpaid = async () => {
    if (cart.length === 0) return;

    setProcessing(true);
    try {
      // Build items array, expanding combos into individual products
      const items: {
        product_id: string;
        product_name: string;
        product_price: number;
        production_cost: number;
        quantity: number;
        removedIngredients: string[];
        category: string;
        combo_name?: string;
        combo_instance_id?: string;
        combo_slot_index?: number;
        combo_unit_price?: number;
      }[] = [];

      for (const cartItem of cart) {
        if (cartItem.isCombo && cartItem.comboSelections) {
          for (let q = 0; q < cartItem.quantity; q++) {
            const comboInstanceId = `${cartItem.cartItemId}-${q}`;
            for (
              let selIndex = 0;
              selIndex < cartItem.comboSelections.length;
              selIndex++
            ) {
              const selection = cartItem.comboSelections[selIndex];
              const comboProduct = products.find(
                (p) => p.id === selection.productId
              );
              items.push({
                product_id: selection.productId,
                product_name: selection.productName,
                product_price: selection.productPrice,
                production_cost: comboProduct?.production_cost || 0,
                quantity: 1,
                removedIngredients: selection.removedIngredients || [],
                category: comboProduct?.category || 'otros',
                combo_name: cartItem.comboName,
                combo_instance_id: comboInstanceId,
                combo_slot_index: selIndex,
                combo_unit_price: cartItem.price, // Store actual combo price
              });
            }
          }
        } else {
          items.push({
            product_id: cartItem.id,
            product_name: cartItem.name,
            product_price: cartItem.price,
            production_cost: cartItem.production_cost,
            quantity: cartItem.quantity,
            removedIngredients: cartItem.removedIngredients || [],
            category: cartItem.category,
          });
        }
      }

      // Convert scheduled time to ISO format if set
      let scheduledTimeISO: string | undefined;
      if (scheduledTime) {
        const today = new Date();
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        today.setHours(hours, minutes, 0, 0);
        if (today < new Date()) {
          today.setDate(today.getDate() + 1);
        }
        scheduledTimeISO = today.toISOString();
      }

      const saleData = await createSale(
        items,
        'unpaid',
        undefined,
        undefined,
        undefined,
        scheduledTimeISO,
        customerName || undefined,
        orderType,
        orderType === 'delivery' ? deliveryAddress || undefined : undefined,
        currentDeliveryCharge > 0 ? currentDeliveryCharge : undefined
      );

      // Aggregate all stock deductions before applying
      const productStockDeductions = new Map<string, number>();
      const materiaPrimaDeductions = new Map<string, number>();

      // Helper to aggregate materia prima deductions for a product
      const aggregateMateriaPrimaForProduct = async (
        productId: string,
        quantity: number,
        removedIngredients?: string[]
      ) => {
        const links = await getProductMateriaPrima(productId);
        for (const link of links) {
          // Skip if this ingredient was removed
          if (removedIngredients && removedIngredients.length > 0) {
            const mp = materiaPrima.find((m) => m.id === link.materia_prima_id);
            if (mp && removedIngredients.includes(mp.name)) {
              continue;
            }
          }
          const current =
            materiaPrimaDeductions.get(link.materia_prima_id) || 0;
          materiaPrimaDeductions.set(
            link.materia_prima_id,
            current + link.quantity * quantity
          );
        }
      };

      // Process regular cart items
      for (const item of cart) {
        if (item.isCombo) continue;

        if (item.uses_materia_prima) {
          await aggregateMateriaPrimaForProduct(
            item.id,
            item.quantity,
            item.removedIngredients
          );
        } else {
          const current = productStockDeductions.get(item.id) || 0;
          productStockDeductions.set(item.id, current + item.quantity);
        }
      }

      // Process combo items
      const comboItems = cart.filter(
        (item) => item.isCombo && item.comboSelections
      );

      for (const comboItem of comboItems) {
        for (const selection of comboItem.comboSelections!) {
          const product = products.find((p) => p.id === selection.productId);
          if (!product) continue;

          if (product.uses_materia_prima) {
            await aggregateMateriaPrimaForProduct(
              selection.productId,
              comboItem.quantity,
              selection.removedIngredients || []
            );
          } else {
            const current =
              productStockDeductions.get(selection.productId) || 0;
            productStockDeductions.set(
              selection.productId,
              current + comboItem.quantity
            );
          }
        }
      }

      // Apply all product stock deductions
      for (const [productId, quantity] of productStockDeductions) {
        await updateStock(productId, -quantity);
      }

      // Apply all materia prima deductions
      for (const [mpId, quantity] of materiaPrimaDeductions) {
        const mp = await db.get<MateriaPrima>('materia_prima', mpId);
        if (mp) {
          const newStock = mp.stock - quantity;
          if (newStock >= 0) {
            await db.put('materia_prima', {
              ...mp,
              stock: newStock,
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

      // Send to KDS if enabled
      if (saleData) {
        await sendToKDS(
          saleData.sale_number,
          items,
          total,
          scheduledTimeISO,
          customerName,
          orderType,
          deliveryAddress
        );
      }

      // Reset state
      setCart([]);
      setCashReceived(0);
      setChangeBreakdown(null);
      setShowPayment(false);
      setPaymentMethod('cash');
      setBillHistory([]);
      setScheduledTime('');
      setCustomerName('');
      setOrderType('pickup');
      setDeliveryAddress('');
      setNextSaleNumber((prev) => (prev !== null ? prev + 1 : prev));

      await refreshProducts();
      await refreshMateriaPrima();

      toast.success('¡Pedido enviado sin pago!');
    } catch (error) {
      console.error('Error sending unpaid order:', error);
      toast.error('Error al enviar el pedido');
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

  // KDS Mark as Paid functions
  const kdsMarkChange = useMemo(() => {
    if (!kdsMarkingPaid) return 0;
    const sale = kdsUnpaidSales[kdsMarkingPaid];
    if (!sale) return 0;
    return kdsMarkCashReceived - sale.total_amount;
  }, [kdsMarkingPaid, kdsMarkCashReceived, kdsUnpaidSales]);

  const kdsMarkChangeBreakdown = useMemo(() => {
    if (kdsMarkChange <= 0) return null;
    let remaining = kdsMarkChange;
    const breakdown: { bill_value: number; quantity: number }[] = [];
    for (const denom of BILLS.slice().reverse()) {
      if (remaining >= denom) {
        const count = Math.floor(remaining / denom);
        breakdown.push({ bill_value: denom, quantity: count });
        remaining = remaining % denom;
      }
    }
    if (remaining > 0) return null;
    return breakdown;
  }, [kdsMarkChange]);

  const addKdsMarkCash = (amount: number) => {
    setKdsMarkCashReceived((prev) => prev + amount);
    setKdsMarkBillHistory((prev) => [...prev, amount]);
  };

  const undoLastKdsMarkBill = () => {
    if (kdsMarkBillHistory.length > 0) {
      const lastBill = kdsMarkBillHistory[kdsMarkBillHistory.length - 1];
      setKdsMarkCashReceived((prev) => prev - lastBill);
      setKdsMarkBillHistory((prev) => prev.slice(0, -1));
    }
  };

  const resetKdsMarkCash = () => {
    setKdsMarkCashReceived(0);
    setKdsMarkBillHistory([]);
  };

  const openKdsMarkPaidModal = (saleNumber: string) => {
    setKdsMarkingPaid(saleNumber);
    setKdsMarkPaymentMethod('cash');
    setKdsMarkCashReceived(0);
    setKdsMarkBillHistory([]);
  };

  const closeKdsMarkPaidModal = () => {
    setKdsMarkingPaid(null);
    setKdsMarkPaymentMethod('cash');
    setKdsMarkCashReceived(0);
    setKdsMarkBillHistory([]);
  };

  const canKdsMarkAsPaid = () => {
    if (!kdsMarkingPaid) return false;
    const sale = kdsUnpaidSales[kdsMarkingPaid];
    if (!sale) return false;
    if (kdsMarkPaymentMethod !== 'cash') return true;
    if (kdsMarkCashReceived < sale.total_amount) return false;
    if (kdsMarkChange > 0 && !kdsMarkChangeBreakdown) return false;
    return true;
  };

  const handleKdsMarkAsPaid = async () => {
    if (!kdsMarkingPaid || !canKdsMarkAsPaid()) return;

    const sale = kdsUnpaidSales[kdsMarkingPaid];
    if (!sale) return;

    try {
      const updates: Partial<Sale> = {
        payment_method: kdsMarkPaymentMethod,
      };

      if (kdsMarkPaymentMethod === 'cash') {
        updates.cash_received = kdsMarkCashReceived;
        updates.change_given = kdsMarkChange;
        if (kdsMarkChangeBreakdown) {
          const billsChange: Record<string, number> = {};
          kdsMarkChangeBreakdown.forEach((b) => {
            billsChange[b.bill_value.toString()] = b.quantity;
          });
          updates.bills_change = billsChange;
        }
        const billsReceived: Record<string, number> = {};
        kdsMarkBillHistory.forEach((bill) => {
          billsReceived[bill.toString()] =
            (billsReceived[bill.toString()] || 0) + 1;
        });
        updates.bills_received = billsReceived;
      }

      await updateSale(sale.id, updates);

      // Update local tracking
      setKdsUnpaidSales((prev) => {
        const newState = { ...prev };
        delete newState[kdsMarkingPaid];
        return newState;
      });

      closeKdsMarkPaidModal();
      toast.success('¡Pago registrado correctamente!');
    } catch (error) {
      console.error('Error marking sale as paid:', error);
      toast.error('Error al registrar el pago');
    }
  };

  // Load unpaid sales for KDS orders
  useEffect(() => {
    if (showKdsPanel && kdsOrders.length > 0) {
      const saleNumbers = kdsOrders.map((o) => o.sale_number);
      const unpaidMap: Record<string, Sale> = {};
      sales.forEach((sale) => {
        if (
          saleNumbers.includes(sale.sale_number) &&
          sale.payment_method === 'unpaid'
        ) {
          unpaidMap[sale.sale_number] = sale;
        }
      });
      setKdsUnpaidSales(unpaidMap);
    }
  }, [showKdsPanel, kdsOrders, sales]);

  const canComplete = () => {
    if (cart.length === 0) return false;
    // Check for valid scheduled time if set
    if (scheduledTime && !isValidTime(scheduledTime)) return false;
    if (
      paymentMethod === 'online' ||
      paymentMethod === 'card' ||
      paymentMethod === 'on_delivery' ||
      paymentMethod === 'unpaid'
    )
      return true;
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
    } else if (activeData?.type === 'combo' && overData?.type === 'combo') {
      const activeComboId = (active.id as string).replace('combo-', '');
      const overComboId = (over.id as string).replace('combo-', '');

      const oldIndex = sortedCombos.findIndex((c) => c.id === activeComboId);
      const newIndex = sortedCombos.findIndex((c) => c.id === overComboId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newSortedCombos = arrayMove(sortedCombos, oldIndex, newIndex);
        setSortedCombos(newSortedCombos);

        // Save combo order to database (batch update)
        try {
          const orderUpdates = newSortedCombos.map((combo, index) => ({
            id: combo.id,
            display_order: index,
          }));
          await updateCombosOrder(orderUpdates);
        } catch (error) {
          console.error('Error saving combo order:', error);
        }
      }
    }
  };

  const activeProduct =
    activeId &&
    !activeId.toString().startsWith('category-') &&
    !activeId.toString().startsWith('combo-')
      ? sortedProducts.find((p) => p.id === activeId)
      : null;

  const activeCategory =
    activeId && activeId.toString().startsWith('category-')
      ? activeId.toString().replace('category-', '')
      : null;

  const activeCombo =
    activeId && activeId.toString().startsWith('combo-')
      ? sortedCombos.find(
          (c) => c.id === activeId.toString().replace('combo-', '')
        )
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

  // Sync sorted combos with active combos (sorted by display_order)
  useEffect(() => {
    const active = combos.filter((c) => c.active);
    const sorted = [...active].sort((a, b) => {
      const orderA = a.display_order ?? 999999;
      const orderB = b.display_order ?? 999999;
      return orderA - orderB;
    });
    setSortedCombos(sorted);
  }, [combos]);

  // Load products with removable ingredients
  useEffect(() => {
    const loadRemovableIngredients = async () => {
      const productsWithRemovable = new Set<string>();
      const removableByName: Record<string, string[]> = {};

      for (const product of products) {
        if (product.uses_materia_prima) {
          const productMPs = await getProductMateriaPrima(product.id);
          const removableIngredients: string[] = [];

          for (const mp of productMPs) {
            if (mp.removable) {
              const mpData = materiaPrima.find(
                (m) => m.id === mp.materia_prima_id
              );
              if (mpData) {
                removableIngredients.push(mpData.name);
              }
            }
          }

          if (removableIngredients.length > 0) {
            productsWithRemovable.add(product.id);
            removableByName[product.name] = removableIngredients;
          }
        }
      }

      setProductsWithRemovableIngredients(productsWithRemovable);
      setProductRemovableIngredients(removableByName);
    };

    loadRemovableIngredients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, materiaPrima]);

  // Calculate combo stock availability
  useEffect(() => {
    const calculateComboStock = async () => {
      const stockStatus: Record<string, boolean> = {};

      for (const combo of activeCombos) {
        let comboHasStock = true;

        // Check each slot - a combo is out of stock if any slot has no available products
        for (const slot of combo.slots) {
          // Get products for this slot (use product_ids for both dynamic and fixed slots)
          const slotProductIds = slot.product_ids || [];

          // Check if at least one product in this slot has stock
          let slotHasAvailableProduct = false;
          for (const productId of slotProductIds) {
            const product = products.find((p) => p.id === productId);
            if (!product || !product.active) continue;

            const stock = product.uses_materia_prima
              ? productStocks[productId] || 0
              : product.stock;

            if (stock > 0) {
              slotHasAvailableProduct = true;
              break;
            }
          }

          // If no product has stock in this slot, combo is out of stock
          if (!slotHasAvailableProduct && slotProductIds.length > 0) {
            comboHasStock = false;
            break;
          }
        }

        stockStatus[combo.id] = comboHasStock;
      }

      setComboStockStatus(stockStatus);
    };

    calculateComboStock();
  }, [activeCombos, products, productStocks]);

  // KDS WebSocket and polling when panel is open
  useEffect(() => {
    if (showKdsPanel) {
      // Initial fetch - functions check settings from IndexedDB
      fetchKdsOrders();

      // Connect WebSocket for real-time updates
      connectKdsWebSocket();

      // Keep polling as fallback (reduced frequency since we have WebSocket)
      kdsPollingRef.current = setInterval(fetchKdsOrders, 10000);
    }

    return () => {
      // Clean up polling
      if (kdsPollingRef.current) {
        clearInterval(kdsPollingRef.current);
        kdsPollingRef.current = null;
      }

      // Clean up WebSocket
      if (kdsWsRef.current) {
        kdsWsRef.current.close();
        kdsWsRef.current = null;
      }

      // Clean up reconnect timeout
      if (kdsWsReconnectRef.current) {
        clearTimeout(kdsWsReconnectRef.current);
        kdsWsReconnectRef.current = null;
      }
    };
  }, [showKdsPanel, fetchKdsOrders, connectKdsWebSocket]);

  // Focus address input when editing modal opens
  useEffect(() => {
    if (kdsEditingAddress && kdsAddressInputRef.current) {
      kdsAddressInputRef.current.focus();
    }
  }, [kdsEditingAddress]);

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
        <div className='flex-1 overflow-auto scrollbar-hide relative'>
          {/* Sticky Category Filter Bar */}
          <div
            className='sticky top-0 z-20 px-6 py-3 flex items-center justify-between gap-4'
            style={{ backgroundColor: 'var(--color-background)' }}
          >
            {/* Category Tabs */}
            <div className='flex gap-2 overflow-x-auto scrollbar-hide flex-1'>
              <button
                onClick={() => setSelectedCategory(null)}
                className='px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all'
                style={{
                  backgroundColor:
                    selectedCategory === null
                      ? 'var(--color-accent)'
                      : 'var(--color-background-secondary)',
                  color:
                    selectedCategory === null
                      ? 'var(--color-on-accent)'
                      : 'var(--color-text)',
                }}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className='px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all capitalize'
                  style={{
                    backgroundColor:
                      selectedCategory === cat
                        ? 'var(--color-accent)'
                        : 'var(--color-background-secondary)',
                    color:
                      selectedCategory === cat
                        ? 'var(--color-on-accent)'
                        : 'var(--color-text)',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className='flex items-center gap-2 shrink-0'>
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
          </div>

          <div className='p-6 pt-0'>
            <SortableContext
              items={categories.map((cat) => `category-${cat}`)}
              disabled={isLayoutLocked}
            >
              {categories
                .filter(
                  (cat) => selectedCategory === null || cat === selectedCategory
                )
                .map((category) => {
                  // Handle combos category specially
                  if (category === 'combos') {
                    const comboIds = sortedCombos.map((c) => `combo-${c.id}`);
                    return (
                      <SortableCategory
                        key='combos'
                        category='combos'
                        isLocked={isLayoutLocked}
                      >
                        <SortableContext
                          items={comboIds}
                          strategy={rectSortingStrategy}
                          disabled={isLayoutLocked}
                        >
                          <div
                            className={`grid gap-4 ${
                              showPayment
                                ? 'grid-cols-1 sm:grid-cols-2'
                                : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-3'
                            }`}
                          >
                            {sortedCombos.map((combo) => (
                              <SortableComboItem
                                key={combo.id}
                                combo={combo}
                                isLocked={isLayoutLocked}
                                onOpenComboModal={openComboModal}
                                isOutOfStock={
                                  comboStockStatus[combo.id] === false
                                }
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </SortableCategory>
                    );
                  }

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
                        <div
                          className={`grid gap-4 ${
                            showPayment
                              ? 'grid-cols-1 sm:grid-cols-2'
                              : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-3'
                          }`}
                        >
                          {categoryProducts.map((product) => (
                            <SortableProductItem
                              key={product.id}
                              product={product}
                              isLocked={isLayoutLocked}
                              onAddToCart={(p) => addToCart(p)}
                              onLongPress={handleProductLongPress}
                              getStock={getProductStock}
                              hasRemovableIngredients={productsWithRemovableIngredients.has(
                                product.id
                              )}
                              isOutOfStock={getProductStock(product) <= 0}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </SortableCategory>
                  );
                })}
            </SortableContext>
          </div>
        </div>

        <div
          className={`shadow-xl p-6 flex flex-col transition-all duration-300 ${
            showPayment ? 'w-[600px]' : 'w-96'
          }`}
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <div className='flex items-center justify-between mb-6'>
            <div
              className='text-sm font-semibold'
              style={{ color: 'var(--color-text)' }}
            >
              {editingOrderId ? (
                <span
                  className='flex items-center gap-2'
                  style={{ color: 'var(--color-accent)' }}
                >
                  <Pencil size={14} />
                  Editando Pedido
                </span>
              ) : (
                <>
                  Venta #
                  {nextSaleNumber !== null
                    ? nextSaleNumber.toLocaleString('es-AR')
                    : '...'}
                </>
              )}
            </div>
            <div className='flex items-center gap-2'>
              {editingOrderId && (
                <button
                  onClick={cancelEdit}
                  className='text-xs px-2 py-1 rounded hover:opacity-80'
                  style={{
                    backgroundColor: 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                  }}
                >
                  Cancelar
                </button>
              )}
              {cart.length > 0 && (
                <button
                  onClick={() => {
                    if (editingOrderId) {
                      cancelEdit();
                    } else {
                      setCart([]);
                      setShowPayment(false);
                      setCashReceived(0);
                      setChangeBreakdown(null);
                      setBillHistory([]);
                      setPaymentMethod('cash');
                      setScheduledTime('');
                      setCustomerName('');
                      setOrderType('pickup');
                      setDeliveryAddress('');
                    }
                  }}
                  className='text-red-500 hover:text-red-700'
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Two-column layout when in payment mode */}
          <div
            className={`flex-1 flex ${
              showPayment ? 'gap-6' : 'flex-col'
            } overflow-hidden`}
          >
            {/* Cart Column */}
            <div
              className={`${
                showPayment ? 'w-2/4 border-r pr-4' : 'flex-1'
              } overflow-auto scrollbar-hide ${showPayment ? '' : 'mb-6'}`}
              style={{
                borderColor: showPayment
                  ? 'var(--color-background-accent)'
                  : 'transparent',
              }}
            >
              {cart.length === 0 ? (
                <div
                  className='text-center opacity-60 mt-12'
                  style={{ color: 'var(--color-text)' }}
                >
                  El carrito está vacío
                </div>
              ) : (
                <div className='space-y-3'>
                  {showPayment && (
                    <div
                      className='text-sm font-semibold mb-3 pb-2 border-b'
                      style={{
                        color: 'var(--color-text)',
                        borderColor: 'var(--color-background-accent)',
                      }}
                    >
                      Resumen del Pedido (
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}{' '}
                      items)
                    </div>
                  )}
                  {cart.map((item) => (
                    <div
                      key={item.cartItemId}
                      className='p-3 rounded-lg'
                      style={{ backgroundColor: 'var(--color-background)' }}
                    >
                      <div className='flex items-center justify-between mb-1'>
                        <div className='flex items-center gap-2'>
                          <div
                            className={`font-semibold ${
                              showPayment ? 'text-sm' : ''
                            }`}
                            style={{ color: 'var(--color-text)' }}
                          >
                            {item.name}
                          </div>
                          {item.isCombo && (
                            <span
                              className='text-xs px-1.5 py-0.5 rounded'
                              style={{
                                backgroundColor: 'var(--color-accent)',
                                color: 'var(--color-on-accent)',
                              }}
                            >
                              COMBO
                            </span>
                          )}
                        </div>
                        {!showPayment && (
                          <button
                            onClick={() => removeFromCart(item.cartItemId)}
                            className='text-red-500'
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                      {/* Combo selections display */}
                      {item.isCombo && item.comboSelections && (
                        <div
                          className='text-xs mb-2 pl-2 border-l-2'
                          style={{
                            borderColor: 'var(--color-accent)',
                            color: 'var(--color-text)',
                            opacity: 0.8,
                          }}
                        >
                          {item.comboSelections.map((sel, idx) => (
                            <div key={idx} className='mb-0.5'>
                              <span className='font-medium'>
                                {sel.slotName}:
                              </span>{' '}
                              {sel.productName}
                              {sel.removedIngredients.length > 0 && (
                                <span
                                  className='italic ml-1'
                                  style={{ color: 'var(--color-primary)' }}
                                >
                                  (sin {sel.removedIngredients.join(', ')})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Regular product removed ingredients */}
                      {!item.isCombo && item.removedIngredients.length > 0 && (
                        <div
                          className='text-xs mb-2 italic'
                          style={{ color: 'var(--color-primary)' }}
                        >
                          Sin: {item.removedIngredients.join(', ')}
                        </div>
                      )}
                      <div className='flex items-center justify-between'>
                        {showPayment ? (
                          <span
                            className='text-sm opacity-70'
                            style={{ color: 'var(--color-text)' }}
                          >
                            x{formatNumber(item.quantity)}
                          </span>
                        ) : (
                          <div className='flex items-center gap-2'>
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.cartItemId,
                                  item.quantity - 1
                                )
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
                                updateQuantity(
                                  item.cartItemId,
                                  item.quantity + 1
                                )
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
                        )}
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

            {/* Payment Column - only visible when showPayment is true */}
            {showPayment && (
              <div className='w-3/4 overflow-auto scrollbar-hide flex flex-col'>
                {/* Subtotal and delivery charge breakdown */}
                {currentDeliveryCharge > 0 && (
                  <div
                    className='mb-2 text-sm'
                    style={{ color: 'var(--color-text)' }}
                  >
                    <div className='flex justify-between'>
                      <span>Subtotal:</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span>Cargo por Delivery:</span>
                      <span>{formatPrice(currentDeliveryCharge)}</span>
                    </div>
                  </div>
                )}
                {orderType === 'delivery' &&
                  isDeliveryFree &&
                  deliveryChargeAmount > 0 && (
                    <div
                      className='mb-2 text-sm flex justify-between'
                      style={{ color: 'var(--color-accent)' }}
                    >
                      <span>Delivery Gratis</span>
                      <span className='line-through opacity-60'>
                        {formatPrice(deliveryChargeAmount)}
                      </span>
                    </div>
                  )}
                <div
                  className='flex justify-between text-xl font-bold mb-4 pb-3 border-b'
                  style={{
                    color: 'var(--color-text)',
                    borderColor: 'var(--color-background-accent)',
                  }}
                >
                  <span>Total:</span>
                  <span style={{ color: 'var(--color-primary)' }}>
                    {formatPrice(total)}
                  </span>
                </div>
                {/* Payment methods inside payment column */}
                <div className='mb-4'>
                  <div
                    className='text-sm mb-2'
                    style={{ color: 'var(--color-text)' }}
                  >
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
                      className='py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm'
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
                      <Banknote size={16} />
                      Efectivo
                    </button>
                    <button
                      onClick={() => setPaymentMethod('online')}
                      className='py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm'
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
                      <Smartphone size={16} />
                      Transferencia
                    </button>
                    <button
                      onClick={() => setPaymentMethod('card')}
                      className='py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm'
                      style={
                        paymentMethod === 'card'
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
                      onClick={() => setPaymentMethod('on_delivery')}
                      className='py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm'
                      style={
                        paymentMethod === 'on_delivery'
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
                      En Entrega
                    </button>
                  </div>
                </div>

                {/* Cash Calculator - Only for cash payment */}
                {paymentMethod === 'cash' && (
                  <div className='mb-4'>
                    <div className='flex items-center justify-between mb-2'>
                      <div
                        className='text-sm'
                        style={{ color: 'var(--color-text)' }}
                      >
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
                          </button>
                        )}
                        {cashReceived > 0 && (
                          <button
                            onClick={resetCash}
                            className='text-xs px-2 py-1 rounded flex items-center gap-1'
                            style={{
                              backgroundColor: 'var(--color-background-accent)',
                              color: 'var(--color-text)',
                            }}
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div
                      className='text-2xl font-bold mb-2'
                      style={{ color: 'var(--color-accent)' }}
                    >
                      {formatPrice(cashReceived)}
                    </div>
                    <div
                      className='text-sm mb-2'
                      style={{ color: 'var(--color-text)' }}
                    >
                      Cambio:{' '}
                      <span className='font-bold'>
                        {change >= 0 ? formatPrice(change) : '$0'}
                      </span>
                    </div>

                    {changeBreakdown && change > 0 && (
                      <div
                        className='mt-2 p-2 rounded-lg border'
                        style={{
                          backgroundColor: 'var(--color-background-accent)',
                          borderColor: 'var(--color-accent)',
                        }}
                      >
                        <div
                          className='text-xs font-semibold mb-1'
                          style={{ color: 'var(--color-accent)' }}
                        >
                          Entregar cambio:
                        </div>
                        <div className='flex flex-wrap gap-1'>
                          {changeBreakdown.map((item) => (
                            <span
                              key={item.bill_value}
                              className='text-xs px-2 py-1 rounded'
                              style={{
                                backgroundColor: 'var(--color-background)',
                                color: 'var(--color-text)',
                              }}
                            >
                              {formatNumber(item.quantity)}x{' '}
                              {formatPrice(item.bill_value)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {change > 0 &&
                      !changeBreakdown &&
                      cashReceived >= total && (
                        <div
                          className='mt-2 p-2 rounded-lg border'
                          style={{
                            backgroundColor: 'var(--color-background-accent)',
                            borderColor: 'var(--color-primary)',
                          }}
                        >
                          <div
                            className='text-xs'
                            style={{ color: 'var(--color-primary)' }}
                          >
                            No se puede dar cambio exacto
                          </div>
                        </div>
                      )}

                    <div className='mt-3'>
                      <div className='grid grid-cols-5 gap-1'>
                        {BILLS.map((bill) => (
                          <button
                            key={bill}
                            onClick={() => addCash(bill)}
                            className='py-1.5 px-1 rounded text-xs font-semibold'
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
                )}

                {/* Non-cash payment indicator */}
                {paymentMethod !== 'cash' && (
                  <div
                    className='mb-4 p-3 rounded-lg border'
                    style={{
                      backgroundColor: 'var(--color-background-accent)',
                      borderColor: 'var(--color-accent)',
                    }}
                  >
                    <div
                      className='text-center'
                      style={{ color: 'var(--color-accent)' }}
                    >
                      <CreditCard size={24} className='mx-auto mb-1' />
                      <div className='text-sm font-semibold'>
                        {paymentMethod === 'online'
                          ? 'Transferencia'
                          : paymentMethod === 'card'
                          ? 'Tarjeta'
                          : 'Contra Entrega'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className='space-y-2 mt-auto'>
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
                    onClick={sendUnpaid}
                    disabled={
                      cart.length === 0 ||
                      processing ||
                      (scheduledTime !== '' && !isValidTime(scheduledTime))
                    }
                    className='w-full py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed'
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'var(--color-on-accent)',
                    }}
                  >
                    {processing ? 'Procesando...' : 'Enviar Sin Pago'}
                  </button>
                  <button
                    onClick={cancelPayment}
                    className='w-full py-2 rounded-lg font-semibold'
                    style={{
                      backgroundColor: 'var(--color-background-accent)',
                      color: 'var(--color-text)',
                    }}
                  >
                    Volver
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer section - only when NOT in payment mode */}
          {!showPayment && (
            <div className='border-t pt-4'>
              {/* Pre-checkout: Time, Name, Order Type */}
              <div className='mb-4'>
                <label
                  className='flex items-center gap-2 text-sm mb-2'
                  style={{ color: 'var(--color-text)' }}
                >
                  <Clock size={16} />
                  <span>Hora programada (opcional)</span>
                </label>
                <input
                  type='text'
                  inputMode='numeric'
                  placeholder='HH:MM (ej: 20:30)'
                  value={scheduledTime}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className='w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2'
                  style={{
                    backgroundColor: 'var(--color-background)',
                    borderColor:
                      scheduledTime && !isValidTime(scheduledTime)
                        ? '#ef4444'
                        : 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                  }}
                />
                <div className='flex items-center justify-between mt-1'>
                  {scheduledTime && !isValidTime(scheduledTime) && (
                    <span className='text-xs' style={{ color: '#ef4444' }}>
                      Hora inválida
                    </span>
                  )}
                  {scheduledTime && isValidTime(scheduledTime) && (
                    <button
                      onClick={() => setScheduledTime('')}
                      className='text-xs hover:underline'
                      style={{ color: 'var(--color-accent)' }}
                    >
                      Limpiar hora
                    </button>
                  )}
                </div>
              </div>

              {/* Customer Name */}
              <div className='mb-4'>
                <label
                  className='flex items-center gap-2 text-sm mb-2'
                  style={{ color: 'var(--color-text)' }}
                >
                  <User size={16} />
                  <span>Nombre del cliente (opcional)</span>
                </label>
                <input
                  type='text'
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder='Ej: Juan'
                  className='w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2'
                  style={{
                    backgroundColor: 'var(--color-background)',
                    borderColor: 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                  }}
                />
              </div>

              {/* Order Type (Pickup / Delivery) */}
              <div className='mb-4'>
                <label
                  className='flex items-center gap-2 text-sm mb-2'
                  style={{ color: 'var(--color-text)' }}
                >
                  <span>Tipo de entrega</span>
                </label>
                <div className='flex gap-2'>
                  <button
                    onClick={() => setOrderType('pickup')}
                    className='flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-semibold transition-all'
                    style={{
                      backgroundColor:
                        orderType === 'pickup'
                          ? 'var(--color-accent)'
                          : 'var(--color-background)',
                      color:
                        orderType === 'pickup'
                          ? 'var(--color-on-accent)'
                          : 'var(--color-text)',
                    }}
                  >
                    <Home size={16} />
                    Retiro
                  </button>
                  <button
                    onClick={() => setOrderType('delivery')}
                    className='flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-semibold transition-all'
                    style={{
                      backgroundColor:
                        orderType === 'delivery'
                          ? 'var(--color-accent)'
                          : 'var(--color-background)',
                      color:
                        orderType === 'delivery'
                          ? 'var(--color-on-accent)'
                          : 'var(--color-text)',
                    }}
                  >
                    <Truck size={16} />
                    Delivery
                  </button>
                </div>
              </div>

              {/* Delivery Address - only show when delivery is selected */}
              {orderType === 'delivery' && (
                <div className='mb-4'>
                  <label
                    className='flex items-center gap-2 text-sm mb-2'
                    style={{ color: 'var(--color-text)' }}
                  >
                    <Truck size={16} />
                    <span>Dirección de entrega</span>
                  </label>
                  <input
                    type='text'
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder='Ej: Calle 4 e/ 5 y 7 n276'
                    className='w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2'
                    style={{
                      backgroundColor: 'var(--color-background)',
                      borderColor: 'var(--color-background-accent)',
                      color: 'var(--color-text)',
                    }}
                  />
                </div>
              )}

              {/* Total with delivery charge breakdown */}
              {currentDeliveryCharge > 0 && (
                <div
                  className='mb-2 text-sm'
                  style={{ color: 'var(--color-text)' }}
                >
                  <div className='flex justify-between'>
                    <span>Subtotal:</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Cargo por Delivery:</span>
                    <span>{formatPrice(currentDeliveryCharge)}</span>
                  </div>
                </div>
              )}
              {orderType === 'delivery' &&
                isDeliveryFree &&
                deliveryChargeAmount > 0 && (
                  <div
                    className='mb-2 text-sm flex justify-between'
                    style={{ color: 'var(--color-accent)' }}
                  >
                    <span>Delivery Gratis</span>
                    <span className='line-through opacity-60'>
                      {formatPrice(deliveryChargeAmount)}
                    </span>
                  </div>
                )}
              <div
                className='flex justify-between text-2xl font-bold mb-4'
                style={{ color: 'var(--color-text)' }}
              >
                <span>Total:</span>
                <span style={{ color: 'var(--color-primary)' }}>
                  {formatPrice(total)}
                </span>
              </div>

              {/* Proceed to payment button */}
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
            </div>
          )}
        </div>
      </div>

      {/* KDS Orders Panel */}
      {showKdsPanel && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
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
                {/* Connection Status Indicator */}
                <span
                  className='text-xs px-2 py-1 rounded-full font-medium'
                  style={{
                    backgroundColor:
                      kdsConnectionStatus === 'connected'
                        ? '#10b981'
                        : kdsConnectionStatus === 'connecting'
                        ? '#f59e0b'
                        : kdsConnectionStatus === 'error'
                        ? '#ef4444'
                        : '#6b7280',
                    color: 'white',
                  }}
                >
                  {kdsConnectionStatus === 'connected'
                    ? 'Conectado'
                    : kdsConnectionStatus === 'connecting'
                    ? 'Conectando...'
                    : kdsConnectionStatus === 'error'
                    ? 'Error'
                    : 'Desconectado'}
                </span>
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
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                  {kdsOrders.map((order) => (
                    <div
                      key={order.id}
                      className={`rounded-lg p-4 border-2 transition-all duration-300 ${
                        order.status === 'completed'
                          ? 'opacity-50 scale-95'
                          : ''
                      }`}
                      style={{
                        backgroundColor: 'var(--color-background)',
                        borderColor:
                          order.scheduled_time &&
                          new Date(order.scheduled_time).getTime() < Date.now()
                            ? '#ef4444' // Red for overdue
                            : order.status === 'pending'
                            ? 'var(--color-accent)'
                            : 'var(--color-primary)',
                      }}
                    >
                      <div className='flex items-start justify-between mb-3'>
                        <div className='flex flex-col'>
                          <span
                            className='font-bold text-lg'
                            style={{ color: 'var(--color-text)' }}
                          >
                            #{order.sale_number}
                          </span>
                          {order.customer_name && (
                            <div
                              className='flex items-center gap-1 text-xs mt-0.5'
                              style={{ color: 'var(--color-text)' }}
                            >
                              <User size={12} />
                              {order.customer_name}
                            </div>
                          )}
                          {order.order_type && (
                            <span
                              className='inline-block px-2 py-0.5 rounded text-xs font-semibold mt-1'
                              style={{
                                backgroundColor:
                                  order.order_type === 'delivery'
                                    ? '#3b82f6'
                                    : '#10b981',
                                color: 'white',
                              }}
                            >
                              {order.order_type === 'delivery' ? (
                                <>
                                  <Truck size={10} className='inline mr-1' />
                                  Delivery
                                </>
                              ) : (
                                <>
                                  <Home size={10} className='inline mr-1' />
                                  Retiro
                                </>
                              )}
                            </span>
                          )}
                          {order.order_type === 'delivery' && (
                            <div
                              className='mt-1 text-xs italic flex items-center gap-1 cursor-pointer hover:opacity-80'
                              style={{
                                color: 'var(--color-text)',
                                opacity: 0.8,
                              }}
                              onClick={() => {
                                setKdsEditingAddress(order.id);
                                setKdsAddressValue(
                                  order.delivery_address || ''
                                );
                              }}
                            >
                              📍 {order.delivery_address || 'Sin dirección'}
                              <Pencil size={10} />
                            </div>
                          )}
                          {order.scheduled_time && (
                            <div
                              className='flex items-center gap-1 text-xs mt-1 font-medium'
                              style={{
                                color:
                                  new Date(order.scheduled_time).getTime() <
                                  Date.now()
                                    ? '#ef4444'
                                    : 'var(--color-accent)',
                              }}
                            >
                              <Clock size={12} />
                              {new Date(
                                order.scheduled_time
                              ).toLocaleTimeString('es-AR', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })}
                              {new Date(order.scheduled_time).getTime() <
                                Date.now() && (
                                <span className='ml-1'>(ATRASADO)</span>
                              )}
                            </div>
                          )}
                        </div>
                        <span
                          className='px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1'
                          style={{
                            backgroundColor:
                              order.status === 'pending'
                                ? 'var(--color-accent)'
                                : order.status === 'on_delivery'
                                ? '#3b82f6'
                                : 'var(--color-primary)',
                            color:
                              order.status === 'pending'
                                ? 'var(--color-on-accent)'
                                : 'white',
                          }}
                        >
                          {order.status === 'pending' ? (
                            <>
                              <ChefHat size={12} />
                              Pendiente
                            </>
                          ) : order.status === 'on_delivery' ? (
                            <>
                              <Truck size={12} />
                              En Camino
                            </>
                          ) : (
                            <>
                              <CheckCircle size={12} />
                              Entregado
                            </>
                          )}
                        </span>
                      </div>

                      <div className='space-y-2 mb-4'>
                        {(() => {
                          // Helper to create a signature for an item
                          const getItemSignature = (item: KDSOrderItem) => {
                            const removed = (item.removed_ingredients || [])
                              .slice()
                              .sort()
                              .join(',');
                            return `${item.product_name}|${removed}`;
                          };

                          // Helper to detect combo size (products per combo instance)
                          const detectComboSize = (items: KDSOrderItem[]) => {
                            if (items.length <= 1) return items.length;
                            const firstProductName = items[0].product_name;
                            for (let i = 1; i < items.length; i++) {
                              if (items[i].product_name === firstProductName) {
                                return i;
                              }
                            }
                            return items.length;
                          };

                          // Helper to get signature for a combo instance
                          const getComboInstanceSignature = (
                            items: KDSOrderItem[]
                          ) => {
                            return items.map(getItemSignature).join('::');
                          };

                          // Group items by combo_name
                          const comboGroups: Record<string, KDSOrderItem[]> =
                            {};
                          const standaloneItems: {
                            item: KDSOrderItem;
                            originalIndex: number;
                          }[] = [];

                          order.items.forEach((item, idx) => {
                            if (item.combo_name) {
                              if (!comboGroups[item.combo_name]) {
                                comboGroups[item.combo_name] = [];
                              }
                              comboGroups[item.combo_name].push(item);
                            } else {
                              standaloneItems.push({
                                item,
                                originalIndex: idx,
                              });
                            }
                          });

                          // Process combo groups into unique instances with quantities
                          type ProcessedCombo = {
                            comboName: string;
                            items: {
                              item: KDSOrderItem;
                              originalIndex: number;
                            }[];
                            quantity: number;
                          };
                          const processedCombos: ProcessedCombo[] = [];

                          // Track original indices for combo items
                          let comboItemIndex = 0;
                          const comboItemIndices: number[] = [];
                          order.items.forEach((item, idx) => {
                            if (item.combo_name) {
                              comboItemIndices.push(idx);
                            }
                          });

                          Object.entries(comboGroups).forEach(
                            ([comboName, allItems]) => {
                              const comboSize = detectComboSize(allItems);
                              const instances: {
                                item: KDSOrderItem;
                                originalIndex: number;
                              }[][] = [];

                              // Split items into individual combo instances
                              for (
                                let i = 0;
                                i < allItems.length;
                                i += comboSize
                              ) {
                                const instanceItems = allItems
                                  .slice(i, i + comboSize)
                                  .map((item, j) => ({
                                    item,
                                    originalIndex:
                                      comboItemIndices[comboItemIndex + i + j],
                                  }));
                                instances.push(instanceItems);
                              }
                              comboItemIndex += allItems.length;

                              // Group identical instances
                              const instanceMap = new Map<
                                string,
                                {
                                  items: {
                                    item: KDSOrderItem;
                                    originalIndex: number;
                                  }[];
                                  count: number;
                                }
                              >();

                              instances.forEach((instance) => {
                                const signature = getComboInstanceSignature(
                                  instance.map((i) => i.item)
                                );
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
                                processedCombos.push({
                                  comboName,
                                  items,
                                  quantity: count,
                                });
                              });
                            }
                          );

                          const elements: React.ReactNode[] = [];

                          // Render combo groups
                          processedCombos.forEach((combo, comboIdx) => {
                            // Combo header
                            elements.push(
                              <div
                                key={`combo-header-${comboIdx}`}
                                className='text-xs font-bold px-2 py-1 rounded'
                                style={{
                                  backgroundColor: 'var(--color-accent)',
                                  color: 'var(--color-on-accent)',
                                  marginTop: comboIdx > 0 ? '0.5rem' : '0',
                                }}
                              >
                                {combo.quantity > 1
                                  ? `${combo.quantity}x COMBO`
                                  : 'COMBO'}{' '}
                                {combo.comboName}
                              </div>
                            );

                            // Combo products
                            combo.items.forEach(
                              ({ item, originalIndex }, itemIdx) => {
                                const removableIngredients =
                                  getRemovableIngredientsForProduct(
                                    item.product_name
                                  );
                                const isEditingThis =
                                  kdsEditingIngredients?.orderId === order.id &&
                                  kdsEditingIngredients?.itemIndex ===
                                    originalIndex;

                                elements.push(
                                  <div
                                    key={`combo-${comboIdx}-item-${itemIdx}`}
                                    className='text-sm rounded-lg p-2'
                                    style={{
                                      color: 'var(--color-text)',
                                      backgroundColor: isEditingThis
                                        ? 'var(--color-background-accent)'
                                        : 'transparent',
                                      marginLeft: '0.75rem',
                                    }}
                                  >
                                    <div className='flex justify-between items-center'>
                                      <span>
                                        {combo.quantity > 1
                                          ? `${combo.quantity}x`
                                          : `${item.quantity}x`}{' '}
                                        {item.product_name}
                                      </span>
                                      <div className='flex items-center gap-2'>
                                        <span className='opacity-60'>
                                          {formatPrice(
                                            item.product_price *
                                              item.quantity *
                                              combo.quantity
                                          )}
                                        </span>
                                        {removableIngredients.length > 0 && (
                                          <button
                                            onClick={() =>
                                              setKdsEditingIngredients(
                                                isEditingThis
                                                  ? null
                                                  : {
                                                      orderId: order.id,
                                                      itemIndex: originalIndex,
                                                    }
                                              )
                                            }
                                            className='flex items-center justify-center rounded hover:opacity-80'
                                            style={{
                                              backgroundColor: isEditingThis
                                                ? 'var(--color-accent)'
                                                : 'var(--color-background-accent)',
                                              color: isEditingThis
                                                ? 'var(--color-on-accent)'
                                                : 'var(--color-text)',
                                            }}
                                            title='Editar ingredientes'
                                          >
                                            <Beef size={18} />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {item.removed_ingredients &&
                                      item.removed_ingredients.length > 0 && (
                                        <div
                                          className='text-xs italic ml-4'
                                          style={{
                                            color: 'var(--color-primary)',
                                          }}
                                        >
                                          Sin:{' '}
                                          {item.removed_ingredients.join(', ')}
                                        </div>
                                      )}

                                    {/* Inline ingredient toggles */}
                                    {isEditingThis && (
                                      <div className='mt-2 flex flex-wrap gap-1'>
                                        {removableIngredients.map((ing) => {
                                          const isRemoved = (
                                            item.removed_ingredients || []
                                          ).includes(ing);
                                          return (
                                            <button
                                              key={ing}
                                              onClick={() =>
                                                toggleKdsOrderIngredient(
                                                  order.id,
                                                  originalIndex,
                                                  ing
                                                )
                                              }
                                              className='px-2 py-0.5 rounded text-xs font-medium transition-all'
                                              style={{
                                                backgroundColor: isRemoved
                                                  ? 'var(--color-primary)'
                                                  : 'var(--color-background)',
                                                color: isRemoved
                                                  ? 'var(--color-on-primary)'
                                                  : 'var(--color-text)',
                                                textDecoration: isRemoved
                                                  ? 'line-through'
                                                  : 'none',
                                              }}
                                            >
                                              {isRemoved ? 'SIN ' : ''}
                                              {ing}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            );
                          });

                          // Group standalone items by signature
                          type StandaloneGroup = {
                            items: {
                              item: KDSOrderItem;
                              originalIndex: number;
                            }[];
                            count: number;
                          };
                          const standaloneGroups = new Map<
                            string,
                            StandaloneGroup
                          >();

                          standaloneItems.forEach(({ item, originalIndex }) => {
                            const signature = getItemSignature(item);
                            const existing = standaloneGroups.get(signature);
                            if (existing) {
                              existing.items.push({ item, originalIndex });
                              existing.count += item.quantity;
                            } else {
                              standaloneGroups.set(signature, {
                                items: [{ item, originalIndex }],
                                count: item.quantity,
                              });
                            }
                          });

                          // Render grouped standalone items
                          let standaloneIdx = 0;
                          standaloneGroups.forEach(({ items, count }) => {
                            // Use first item for display, but track all indices
                            const { item, originalIndex } = items[0];
                            const removableIngredients =
                              getRemovableIngredientsForProduct(
                                item.product_name
                              );
                            const isEditingThis =
                              kdsEditingIngredients?.orderId === order.id &&
                              kdsEditingIngredients?.itemIndex ===
                                originalIndex;

                            elements.push(
                              <div
                                key={`standalone-${standaloneIdx++}`}
                                className='text-sm rounded-lg p-2'
                                style={{
                                  color: 'var(--color-text)',
                                  backgroundColor: isEditingThis
                                    ? 'var(--color-background-accent)'
                                    : 'transparent',
                                }}
                              >
                                <div className='flex justify-between items-center'>
                                  <span>
                                    {count}x {item.product_name}
                                  </span>
                                  <div className='flex items-center gap-2'>
                                    <span className='opacity-60'>
                                      {formatPrice(item.product_price * count)}
                                    </span>
                                    {removableIngredients.length > 0 && (
                                      <button
                                        onClick={() =>
                                          setKdsEditingIngredients(
                                            isEditingThis
                                              ? null
                                              : {
                                                  orderId: order.id,
                                                  itemIndex: originalIndex,
                                                }
                                          )
                                        }
                                        className='flex items-center justify-center  rounded hover:opacity-80'
                                        style={{
                                          backgroundColor: isEditingThis
                                            ? 'var(--color-accent)'
                                            : 'var(--color-background-accent)',
                                          color: isEditingThis
                                            ? 'var(--color-on-accent)'
                                            : 'var(--color-text)',
                                        }}
                                        title='Editar ingredientes'
                                      >
                                        <Beef size={18} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {item.removed_ingredients &&
                                  item.removed_ingredients.length > 0 && (
                                    <div
                                      className='text-xs italic ml-4'
                                      style={{
                                        color: 'var(--color-primary)',
                                      }}
                                    >
                                      Sin: {item.removed_ingredients.join(', ')}
                                    </div>
                                  )}

                                {/* Inline ingredient toggles */}
                                {isEditingThis && (
                                  <div className='mt-2 flex flex-wrap gap-1'>
                                    {removableIngredients.map((ing) => {
                                      const isRemoved = (
                                        item.removed_ingredients || []
                                      ).includes(ing);
                                      return (
                                        <button
                                          key={ing}
                                          onClick={() =>
                                            toggleKdsOrderIngredient(
                                              order.id,
                                              originalIndex,
                                              ing
                                            )
                                          }
                                          className='px-2 py-0.5 rounded text-xs font-medium transition-all'
                                          style={{
                                            backgroundColor: isRemoved
                                              ? 'var(--color-primary)'
                                              : 'var(--color-background)',
                                            color: isRemoved
                                              ? 'var(--color-on-primary)'
                                              : 'var(--color-text)',
                                            textDecoration: isRemoved
                                              ? 'line-through'
                                              : 'none',
                                          }}
                                        >
                                          {isRemoved ? 'SIN ' : ''}
                                          {ing}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          });

                          return elements;
                        })()}
                      </div>

                      <div
                        className='flex flex-col justify-between items-center pt-3 border-t gap-2'
                        style={{
                          borderColor: 'var(--color-background-accent)',
                        }}
                      >
                        <div className='flex w-full justify-between items-center'>
                          <span
                            className='font-bold'
                            style={{ color: 'var(--color-primary)' }}
                          >
                            {formatPrice(order.total)}
                          </span>
                          {order.status === 'pending' && (
                            <button
                              onClick={() => loadOrderForEdit(order)}
                              className='flex rounded-lg transition-all hover:opacity-80 items-center justify-center'
                              style={{
                                backgroundColor:
                                  'var(--color-background-accent)',
                              }}
                              title='Editar pedido'
                            >
                              <Pencil
                                size={18}
                                style={{ color: 'var(--color-text)' }}
                              />
                            </button>
                          )}
                        </div>
                        <div>
                          {(order.status === 'pending' ||
                            order.status === 'on_delivery') && (
                            <div className='flex items-center gap-2'>
                              {/* For delivery orders: pending -> on_delivery -> completed */}
                              {order.order_type === 'delivery' ? (
                                order.status === 'pending' ? (
                                  <button
                                    onClick={() =>
                                      updateKdsOrderStatus(
                                        order.id,
                                        'on_delivery'
                                      )
                                    }
                                    className='px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 flex items-center gap-1'
                                    style={{
                                      backgroundColor: '#3b82f6',
                                      color: 'white',
                                    }}
                                  >
                                    <Truck size={14} />
                                    Enviar
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      updateKdsOrderStatus(
                                        order.id,
                                        'completed'
                                      )
                                    }
                                    className='px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90'
                                    style={{
                                      backgroundColor: 'var(--color-primary)',
                                      color: 'var(--color-on-primary)',
                                    }}
                                  >
                                    Entregado
                                  </button>
                                )
                              ) : (
                                /* For pickup orders: pending -> completed directly */
                                <button
                                  onClick={() =>
                                    updateKdsOrderStatus(order.id, 'completed')
                                  }
                                  className='px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90'
                                  style={{
                                    backgroundColor: 'var(--color-primary)',
                                    color: 'var(--color-on-primary)',
                                  }}
                                >
                                  Marcar Entregado
                                </button>
                              )}
                              {/* Mark as Paid button for unpaid orders */}
                              {kdsUnpaidSales[order.sale_number] && (
                                <button
                                  onClick={() =>
                                    openKdsMarkPaidModal(order.sale_number)
                                  }
                                  className='px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 flex items-center gap-1'
                                  style={{
                                    backgroundColor: 'var(--color-accent)',
                                    color: 'var(--color-on-accent)',
                                  }}
                                >
                                  <DollarSign size={14} />
                                  Cobrar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KDS Address Edit Modal */}
      {kdsEditingAddress && (
        <div className='fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
          <div
            className='w-full max-w-md rounded-xl shadow-2xl overflow-hidden'
            style={{ backgroundColor: 'var(--color-background-secondary)' }}
          >
            <div
              className='px-6 py-4 flex items-center justify-between border-b'
              style={{ borderColor: 'var(--color-background-accent)' }}
            >
              <div className='flex items-center gap-3'>
                <Truck size={24} style={{ color: 'var(--color-primary)' }} />
                <h2
                  className='text-xl font-bold'
                  style={{ color: 'var(--color-text)' }}
                >
                  Dirección de Entrega
                </h2>
              </div>
              <button
                onClick={() => setKdsEditingAddress(null)}
                className='flex justify-center items-center p-1 rounded-lg hover:opacity-80 transition-opacity'
                style={{ backgroundColor: 'var(--color-background-accent)' }}
              >
                <X size={20} style={{ color: 'var(--color-text)' }} />
              </button>
            </div>

            <div className='p-6'>
              <input
                ref={kdsAddressInputRef}
                type='text'
                value={kdsAddressValue}
                onChange={(e) => setKdsAddressValue(e.target.value)}
                placeholder='Ej: Calle 4 e/ 5 y 7 n276'
                className='w-full p-3 rounded-lg text-lg mb-4'
                style={{
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  border: '2px solid var(--color-background-accent)',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateKdsOrderAddress(kdsEditingAddress, kdsAddressValue);
                  }
                }}
              />

              <div className='flex gap-3'>
                <button
                  onClick={() => setKdsEditingAddress(null)}
                  className='flex-1 py-3 rounded-lg font-bold'
                  style={{
                    backgroundColor: 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() =>
                    updateKdsOrderAddress(kdsEditingAddress, kdsAddressValue)
                  }
                  className='flex-1 py-3 rounded-lg font-bold'
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                  }}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KDS Mark as Paid Modal */}
      {kdsMarkingPaid && kdsUnpaidSales[kdsMarkingPaid] && (
        <div className='fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm'>
          <div
            className='w-full max-w-md rounded-xl shadow-2xl overflow-hidden'
            style={{ backgroundColor: 'var(--color-background-secondary)' }}
          >
            <div
              className='px-6 py-4 flex items-center justify-between border-b'
              style={{ borderColor: 'var(--color-background-accent)' }}
            >
              <div className='flex items-center gap-3'>
                <DollarSign
                  size={24}
                  style={{ color: 'var(--color-primary)' }}
                />
                <h2
                  className='text-xl font-bold'
                  style={{ color: 'var(--color-text)' }}
                >
                  Cobrar Pedido
                </h2>
              </div>
              <button
                onClick={closeKdsMarkPaidModal}
                className='flex justify-center items-center p-1 rounded-lg hover:opacity-80 transition-opacity'
                style={{ backgroundColor: 'var(--color-background-accent)' }}
              >
                <X size={20} style={{ color: 'var(--color-text)' }} />
              </button>
            </div>

            <div className='p-6'>
              {/* Order info */}
              <div
                className='mb-4 p-3 rounded-lg'
                style={{ backgroundColor: 'var(--color-background-accent)' }}
              >
                <div
                  className='font-bold mb-1'
                  style={{ color: 'var(--color-text)' }}
                >
                  Pedido #{kdsMarkingPaid}
                </div>
                <div
                  className='text-2xl font-bold'
                  style={{ color: 'var(--color-primary)' }}
                >
                  {formatPrice(kdsUnpaidSales[kdsMarkingPaid].total_amount)}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className='grid grid-cols-2 gap-2 mb-4'>
                <button
                  onClick={() => setKdsMarkPaymentMethod('cash')}
                  className='py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm'
                  style={
                    kdsMarkPaymentMethod === 'cash'
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
                  onClick={() => setKdsMarkPaymentMethod('online')}
                  className='py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm'
                  style={
                    kdsMarkPaymentMethod === 'online'
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
                  onClick={() => setKdsMarkPaymentMethod('card')}
                  className='py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm'
                  style={
                    kdsMarkPaymentMethod === 'card'
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
                  onClick={() => setKdsMarkPaymentMethod('on_delivery')}
                  className='py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm'
                  style={
                    kdsMarkPaymentMethod === 'on_delivery'
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
                  En Entrega
                </button>
              </div>

              {/* Cash Calculator */}
              {kdsMarkPaymentMethod === 'cash' && (
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
                      {formatPrice(kdsMarkCashReceived)}
                    </span>
                  </div>

                  <div className='grid grid-cols-5 gap-2 mb-3'>
                    {BILLS.slice()
                      .reverse()
                      .map((denom) => (
                        <button
                          key={denom}
                          onClick={() => addKdsMarkCash(denom)}
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

                  <div className='flex gap-2 mb-3'>
                    <button
                      onClick={undoLastKdsMarkBill}
                      disabled={kdsMarkBillHistory.length === 0}
                      className='flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-50'
                      style={{
                        backgroundColor: 'var(--color-background-accent)',
                        color: 'var(--color-text)',
                      }}
                    >
                      Deshacer
                    </button>
                    <button
                      onClick={resetKdsMarkCash}
                      disabled={kdsMarkCashReceived === 0}
                      className='flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-50'
                      style={{
                        backgroundColor: 'var(--color-background-accent)',
                        color: 'var(--color-text)',
                      }}
                    >
                      Reiniciar
                    </button>
                  </div>

                  {kdsMarkCashReceived >=
                    kdsUnpaidSales[kdsMarkingPaid].total_amount && (
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
                          {formatPrice(kdsMarkChange)}
                        </span>
                      </div>
                      {kdsMarkChangeBreakdown && kdsMarkChange > 0 && (
                        <div className='flex flex-wrap gap-1'>
                          {kdsMarkChangeBreakdown.map((b, idx) => (
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
                      {!kdsMarkChangeBreakdown && kdsMarkChange > 0 && (
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
                onClick={handleKdsMarkAsPaid}
                disabled={!canKdsMarkAsPaid()}
                className='w-full py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed'
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                }}
              >
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ingredient Customization Modal */}
      {showIngredientModal && customizingProduct && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
          <div
            className='w-full max-w-md rounded-xl shadow-2xl overflow-hidden'
            style={{ backgroundColor: 'var(--color-background-secondary)' }}
          >
            <div
              className='px-6 py-4 flex items-center justify-between border-b'
              style={{ borderColor: 'var(--color-background-accent)' }}
            >
              <h2
                className='text-xl font-bold'
                style={{ color: 'var(--color-text)' }}
              >
                {customizingProduct.name}
              </h2>
              <button
                onClick={cancelCustomization}
                className='flex justify-center items-center p-1 rounded-lg hover:opacity-80 transition-opacity'
                style={{ backgroundColor: 'var(--color-background-accent)' }}
              >
                <X size={20} style={{ color: 'var(--color-text)' }} />
              </button>
            </div>

            <div className='p-6'>
              <p
                className='text-sm mb-4 opacity-70'
                style={{ color: 'var(--color-text)' }}
              >
                Selecciona los ingredientes a quitar:
              </p>

              <div className='space-y-3 mb-6'>
                {ingredientsList.map((ingredient) => (
                  <button
                    key={ingredient.id}
                    onClick={() => toggleIngredient(ingredient.id)}
                    className='w-full flex items-center justify-between p-3 rounded-lg transition-all'
                    style={{
                      backgroundColor: ingredient.removed
                        ? 'var(--color-primary)'
                        : 'var(--color-background)',
                      color: ingredient.removed
                        ? 'var(--color-on-primary)'
                        : 'var(--color-text)',
                    }}
                  >
                    <span className={ingredient.removed ? 'line-through' : ''}>
                      {ingredient.name}
                    </span>
                    {ingredient.removed && (
                      <span className='text-sm font-semibold'>SIN</span>
                    )}
                  </button>
                ))}
              </div>

              <div className='flex gap-3'>
                <button
                  onClick={cancelCustomization}
                  className='flex-1 py-3 rounded-lg font-bold'
                  style={{
                    backgroundColor: 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmCustomization}
                  className='flex-1 py-3 rounded-lg font-bold'
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-on-accent)',
                  }}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Combo Customization Modal */}
      {showComboModal && customizingCombo && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
          <div
            className='w-full max-w-lg max-h-[90vh] overflow-auto rounded-xl shadow-2xl'
            style={{ backgroundColor: 'var(--color-background-secondary)' }}
          >
            <div
              className='px-6 py-4 flex items-center justify-between border-b sticky top-0 z-10'
              style={{
                borderColor: 'var(--color-background-accent)',
                backgroundColor: 'var(--color-background-secondary)',
              }}
            >
              <div>
                <h2
                  className='text-xl font-bold'
                  style={{ color: 'var(--color-text)' }}
                >
                  {customizingCombo.name}
                </h2>
                <p
                  className='text-2xl font-bold'
                  style={{ color: 'var(--color-accent)' }}
                >
                  {formatPrice(comboPrice)}
                </p>
              </div>
              <button
                onClick={cancelComboSelection}
                className='flex justify-center items-center p-1 rounded-lg hover:opacity-80 transition-opacity'
                style={{ backgroundColor: 'var(--color-background-accent)' }}
              >
                <X size={20} style={{ color: 'var(--color-text)' }} />
              </button>
            </div>

            <div className='p-6 space-y-6'>
              {customizingCombo.slots.map((slot) => {
                const slotProducts = comboSlotProducts[slot.id] || [];
                const slotSelections = comboSelections.filter(
                  (s) => s.slotId === slot.id
                );

                return (
                  <div key={slot.id}>
                    <h3
                      className='font-semibold mb-2'
                      style={{ color: 'var(--color-text)' }}
                    >
                      {slot.name} {slot.quantity > 1 && `(x${slot.quantity})`}
                    </h3>

                    {slotSelections.map((selection, selIndex) => (
                      <div
                        key={`${slot.id}-${selIndex}`}
                        className='mb-4 p-3 rounded-lg'
                        style={{
                          backgroundColor: 'var(--color-background)',
                        }}
                      >
                        {slot.quantity > 1 && (
                          <p
                            className='text-xs mb-2 opacity-60'
                            style={{ color: 'var(--color-text)' }}
                          >
                            Opción {selIndex + 1}
                          </p>
                        )}

                        {/* Product selector for dynamic slots */}
                        {slot.is_dynamic && slotProducts.length > 1 ? (
                          <select
                            value={selection.productId}
                            onChange={(e) =>
                              updateComboSelection(
                                slot.id,
                                selIndex,
                                e.target.value
                              )
                            }
                            className='w-full p-2 rounded mb-2'
                            style={{
                              backgroundColor:
                                'var(--color-background-secondary)',
                              color: 'var(--color-text)',
                              border:
                                '1px solid var(--color-background-accent)',
                            }}
                          >
                            {slotProducts.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name} - {formatPrice(product.price)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p
                            className='font-medium mb-2'
                            style={{ color: 'var(--color-text)' }}
                          >
                            {selection.productName}
                          </p>
                        )}

                        {/* Ingredient toggles for this product */}
                        {(() => {
                          const removableIngredients =
                            productRemovableIngredients[
                              selection.productName
                            ] || [];

                          if (removableIngredients.length === 0) return null;

                          return (
                            <div className='mt-2'>
                              <p
                                className='text-xs mb-1 opacity-60'
                                style={{ color: 'var(--color-text)' }}
                              >
                                Ingredientes:
                              </p>
                              <div className='flex flex-wrap gap-1'>
                                {removableIngredients.map((ing) => {
                                  const isRemoved =
                                    selection.removedIngredients.includes(ing);
                                  return (
                                    <button
                                      key={ing}
                                      onClick={() => {
                                        // Toggle ingredient in comboSelections
                                        setComboSelections((prev) =>
                                          prev.map((sel) => {
                                            // Find matching selection
                                            const matchingSelections =
                                              prev.filter(
                                                (s) => s.slotId === slot.id
                                              );
                                            const matchIndex =
                                              matchingSelections.indexOf(sel);
                                            if (
                                              sel.slotId === slot.id &&
                                              matchIndex === selIndex
                                            ) {
                                              const newRemoved = isRemoved
                                                ? sel.removedIngredients.filter(
                                                    (i) => i !== ing
                                                  )
                                                : [
                                                    ...sel.removedIngredients,
                                                    ing,
                                                  ];
                                              return {
                                                ...sel,
                                                removedIngredients: newRemoved,
                                              };
                                            }
                                            return sel;
                                          })
                                        );
                                      }}
                                      className='px-2 py-0.5 rounded text-xs font-medium transition-all'
                                      style={{
                                        backgroundColor: isRemoved
                                          ? 'var(--color-primary)'
                                          : 'var(--color-background-secondary)',
                                        color: isRemoved
                                          ? 'var(--color-on-primary)'
                                          : 'var(--color-text)',
                                        textDecoration: isRemoved
                                          ? 'line-through'
                                          : 'none',
                                      }}
                                    >
                                      {isRemoved ? 'SIN ' : ''}
                                      {ing}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            <div
              className='px-6 py-4 border-t sticky bottom-0'
              style={{
                borderColor: 'var(--color-background-accent)',
                backgroundColor: 'var(--color-background-secondary)',
              }}
            >
              <div className='flex gap-3'>
                <button
                  onClick={cancelComboSelection}
                  className='flex-1 py-3 rounded-lg font-bold'
                  style={{
                    backgroundColor: 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmComboSelection}
                  className='flex-1 py-3 rounded-lg font-bold'
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-on-accent)',
                  }}
                >
                  Agregar - {formatPrice(comboPrice)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Edit Order Modal */}
      {showEditModal && editingKdsOrder && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
          <div
            className='w-full h-full md:max-w-2xl md:max-h-[90vh] md:rounded-xl flex flex-col overflow-hidden'
            style={{ backgroundColor: 'var(--color-background)' }}
          >
            {/* Header */}
            <div
              className='px-6 py-4 flex items-center justify-between border-b shrink-0'
              style={{
                borderColor: 'var(--color-background-accent)',
                backgroundColor: 'var(--color-background-secondary)',
              }}
            >
              <div className='flex items-center gap-3'>
                <Pencil size={24} style={{ color: 'var(--color-primary)' }} />
                <h2
                  className='text-xl font-bold'
                  style={{ color: 'var(--color-text)' }}
                >
                  Editar Pedido #{editingKdsOrder.sale_number}
                </h2>
              </div>
              <button
                onClick={closeEditModal}
                className='flex justify-center items-center p-2 rounded-lg hover:opacity-80 transition-opacity'
                style={{ backgroundColor: 'var(--color-background-accent)' }}
              >
                <X size={24} style={{ color: 'var(--color-text)' }} />
              </button>
            </div>

            {/* Content */}
            <div className='flex-1 overflow-auto p-6'>
              {/* Scheduled Time */}
              <div
                className='mb-6 p-4 rounded-lg'
                style={{ backgroundColor: 'var(--color-background-secondary)' }}
              >
                <label
                  className='block text-sm font-semibold mb-2'
                  style={{ color: 'var(--color-text)' }}
                >
                  <Clock
                    size={16}
                    className='inline mr-2'
                    style={{ color: 'var(--color-accent)' }}
                  />
                  Hora de Entrega
                </label>
                <input
                  type='time'
                  value={editScheduledTime}
                  onChange={(e) => setEditScheduledTime(e.target.value)}
                  className='w-full p-3 rounded-lg text-lg'
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text)',
                    border: '2px solid var(--color-background-accent)',
                  }}
                />
                {editScheduledTime && (
                  <button
                    onClick={() => setEditScheduledTime('')}
                    className='mt-2 text-sm underline'
                    style={{ color: 'var(--color-primary)' }}
                  >
                    Quitar hora programada (ASAP)
                  </button>
                )}
              </div>

              {/* Customer Name */}
              <div
                className='mb-6 p-4 rounded-lg'
                style={{ backgroundColor: 'var(--color-background-secondary)' }}
              >
                <label
                  className='block text-sm font-semibold mb-2'
                  style={{ color: 'var(--color-text)' }}
                >
                  <User
                    size={16}
                    className='inline mr-2'
                    style={{ color: 'var(--color-accent)' }}
                  />
                  Nombre del Cliente
                </label>
                <input
                  type='text'
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  placeholder='Ej: Juan'
                  className='w-full p-3 rounded-lg text-lg'
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text)',
                    border: '2px solid var(--color-background-accent)',
                  }}
                />
              </div>

              {/* Order Type */}
              <div
                className='mb-6 p-4 rounded-lg'
                style={{ backgroundColor: 'var(--color-background-secondary)' }}
              >
                <label
                  className='block text-sm font-semibold mb-2'
                  style={{ color: 'var(--color-text)' }}
                >
                  Tipo de Entrega
                </label>
                <div className='flex gap-3'>
                  <button
                    onClick={() => setEditOrderType('pickup')}
                    className='flex-1 flex items-center justify-center gap-2 p-3 rounded-lg font-semibold text-lg transition-all'
                    style={{
                      backgroundColor:
                        editOrderType === 'pickup'
                          ? 'var(--color-accent)'
                          : 'var(--color-background)',
                      color:
                        editOrderType === 'pickup'
                          ? 'var(--color-on-accent)'
                          : 'var(--color-text)',
                    }}
                  >
                    <Home size={20} />
                    Retiro
                  </button>
                  <button
                    onClick={() => setEditOrderType('delivery')}
                    className='flex-1 flex items-center justify-center gap-2 p-3 rounded-lg font-semibold text-lg transition-all'
                    style={{
                      backgroundColor:
                        editOrderType === 'delivery'
                          ? 'var(--color-accent)'
                          : 'var(--color-background)',
                      color:
                        editOrderType === 'delivery'
                          ? 'var(--color-on-accent)'
                          : 'var(--color-text)',
                    }}
                  >
                    <Truck size={20} />
                    Delivery
                  </button>
                </div>
              </div>

              {/* Delivery Address - only show when delivery is selected */}
              {editOrderType === 'delivery' && (
                <div
                  className='mb-6 p-4 rounded-lg'
                  style={{
                    backgroundColor: 'var(--color-background-secondary)',
                  }}
                >
                  <label
                    className='block text-sm font-semibold mb-2'
                    style={{ color: 'var(--color-text)' }}
                  >
                    <Truck
                      size={16}
                      className='inline mr-2'
                      style={{ color: 'var(--color-accent)' }}
                    />
                    Dirección de Entrega
                  </label>
                  <input
                    type='text'
                    value={editDeliveryAddress}
                    onChange={(e) => setEditDeliveryAddress(e.target.value)}
                    placeholder='Ej: Calle 4 e/ 5 y 7 n276'
                    className='w-full p-3 rounded-lg text-lg'
                    style={{
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text)',
                      border: '2px solid var(--color-background-accent)',
                    }}
                  />
                </div>
              )}

              {/* Items */}
              <div className='space-y-4'>
                {editModalItems.length === 0 ? (
                  <div
                    className='text-center py-8 opacity-60'
                    style={{ color: 'var(--color-text)' }}
                  >
                    No hay productos en este pedido
                  </div>
                ) : (
                  editModalItems.map((item, index) => {
                    const removableIngredients =
                      getRemovableIngredientsForProduct(item.product_name);
                    return (
                      <div
                        key={index}
                        className='p-4 rounded-lg'
                        style={{
                          backgroundColor: 'var(--color-background-secondary)',
                        }}
                      >
                        <div className='flex items-center justify-between mb-3'>
                          <div>
                            <span
                              className='font-bold text-lg'
                              style={{ color: 'var(--color-text)' }}
                            >
                              {item.product_name}
                            </span>
                            <span
                              className='ml-2 opacity-60'
                              style={{ color: 'var(--color-text)' }}
                            >
                              {formatPrice(item.product_price)} c/u
                            </span>
                          </div>
                          <div className='flex items-center gap-3'>
                            <button
                              onClick={() => updateEditItemQuantity(index, -1)}
                              className='w-10 h-10 rounded-lg font-bold text-xl flex items-center justify-center'
                              style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-on-primary)',
                              }}
                            >
                              -
                            </button>
                            <span
                              className='text-xl font-bold w-8 text-center'
                              style={{ color: 'var(--color-text)' }}
                            >
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateEditItemQuantity(index, 1)}
                              className='w-10 h-10 rounded-lg font-bold text-xl flex items-center justify-center'
                              style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-on-primary)',
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Show removed ingredients and customize button */}
                        <div className='mt-3 pt-3 border-t border-opacity-20 flex items-center justify-between'>
                          <div className='flex-1'>
                            {item.removed_ingredients &&
                            item.removed_ingredients.length > 0 ? (
                              <div
                                className='text-sm italic'
                                style={{ color: 'var(--color-primary)' }}
                              >
                                Sin: {item.removed_ingredients.join(', ')}
                              </div>
                            ) : (
                              <div
                                className='text-sm opacity-50'
                                style={{ color: 'var(--color-text)' }}
                              >
                                Sin modificaciones
                              </div>
                            )}
                          </div>
                          {removableIngredients.length > 0 && (
                            <button
                              onClick={() => openEditIngredientModal(index)}
                              className='px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1'
                              style={{
                                backgroundColor: 'var(--color-accent)',
                                color: 'var(--color-on-accent)',
                              }}
                            >
                              <Beef size={14} />
                              Personalizar
                            </button>
                          )}
                        </div>

                        {/* Subtotal */}
                        <div
                          className='mt-3 text-right font-bold'
                          style={{ color: 'var(--color-accent)' }}
                        >
                          {formatPrice(item.product_price * item.quantity)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              className='px-6 py-4 border-t shrink-0'
              style={{
                borderColor: 'var(--color-background-accent)',
                backgroundColor: 'var(--color-background-secondary)',
              }}
            >
              <div className='flex items-center justify-between mb-4'>
                <span
                  className='text-lg font-semibold'
                  style={{ color: 'var(--color-text)' }}
                >
                  Total
                </span>
                <span
                  className='text-2xl font-bold'
                  style={{ color: 'var(--color-primary)' }}
                >
                  {formatPrice(
                    editModalItems.reduce(
                      (sum, item) => sum + item.product_price * item.quantity,
                      0
                    )
                  )}
                </span>
              </div>
              <div className='flex gap-3'>
                <button
                  onClick={closeEditModal}
                  className='flex-1 py-4 rounded-lg font-bold text-lg'
                  style={{
                    backgroundColor: 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={saveOrderEdit}
                  disabled={editModalItems.length === 0}
                  className='flex-1 py-4 rounded-lg font-bold text-lg disabled:opacity-50'
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-on-accent)',
                  }}
                >
                  Guardar Cambios
                </button>
              </div>
            </div>

            {/* Ingredient Sub-Modal */}
            {editIngredientItemIndex !== null && (
              <div className='absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10'>
                <div
                  className='w-full max-w-md rounded-xl shadow-2xl overflow-hidden mx-4'
                  style={{
                    backgroundColor: 'var(--color-background-secondary)',
                  }}
                >
                  <div
                    className='px-6 py-4 flex items-center justify-between border-b'
                    style={{ borderColor: 'var(--color-background-accent)' }}
                  >
                    <h3
                      className='text-xl font-bold'
                      style={{ color: 'var(--color-text)' }}
                    >
                      {editModalItems[editIngredientItemIndex]?.product_name}
                    </h3>
                    <button
                      onClick={cancelEditIngredients}
                      className='flex justify-center items-center p-1 rounded-lg hover:opacity-80 transition-opacity'
                      style={{
                        backgroundColor: 'var(--color-background-accent)',
                      }}
                    >
                      <X size={20} style={{ color: 'var(--color-text)' }} />
                    </button>
                  </div>

                  <div className='p-6'>
                    <p
                      className='text-sm mb-4 opacity-70'
                      style={{ color: 'var(--color-text)' }}
                    >
                      Selecciona los ingredientes a quitar:
                    </p>

                    <div className='space-y-3 mb-6'>
                      {editIngredientsList.map((ingredient) => (
                        <button
                          key={ingredient.name}
                          onClick={() => toggleEditIngredient(ingredient.name)}
                          className='w-full flex items-center justify-between p-3 rounded-lg transition-all'
                          style={{
                            backgroundColor: ingredient.removed
                              ? 'var(--color-primary)'
                              : 'var(--color-background)',
                            color: ingredient.removed
                              ? 'var(--color-on-primary)'
                              : 'var(--color-text)',
                          }}
                        >
                          <span
                            className={ingredient.removed ? 'line-through' : ''}
                          >
                            {ingredient.name}
                          </span>
                          {ingredient.removed && (
                            <span className='text-sm font-semibold'>SIN</span>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className='flex gap-3'>
                      <button
                        onClick={cancelEditIngredients}
                        className='flex-1 py-3 rounded-lg font-bold'
                        style={{
                          backgroundColor: 'var(--color-background-accent)',
                          color: 'var(--color-text)',
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={confirmEditIngredients}
                        className='flex-1 py-3 rounded-lg font-bold'
                        style={{
                          backgroundColor: 'var(--color-accent)',
                          color: 'var(--color-on-accent)',
                        }}
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
        ) : activeCombo ? (
          <div className='opacity-80 rotate-3 scale-105 shadow-2xl'>
            <button
              className='w-full p-6 rounded-lg'
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-on-accent)',
              }}
            >
              <div className='text-lg font-bold mb-2'>{activeCombo.name}</div>
              <div className='text-2xl font-bold mb-1'>
                {activeCombo.price_type === 'fixed'
                  ? formatPrice(activeCombo.fixed_price || 0)
                  : activeCombo.discount_type === 'percentage'
                  ? `-${activeCombo.discount_value}%`
                  : `-${formatPrice(activeCombo.discount_value || 0)}`}
              </div>
              <div className='text-sm opacity-90'>COMBO</div>
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
