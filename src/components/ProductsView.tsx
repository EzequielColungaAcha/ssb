import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useProducts } from '../hooks/useProducts';
import { useMateriaPrima } from '../hooks/useMateriaPrima';
import { Product } from '../lib/indexeddb';
import { formatPrice, formatNumber } from '../lib/utils';

export function ProductsView() {
  const { products, addProduct, updateProduct, deleteProduct, loading } =
    useProducts();
  const {
    materiaPrima,
    getProductMateriaPrima,
    setProductMateriaPrima,
    calculateProductCost,
    calculateAvailableStock,
  } = useMateriaPrima();
  const [productStocks, setProductStocks] = useState<Record<string, number>>(
    {}
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    production_cost: '',
    stock: '',
    category: 'hamburguesas',
    active: true,
    uses_materia_prima: false,
  });
  const [materiaPrimaItems, setMateriaPrimaItems] = useState<
    Array<{ materia_prima_id: string; quantity: string }>
  >([]);

  const categories = [
    { value: 'hamburguesas', label: 'Hamburguesas' },
    { value: 'papas fritas', label: 'Papas Fritas' },
    { value: 'bebidas', label: 'Bebidas' },
  ];

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
          quantity: parseFloat(item.quantity),
        }));
        await setProductMateriaPrima(productId, items);

        const cost = await calculateProductCost(productId);
        await updateProduct(productId, { production_cost: cost });
      }

      setFormData({
        name: '',
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
          quantity: item.quantity.toString(),
        }))
      );
    } else {
      setMateriaPrimaItems([]);
    }

    setShowForm(true);
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

  const addMateriaPrimaItem = () => {
    setMateriaPrimaItems([
      ...materiaPrimaItems,
      { materia_prima_id: '', quantity: '' },
    ]);
  };

  const removeMateriaPrimaItem = (index: number) => {
    setMateriaPrimaItems(materiaPrimaItems.filter((_, i) => i !== index));
  };

  const updateMateriaPrimaItem = (
    index: number,
    field: 'materia_prima_id' | 'quantity',
    value: string
  ) => {
    const updated = [...materiaPrimaItems];
    updated[index][field] = value;
    setMateriaPrimaItems(updated);
  };

  if (loading) {
    return <div className='p-6 dark:text-white'>Cargando...</div>;
  }

  return (
    <div className='p-6'>
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
          <button
            onClick={() => setShowForm(true)}
            className='flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold'
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <Plus size={20} />
            Añadir Producto
          </button>
        )}
      </div>

      {showForm && (
        <div
          className='rounded-lg shadow-md p-6 mb-6'
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
                  <div className='space-y-2'>
                    {materiaPrimaItems.map((item, index) => (
                      <div key={index} className='flex gap-2'>
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
                            backgroundColor: 'var(--color-background-accent)',
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
                          required
                          value={item.quantity}
                          onChange={(e) =>
                            updateMateriaPrimaItem(
                              index,
                              'quantity',
                              e.target.value
                            )
                          }
                          placeholder='Cantidad'
                          className='w-32 px-3 py-2 border rounded-lg'
                          style={{
                            backgroundColor: 'var(--color-background-accent)',
                            color: 'var(--color-text)',
                            borderColor: 'var(--color-text)',
                          }}
                        />
                        <button
                          type='button'
                          onClick={() => removeMateriaPrimaItem(index)}
                          className='px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600'
                        >
                          <X size={18} />
                        </button>
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
                  El stock de este producto se calcula automáticamente según la
                  disponibilidad de materia prima.
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
                style={{ backgroundColor: 'var(--color-primary)' }}
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
      )}

      {products.length === 0 ? (
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
            No hay productos registrados
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
          {products.map((product) => (
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
                  <Package size={16} className='text-white' />
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
                    {formatPrice(product.price)}
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
                    {formatPrice(product.price - product.production_cost)}
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
