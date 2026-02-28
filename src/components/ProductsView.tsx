import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Package,
  Beef,
  Download,
  Layers,
  Eye,
  EyeOff,
  Power,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProducts } from '../hooks/useProducts';
import { useMateriaPrima } from '../hooks/useMateriaPrima';
import { Product, AppSettings, db } from '../lib/indexeddb';
import { formatPrice, formatNumber } from '../lib/utils';
import { CombosView } from './CombosView';

export function ProductsView() {
  const [activeTab, setActiveTab] = useState<'products' | 'combos'>('products');
  const { products, addProduct, updateProduct, deleteProduct, loading } =
    useProducts();
  const {
    materiaPrima,
    getProductMateriaPrima,
    getProductMateriaPrimaCached,
    setProductMateriaPrima,
    calculateProductCost,
    calculateAvailableStock,
    productMPCache,
  } = useMateriaPrima();
  const [productStocks, setProductStocks] = useState<Record<string, number>>(
    {}
  );
  const [productMinPrices, setProductMinPrices] = useState<
    Record<string, number>
  >({});
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    production_cost: '',
    stock: '',
    category: 'hamburguesas',
    active: true,
    uses_materia_prima: false,
  });
  const [materiaPrimaItems, setMateriaPrimaItems] = useState<
    Array<{
      materia_prima_id: string;
      quantity: string;
      removable: boolean;
      is_variable: boolean;
      min_quantity: string;
      max_quantity: string;
      default_quantity: string;
      price_per_unit: string;
      linked_to: string;
      linked_multiplier: string;
    }>
  >([]);

  const categories = [
    { value: 'hamburguesas', label: 'Hamburguesas' },
    { value: 'papas fritas', label: 'Papas Fritas' },
    { value: 'bebidas', label: 'Bebidas' },
  ];

  // Sub-tab for product categories
  const [activeCategory, setActiveCategory] = useState<string>('hamburguesas');

  // Hidden categories (not shown in POS)
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);

  // Load hidden categories from IndexedDB
  useEffect(() => {
    const load = async () => {
      try {
        await db.init();
        const settings = await db.get<AppSettings>('app_settings', 'default');
        if (settings?.hidden_categories) {
          setHiddenCategories(settings.hidden_categories);
        }
      } catch (error) {
        console.error('Error loading hidden categories:', error);
      }
    };
    load();
  }, []);

  // Toggle category visibility in POS
  const toggleCategoryVisibility = useCallback(async (categoryValue: string) => {
    try {
      await db.init();
      const settings = await db.get<AppSettings>('app_settings', 'default');
      const current = settings?.hidden_categories || [];
      const updated = current.includes(categoryValue)
        ? current.filter((c) => c !== categoryValue)
        : [...current, categoryValue];

      const updatedSettings: AppSettings = {
        ...(settings || { id: 'default', pos_layout_locked: false, updated_at: new Date().toISOString() }),
        hidden_categories: updated,
        updated_at: new Date().toISOString(),
      };
      await db.put('app_settings', updatedSettings);
      setHiddenCategories(updated);
      toast.success(
        updated.includes(categoryValue)
          ? `Categoría oculta en POS`
          : `Categoría visible en POS`
      );
    } catch (error) {
      console.error('Error toggling category visibility:', error);
      toast.error('Error al cambiar visibilidad');
    }
  }, []);

  useEffect(() => {
    if (!products.length) {
      setProductStocks({});
      return;
    }

    const loadStocks = async () => {
      const materiaPrimaProducts = products.filter((p) => p.uses_materia_prima);

      if (!materiaPrimaProducts.length) {
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
    };

    loadStocks();
  }, [products, calculateAvailableStock]);

  // Calculate minimum sale prices (base price + min variable ingredient prices)
  useEffect(() => {
    if (!products.length || productMPCache.size === 0) {
      setProductMinPrices({});
      return;
    }

    const minPrices: Record<string, number> = {};
    for (const product of products) {
      if (!product.uses_materia_prima) continue;

      const links = getProductMateriaPrimaCached(product.id);
      let additionalPrice = 0;

      for (const link of links) {
        if (link.is_variable && link.min_quantity && link.price_per_unit) {
          additionalPrice += link.min_quantity * link.price_per_unit;
        }
      }

      if (additionalPrice > 0) {
        minPrices[product.id] = product.price + additionalPrice;
      }
    }

    setProductMinPrices(minPrices);
  }, [products, productMPCache, getProductMateriaPrimaCached]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const usesMateriaPrima = formData.uses_materia_prima;
      const productionCost = parseFloat(formData.production_cost);

      if (usesMateriaPrima && materiaPrimaItems.length === 0) {
        toast.error('Agregá al menos un ingrediente de materia prima');
        return;
      }

      let productId = editingId;

      if (editingId) {
        await updateProduct(editingId, {
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          production_cost: usesMateriaPrima ? 0 : productionCost,
          stock: usesMateriaPrima ? 0 : parseInt(formData.stock),
          category: formData.category,
          active: formData.active,
          uses_materia_prima: usesMateriaPrima,
        } as Partial<Product>);
      } else {
        const newProduct = await addProduct({
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          production_cost: usesMateriaPrima ? 0 : productionCost,
          stock: usesMateriaPrima ? 0 : parseInt(formData.stock || '0'),
          category: formData.category,
          active: formData.active,
          uses_materia_prima: usesMateriaPrima,
        });
        productId = newProduct;
      }

      if (usesMateriaPrima && productId) {
        const items = materiaPrimaItems.map((item) => ({
          materia_prima_id: item.materia_prima_id,
          quantity: parseFloat(item.quantity || '0'),
          removable: item.removable,
          is_variable: item.is_variable,
          min_quantity: item.is_variable ? parseFloat(item.min_quantity) : undefined,
          max_quantity: item.is_variable ? parseFloat(item.max_quantity) : undefined,
          default_quantity: item.is_variable ? parseFloat(item.default_quantity) : undefined,
          price_per_unit: item.is_variable ? parseFloat(item.price_per_unit) : undefined,
          linked_to: item.linked_to || undefined,
          linked_multiplier: item.linked_to ? parseFloat(item.linked_multiplier) : undefined,
        }));
        await setProductMateriaPrima(productId, items);

        const cost = await calculateProductCost(productId);
        await updateProduct(productId, { production_cost: cost });
      }

      setFormData({
        name: '',
        description: '',
        price: '',
        production_cost: '',
        stock: '',
        category: 'hamburguesas',
        active: true,
        uses_materia_prima: false,
      });
      setMateriaPrimaItems([]);
      setShowForm(false);
      setEditingId(null);
      toast.success(
        editingId
          ? 'Producto actualizado exitosamente'
          : 'Producto agregado exitosamente'
      );
    } catch (error) {
      toast.error('Error al guardar el producto');
      console.error(error);
    }
  };

  const handleEdit = async (product: Product) => {
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      production_cost: product.production_cost.toString(),
      stock: product.stock.toString(),
      category: product.category,
      active: product.active,
      uses_materia_prima: product.uses_materia_prima || false,
    });
    setEditingId(product.id);

    if (product.uses_materia_prima) {
      const items = await getProductMateriaPrima(product.id);
      setMateriaPrimaItems(
        items.map((item) => ({
          materia_prima_id: item.materia_prima_id,
          quantity: (item.quantity ?? 0).toString(),
          removable: item.removable ?? true,
          is_variable: item.is_variable ?? false,
          min_quantity: (item.min_quantity ?? 1).toString(),
          max_quantity: (item.max_quantity ?? 5).toString(),
          default_quantity: (item.default_quantity ?? 1).toString(),
          price_per_unit: (item.price_per_unit ?? 0).toString(),
          linked_to: item.linked_to ?? '',
          linked_multiplier: (item.linked_multiplier ?? 1).toString(),
        }))
      );
    } else {
      setMateriaPrimaItems([]);
    }

    setShowForm(true);
  };

  const handleToggleActive = async (product: Product) => {
    try {
      await updateProduct(product.id, { active: !product.active });
      toast.success(product.active ? 'Producto desactivado' : 'Producto activado');
    } catch {
      toast.error('Error al cambiar estado');
    }
  };

  const handleDelete = async (id: string) => {
    toast('Eliminar Producto', {
      description: '¿Estás seguro de que deseas eliminar este producto?',
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await deleteProduct(id);
            toast.success('Producto eliminado exitosamente');
          } catch (error) {
            toast.error('Error al eliminar el producto');
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

  const handleCancel = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      production_cost: '',
      stock: '',
      category: 'hamburguesas',
      active: true,
      uses_materia_prima: false,
    });
    setMateriaPrimaItems([]);
    setShowForm(false);
    setEditingId(null);
  };

  const exportProductsForWeb = async () => {
    try {
      const exportData = await Promise.all(
        products
          .filter((p) => p.active)
          .map(async (p) => {
            let ingredients: Array<{
              id: string;
              name: string;
              is_variable?: boolean;
              min_quantity?: number;
              max_quantity?: number;
              default_quantity?: number;
              price_per_unit?: number;
            }> = [];

            if (p.uses_materia_prima) {
              const productIngredients = await getProductMateriaPrima(p.id);
              ingredients = productIngredients
                .filter((i) => i.removable || i.is_variable)
                .map((i) => {
                  const mp = materiaPrima.find(
                    (m) => m.id === i.materia_prima_id
                  );
                  const base = {
                    id: i.materia_prima_id,
                    name: mp?.name || 'Desconocido',
                  };

                  // Include variable ingredient fields if applicable
                  if (i.is_variable) {
                    return {
                      ...base,
                      is_variable: true,
                      min_quantity: i.min_quantity ?? 1,
                      max_quantity: i.max_quantity ?? 5,
                      default_quantity: i.default_quantity ?? 1,
                      price_per_unit: i.price_per_unit ?? 0,
                    };
                  }

                  return base;
                });
            }

            return {
              id: p.id,
              name: p.name,
              description: p.description || '',
              price: p.price,
              category: p.category,
              ingredients,
            };
          })
      );

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'products.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Productos exportados exitosamente');
    } catch (error) {
      console.error('Error exporting products:', error);
      toast.error('Error al exportar productos');
    }
  };

  const addMateriaPrimaItem = () => {
    setMateriaPrimaItems([
      ...materiaPrimaItems,
      {
        materia_prima_id: '',
        quantity: '',
        removable: true,
        is_variable: false,
        min_quantity: '1',
        max_quantity: '5',
        default_quantity: '1',
        price_per_unit: '',
        linked_to: '',
        linked_multiplier: '1',
      },
    ]);
  };

  const removeMateriaPrimaItem = (index: number) => {
    setMateriaPrimaItems(materiaPrimaItems.filter((_, i) => i !== index));
  };

  const updateMateriaPrimaItem = (
    index: number,
    field:
      | 'materia_prima_id'
      | 'quantity'
      | 'removable'
      | 'is_variable'
      | 'min_quantity'
      | 'max_quantity'
      | 'default_quantity'
      | 'price_per_unit'
      | 'linked_to'
      | 'linked_multiplier',
    value: string | boolean
  ) => {
    const updated = [...materiaPrimaItems];
    if (field === 'removable' || field === 'is_variable') {
      updated[index][field] = value as boolean;
      // Clear linked fields when changing to variable
      if (field === 'is_variable' && value === true) {
        updated[index].linked_to = '';
        updated[index].linked_multiplier = '1';
      }
    } else {
      updated[index][field] = value as string;
    }
    setMateriaPrimaItems(updated);
  };

  if (loading) {
    return <div className='p-6 dark:text-white'>Cargando...</div>;
  }

  // Tab selector
  const TabSelector = () => (
    <div
      className='flex gap-1 p-1 rounded-lg mb-6'
      style={{ backgroundColor: 'var(--color-background-accent)' }}
    >
      <button
        onClick={() => setActiveTab('products')}
        className='flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors'
        style={{
          backgroundColor:
            activeTab === 'products' ? 'var(--color-primary)' : 'transparent',
          color:
            activeTab === 'products'
              ? 'var(--color-on-primary)'
              : 'var(--color-text)',
        }}
      >
        <Package size={18} />
        Productos
      </button>
      <button
        onClick={() => setActiveTab('combos')}
        className='flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors'
        style={{
          backgroundColor:
            activeTab === 'combos' ? 'var(--color-primary)' : 'transparent',
          color:
            activeTab === 'combos'
              ? 'var(--color-on-primary)'
              : 'var(--color-text)',
        }}
      >
        <Layers size={18} />
        Combos
      </button>
    </div>
  );

  // Show CombosView if combos tab is active
  if (activeTab === 'combos') {
    return (
      <div className='p-6'>
        <TabSelector />
        <CombosView />
      </div>
    );
  }

  return (
    <div className='p-6'>
      <TabSelector />
      <div className='flex justify-between items-center mb-6'>
        <div className='mb-6'>
          <h1
            className='text-3xl font-bold flex items-center gap-3'
            style={{ color: 'var(--color-text)' }}
          >
            <Package style={{ color: 'var(--color-primary)' }} />
            Productos
          </h1>
          <p className='opacity-60 mt-2' style={{ color: 'var(--color-text)' }}>
            Administrá tu catálogo de productos, precios y categorías
          </p>
        </div>
        {!showForm && (
          <div className='flex gap-2'>
            <button
              onClick={exportProductsForWeb}
              className='flex items-center gap-2 px-4 py-2 rounded-lg font-semibold'
              style={{
                backgroundColor: 'var(--color-background-accent)',
                color: 'var(--color-text)',
              }}
              title='Exportar productos para la web de clientes'
            >
              <Download size={20} />
              Exportar Web
            </button>
            <button
              onClick={() => {
                setFormData({ ...formData, category: activeCategory });
                setShowForm(true);
              }}
              className='flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold'
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
              }}
            >
              <Plus size={20} />
              Añadir Producto
            </button>
          </div>
        )}
      </div>

      {/* Category sub-tabs */}
      <div className='flex items-center gap-2 mb-4'>
        <div
          className='flex gap-1 p-1 rounded-lg flex-1'
          style={{ backgroundColor: 'var(--color-background-accent)' }}
        >
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className='flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors text-sm'
              style={{
                backgroundColor:
                  activeCategory === cat.value
                    ? 'var(--color-primary)'
                    : 'transparent',
                color:
                  activeCategory === cat.value
                    ? 'var(--color-on-primary)'
                    : 'var(--color-text)',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {/* Visibility toggle for the active category */}
        <button
          onClick={() => toggleCategoryVisibility(activeCategory)}
          className='flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors'
          style={{
            backgroundColor: hiddenCategories.includes(activeCategory)
              ? 'var(--color-background-accent)'
              : 'var(--color-primary)',
            color: hiddenCategories.includes(activeCategory)
              ? 'var(--color-text)'
              : 'var(--color-on-primary)',
          }}
          title={
            hiddenCategories.includes(activeCategory)
              ? 'Oculto en POS — clic para mostrar'
              : 'Visible en POS — clic para ocultar'
          }
        >
          {hiddenCategories.includes(activeCategory) ? (
            <EyeOff size={16} />
          ) : (
            <Eye size={16} />
          )}
          {hiddenCategories.includes(activeCategory)
            ? 'Oculto en POS'
            : 'Visible en POS'}
        </button>
      </div>

      {showForm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
          <div
            className='w-full max-w-2xl max-h-[90vh] overflow-auto rounded-xl shadow-2xl p-6 mx-4'
            style={{ backgroundColor: 'var(--color-background-secondary)' }}
          >
            <h2
              className='text-xl font-bold mb-4'
              style={{ color: 'var(--color-text)' }}
            >
              {editingId ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            <form onSubmit={handleSubmit} className='space-y-4'>
              <div>
                <label
                  className='block text-sm font-medium mb-1'
                  style={{ color: 'var(--color-text)' }}
                >
                  Nombre
                </label>
                <input
                  type='text'
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className='w-full px-3 py-2 border rounded-lg'
                  style={{
                    backgroundColor: 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                    borderColor: 'var(--color-text)',
                  }}
                />
              </div>

              <div>
                <label
                  className='block text-sm font-medium mb-1'
                  style={{ color: 'var(--color-text)' }}
                >
                  Descripción (opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                  placeholder='Descripción del producto para la tienda web...'
                  className='w-full px-3 py-2 border rounded-lg resize-none'
                  style={{
                    backgroundColor: 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                    borderColor: 'var(--color-text)',
                  }}
                />
              </div>

              <div className='flex items-center gap-2'>
                <input
                  type='checkbox'
                  id='uses_materia_prima'
                  checked={formData.uses_materia_prima}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      uses_materia_prima: e.target.checked,
                    });
                    if (!e.target.checked) {
                      setMateriaPrimaItems([]);
                    }
                  }}
                  className='w-4 h-4'
                />
                <label
                  htmlFor='uses_materia_prima'
                  className='text-sm font-medium'
                  style={{ color: 'var(--color-text)' }}
                >
                  Usa Materia Prima (el costo se calculará automáticamente)
                </label>
              </div>

              {formData.uses_materia_prima && (
                <div
                  className='border rounded-lg p-4'
                  style={{ borderColor: 'var(--color-text)' }}
                >
                  <div className='flex justify-between items-center mb-3'>
                    <h3
                      className='font-semibold'
                      style={{ color: 'var(--color-text)' }}
                    >
                      Ingredientes de Materia Prima
                    </h3>
                    <button
                      type='button'
                      onClick={addMateriaPrimaItem}
                      className='flex items-center gap-1 px-3 py-1 rounded text-sm text-white'
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      <Plus size={16} />
                      Agregar
                    </button>
                  </div>

                  {materiaPrimaItems.length === 0 ? (
                    <p
                      className='text-sm opacity-60'
                      style={{ color: 'var(--color-text)' }}
                    >
                      No hay ingredientes. Hacé clic en "Agregar" para añadir.
                    </p>
                  ) : (
                    <div className='space-y-3'>
                      {materiaPrimaItems.map((item, index) => (
                        <div
                          key={index}
                          className='p-3 rounded-lg border'
                          style={{
                            backgroundColor: 'var(--color-background-accent)',
                            borderColor: item.is_variable
                              ? 'var(--color-primary)'
                              : 'transparent',
                          }}
                        >
                          <div className='flex gap-2 items-center'>
                            <select
                              value={item.materia_prima_id}
                              onChange={(e) =>
                                updateMateriaPrimaItem(
                                  index,
                                  'materia_prima_id',
                                  e.target.value
                                )
                              }
                              required
                              className='flex-1 px-3 py-2 border rounded-lg'
                              style={{
                                backgroundColor:
                                  'var(--color-background-secondary)',
                                color: 'var(--color-text)',
                                borderColor: 'var(--color-text)',
                              }}
                            >
                              <option value=''>Seleccionar ingrediente</option>
                              {materiaPrima.map((mp) => (
                                <option key={mp.id} value={mp.id}>
                                  {mp.name} (
                                  {mp.unit === 'units' ? 'unidades' : 'kg'})
                                </option>
                              ))}
                            </select>
                            <input
                              type='number'
                              step='0.001'
                              required={!item.is_variable}
                              disabled={item.is_variable}
                              value={item.is_variable ? '' : item.quantity}
                              onChange={(e) =>
                                updateMateriaPrimaItem(
                                  index,
                                  'quantity',
                                  e.target.value
                                )
                              }
                              placeholder={
                                item.is_variable ? 'Variable' : 'Cantidad'
                              }
                              className='w-28 px-3 py-2 border rounded-lg'
                              style={{
                                backgroundColor: item.is_variable
                                  ? 'var(--color-background-accent)'
                                  : 'var(--color-background-secondary)',
                                color: 'var(--color-text)',
                                borderColor: 'var(--color-text)',
                                opacity: item.is_variable ? 0.5 : 1,
                              }}
                            />
                            <label
                              className='flex items-center gap-1 px-2 cursor-pointer'
                              title='Puede quitarse en POS'
                            >
                              <input
                                type='checkbox'
                                checked={item.removable}
                                onChange={(e) =>
                                  updateMateriaPrimaItem(
                                    index,
                                    'removable',
                                    e.target.checked
                                  )
                                }
                                className='w-4 h-4'
                              />
                              <span
                                className='text-xs whitespace-nowrap'
                                style={{ color: 'var(--color-text)' }}
                              >
                                Removible
                              </span>
                            </label>
                            <button
                              type='button'
                              onClick={() => removeMateriaPrimaItem(index)}
                              className='px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600'
                            >
                              <X size={18} />
                            </button>
                          </div>

                          {/* Variable quantity toggle */}
                          <div className='mt-2 flex items-center gap-2'>
                            <input
                              type='checkbox'
                              id={`variable_${index}`}
                              checked={item.is_variable}
                              onChange={(e) =>
                                updateMateriaPrimaItem(
                                  index,
                                  'is_variable',
                                  e.target.checked
                                )
                              }
                              className='w-4 h-4'
                            />
                            <label
                              htmlFor={`variable_${index}`}
                              className='text-sm font-medium'
                              style={{ color: 'var(--color-text)' }}
                            >
                              Cantidad Variable (cliente elige al comprar)
                            </label>
                          </div>

                          {/* Variable quantity options */}
                          {item.is_variable && (
                            <div className='mt-3 grid grid-cols-2 md:grid-cols-4 gap-2'>
                              <div>
                                <label
                                  className='block text-xs opacity-70 mb-1'
                                  style={{ color: 'var(--color-text)' }}
                                >
                                  Mínimo
                                </label>
                                <input
                                  type='number'
                                  step='1'
                                  min='0'
                                  required
                                  value={item.min_quantity}
                                  onChange={(e) =>
                                    updateMateriaPrimaItem(
                                      index,
                                      'min_quantity',
                                      e.target.value
                                    )
                                  }
                                  className='w-full px-2 py-1 border rounded-lg text-sm'
                                  style={{
                                    backgroundColor:
                                      'var(--color-background-secondary)',
                                    color: 'var(--color-text)',
                                    borderColor: 'var(--color-text)',
                                  }}
                                />
                              </div>
                              <div>
                                <label
                                  className='block text-xs opacity-70 mb-1'
                                  style={{ color: 'var(--color-text)' }}
                                >
                                  Máximo
                                </label>
                                <input
                                  type='number'
                                  step='1'
                                  min='1'
                                  required
                                  value={item.max_quantity}
                                  onChange={(e) =>
                                    updateMateriaPrimaItem(
                                      index,
                                      'max_quantity',
                                      e.target.value
                                    )
                                  }
                                  className='w-full px-2 py-1 border rounded-lg text-sm'
                                  style={{
                                    backgroundColor:
                                      'var(--color-background-secondary)',
                                    color: 'var(--color-text)',
                                    borderColor: 'var(--color-text)',
                                  }}
                                />
                              </div>
                              <div>
                                <label
                                  className='block text-xs opacity-70 mb-1'
                                  style={{ color: 'var(--color-text)' }}
                                >
                                  Por defecto
                                </label>
                                <input
                                  type='number'
                                  step='1'
                                  min='0'
                                  required
                                  value={item.default_quantity}
                                  onChange={(e) =>
                                    updateMateriaPrimaItem(
                                      index,
                                      'default_quantity',
                                      e.target.value
                                    )
                                  }
                                  className='w-full px-2 py-1 border rounded-lg text-sm'
                                  style={{
                                    backgroundColor:
                                      'var(--color-background-secondary)',
                                    color: 'var(--color-text)',
                                    borderColor: 'var(--color-text)',
                                  }}
                                />
                              </div>
                              <div>
                                <label
                                  className='block text-xs opacity-70 mb-1'
                                  style={{ color: 'var(--color-text)' }}
                                >
                                  Precio/unidad ($)
                                </label>
                                <input
                                  type='number'
                                  step='0.01'
                                  min='0'
                                  required
                                  value={item.price_per_unit}
                                  onChange={(e) =>
                                    updateMateriaPrimaItem(
                                      index,
                                      'price_per_unit',
                                      e.target.value
                                    )
                                  }
                                  className='w-full px-2 py-1 border rounded-lg text-sm'
                                  style={{
                                    backgroundColor:
                                      'var(--color-background-secondary)',
                                    color: 'var(--color-text)',
                                    borderColor: 'var(--color-text)',
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Linked ingredient options (only for non-variable items) */}
                          {!item.is_variable && (
                            <>
                              <div className='mt-2 flex items-center gap-2'>
                                <label
                                  className='text-sm font-medium'
                                  style={{ color: 'var(--color-text)' }}
                                >
                                  Vincular a ingrediente variable:
                                </label>
                                <select
                                  value={item.linked_to}
                                  onChange={(e) =>
                                    updateMateriaPrimaItem(
                                      index,
                                      'linked_to',
                                      e.target.value
                                    )
                                  }
                                  className='flex-1 px-2 py-1 border rounded-lg text-sm'
                                  style={{
                                    backgroundColor:
                                      'var(--color-background-secondary)',
                                    color: 'var(--color-text)',
                                    borderColor: 'var(--color-text)',
                                  }}
                                >
                                  <option value=''>Sin vincular</option>
                                  {materiaPrimaItems
                                    .filter(
                                      (otherItem, otherIndex) =>
                                        otherItem.is_variable &&
                                        otherIndex !== index &&
                                        otherItem.materia_prima_id
                                    )
                                    .map((varItem) => {
                                      const mp = materiaPrima.find(
                                        (m) =>
                                          m.id === varItem.materia_prima_id
                                      );
                                      return (
                                        <option
                                          key={varItem.materia_prima_id}
                                          value={varItem.materia_prima_id}
                                        >
                                          {mp?.name || 'Desconocido'}
                                        </option>
                                      );
                                    })}
                                </select>
                              </div>

                              {item.linked_to && (
                                <div className='mt-2 grid grid-cols-2 gap-4'>
                                  <div>
                                    <label
                                      className='block text-sm mb-1'
                                      style={{ color: 'var(--color-text)' }}
                                    >
                                      Multiplicador:
                                    </label>
                                    <input
                                      type='number'
                                      step='0.1'
                                      min='0.1'
                                      required
                                      value={item.linked_multiplier}
                                      onChange={(e) =>
                                        updateMateriaPrimaItem(
                                          index,
                                          'linked_multiplier',
                                          e.target.value
                                        )
                                      }
                                      className='w-full px-2 py-1 border rounded-lg text-sm'
                                      style={{
                                        backgroundColor:
                                          'var(--color-background-secondary)',
                                        color: 'var(--color-text)',
                                        borderColor: 'var(--color-text)',
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label
                                      className='block text-sm mb-1'
                                      style={{ color: 'var(--color-text)' }}
                                    >
                                      Offset (ej: -1):
                                    </label>
                                    <input
                                      type='number'
                                      step='1'
                                      value={item.quantity}
                                      onChange={(e) =>
                                        updateMateriaPrimaItem(
                                          index,
                                          'quantity',
                                          e.target.value
                                        )
                                      }
                                      className='w-full px-2 py-1 border rounded-lg text-sm'
                                      style={{
                                        backgroundColor:
                                          'var(--color-background-secondary)',
                                        color: 'var(--color-text)',
                                        borderColor: 'var(--color-text)',
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label
                    className='block text-sm font-medium mb-1'
                    style={{ color: 'var(--color-text)' }}
                  >
                    Precio de Venta ($)
                  </label>
                  <input
                    type='number'
                    step='0.01'
                    required
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    className='w-full px-3 py-2 border rounded-lg'
                    style={{
                      backgroundColor: 'var(--color-background-accent)',
                      color: 'var(--color-text)',
                      borderColor: 'var(--color-text)',
                    }}
                  />
                </div>

                {!formData.uses_materia_prima && (
                  <div>
                    <label
                      className='block text-sm font-medium mb-1'
                      style={{ color: 'var(--color-text)' }}
                    >
                      Costo ($)
                    </label>
                    <input
                      type='number'
                      step='0.01'
                      required
                      value={formData.production_cost}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          production_cost: e.target.value,
                        })
                      }
                      className='w-full px-3 py-2 border rounded-lg'
                      style={{
                        backgroundColor: 'var(--color-background-accent)',
                        color: 'var(--color-text)',
                        borderColor: 'var(--color-text)',
                      }}
                    />
                  </div>
                )}
              </div>

              {!formData.uses_materia_prima && (
                <div>
                  <label
                    className='block text-sm font-medium mb-1'
                    style={{ color: 'var(--color-text)' }}
                  >
                    Stock
                  </label>
                  <input
                    type='number'
                    required
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData({ ...formData, stock: e.target.value })
                    }
                    className='w-full px-3 py-2 border rounded-lg'
                    style={{
                      backgroundColor: 'var(--color-background-accent)',
                      color: 'var(--color-text)',
                      borderColor: 'var(--color-text)',
                    }}
                  />
                </div>
              )}
              {formData.uses_materia_prima && (
                <div
                  className='p-3 rounded-lg'
                  style={{
                    backgroundColor: 'var(--color-background-accent)',
                    borderColor: 'var(--color-text)',
                  }}
                >
                  <p
                    className='text-sm opacity-80'
                    style={{ color: 'var(--color-text)' }}
                  >
                    El stock de este producto se calcula automáticamente según
                    la disponibilidad de materia prima.
                  </p>
                </div>
              )}

              <div>
                <label
                  className='block text-sm font-medium mb-1'
                  style={{ color: 'var(--color-text)' }}
                >
                  Categoría
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className='w-full px-3 py-2 border rounded-lg'
                  style={{
                    backgroundColor: 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                    borderColor: 'var(--color-text)',
                  }}
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-2'>
                <input
                  type='checkbox'
                  id='active'
                  checked={formData.active}
                  onChange={(e) =>
                    setFormData({ ...formData, active: e.target.checked })
                  }
                  className='w-4 h-4'
                />
                <label
                  htmlFor='active'
                  className='text-sm font-medium'
                  style={{ color: 'var(--color-text)' }}
                >
                  Activo
                </label>
              </div>

              <div className='flex gap-2'>
                <button
                  type='submit'
                  className='flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold'
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                  }}
                >
                  <Save size={18} />
                  {editingId ? 'Actualizar' : 'Guardar'}
                </button>
                <button
                  type='button'
                  onClick={handleCancel}
                  className='flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-600 dark:text-white font-semibold'
                >
                  <X size={18} />
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {products.filter((p) => p.category === activeCategory).length === 0 ? (
        <div
          className='text-center py-12 rounded-lg'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <Package
            size={48}
            className='mx-auto mb-4 opacity-40'
            style={{ color: 'var(--color-text)' }}
          />
          <p
            className='text-lg opacity-60'
            style={{ color: 'var(--color-text)' }}
          >
            No hay productos en esta categoría
          </p>
          <p
            className='text-sm opacity-40 mt-2'
            style={{ color: 'var(--color-text)' }}
          >
            Puedes empezar a agregarlos para verlos aquí
          </p>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {products.filter((p) => p.category === activeCategory).map((product) => (
            <div
              key={product.id}
              className='rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow border-2 relative'
              style={{
                backgroundColor: 'var(--color-background-secondary)',
                borderColor: 'var(--color-primary)',
              }}
            >
              {product.uses_materia_prima && (
                <div
                  className='absolute top-3 right-3 p-1.5 rounded-lg'
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    opacity: 0.9,
                  }}
                  title='Usa Materia Prima'
                >
                  <Beef
                    size={16}
                    style={{ color: 'var(--color-on-primary)' }}
                  />
                </div>
              )}
              <div className='mb-3'>
                <h3
                  className='text-lg font-bold'
                  style={{ color: 'var(--color-text)' }}
                >
                  {product.name}
                </h3>
                <p
                  className='text-sm opacity-60 capitalize'
                  style={{ color: 'var(--color-text)' }}
                >
                  {product.category}
                </p>
              </div>

              <div className='space-y-1'>
                <div className='flex justify-between'>
                  <span
                    className='text-sm opacity-60'
                    style={{ color: 'var(--color-text)' }}
                  >
                    Precio de Venta:
                  </span>
                  <span
                    className='font-bold'
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatPrice(
                      productMinPrices[product.id] || product.price
                    )}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span
                    className='text-sm opacity-60'
                    style={{ color: 'var(--color-text)' }}
                  >
                    Costo:
                  </span>
                  <span
                    className='font-bold opacity-60'
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatPrice(product.production_cost)}
                    {product.uses_materia_prima && (
                      <span className='text-xs ml-1'>(auto)</span>
                    )}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span
                    className='text-sm opacity-60'
                    style={{ color: 'var(--color-text)' }}
                  >
                    Margen:
                  </span>
                  <span
                    className='font-bold'
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {formatPrice(
                      (productMinPrices[product.id] || product.price) -
                        product.production_cost
                    )}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span
                    className='text-sm opacity-60'
                    style={{ color: 'var(--color-text)' }}
                  >
                    Stock:
                  </span>
                  <span
                    className='font-bold'
                    style={{
                      color: (
                        product.uses_materia_prima
                          ? (productStocks[product.id] || 0) < 10
                          : product.stock < 10
                      )
                        ? '#ef4444'
                        : 'var(--color-text)',
                    }}
                  >
                    {product.uses_materia_prima
                      ? `${formatNumber(productStocks[product.id] || 0)} (auto)`
                      : formatNumber(product.stock)}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span
                    className='text-sm opacity-60'
                    style={{ color: 'var(--color-text)' }}
                  >
                    Estado:
                  </span>
                  <span
                    className='font-semibold'
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {product.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>

              <div className='flex gap-2 mt-4'>
                <button
                  onClick={() => handleEdit(product)}
                  className='flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all font-medium text-sm hover:opacity-80'
                  style={{
                    backgroundColor: 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                  }}
                >
                  <Edit2 size={14} />
                  Editar
                </button>
                <button
                  onClick={() => handleToggleActive(product)}
                  className='flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all font-medium text-sm hover:opacity-80'
                  style={{
                    backgroundColor: product.active
                      ? 'var(--color-background-accent)'
                      : 'var(--color-primary)',
                    color: product.active
                      ? 'var(--color-text)'
                      : 'var(--color-on-primary)',
                  }}
                >
                  <Power size={14} />
                  {product.active ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className='flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all font-medium text-sm hover:opacity-80'
                  style={{
                    backgroundColor: 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                  }}
                >
                  <Trash2 size={14} />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
