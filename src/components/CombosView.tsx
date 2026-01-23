import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Package, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useCombo } from '../hooks/useCombo';
import { useProducts } from '../hooks/useProducts';
import { useMateriaPrima } from '../hooks/useMateriaPrima';
import { Combo, ComboSlot } from '../lib/indexeddb';
import { formatPrice } from '../lib/utils';

interface SlotFormData {
  id: string;
  name: string;
  is_dynamic: boolean;
  product_ids: string[];
  default_product_id: string;
  quantity: number;
}

export function CombosView() {
  const { combos, addCombo, updateCombo, deleteCombo, loading } = useCombo();
  const { products } = useProducts();
  const { getProductMateriaPrima, materiaPrima } = useMateriaPrima();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_type: 'fixed' as 'fixed' | 'calculated',
    fixed_price: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    active: true,
  });
  const [slots, setSlots] = useState<SlotFormData[]>([]);

  const activeProducts = products.filter((p) => p.active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (slots.length === 0) {
      toast.error('Agregá al menos un slot al combo');
      return;
    }

    for (const slot of slots) {
      if (slot.product_ids.length === 0) {
        toast.error(`El slot "${slot.name}" debe tener al menos un producto`);
        return;
      }
      if (!slot.default_product_id) {
        toast.error(
          `El slot "${slot.name}" debe tener un producto por defecto`
        );
        return;
      }
    }

    try {
      const comboSlots: ComboSlot[] = slots.map((s) => ({
        id: s.id,
        name: s.name,
        is_dynamic: s.is_dynamic,
        product_ids: s.product_ids,
        default_product_id: s.default_product_id,
        quantity: s.quantity,
      }));

      if (editingId) {
        await updateCombo(editingId, {
          name: formData.name,
          description: formData.description,
          price_type: formData.price_type,
          fixed_price:
            formData.price_type === 'fixed'
              ? parseFloat(formData.fixed_price)
              : undefined,
          discount_type:
            formData.price_type === 'calculated'
              ? formData.discount_type
              : undefined,
          discount_value:
            formData.price_type === 'calculated'
              ? parseFloat(formData.discount_value)
              : undefined,
          slots: comboSlots,
          active: formData.active,
        });
        toast.success('Combo actualizado exitosamente');
      } else {
        await addCombo({
          name: formData.name,
          description: formData.description,
          price_type: formData.price_type,
          fixed_price:
            formData.price_type === 'fixed'
              ? parseFloat(formData.fixed_price)
              : undefined,
          discount_type:
            formData.price_type === 'calculated'
              ? formData.discount_type
              : undefined,
          discount_value:
            formData.price_type === 'calculated'
              ? parseFloat(formData.discount_value)
              : undefined,
          slots: comboSlots,
          active: formData.active,
        });
        toast.success('Combo creado exitosamente');
      }

      handleCancel();
    } catch (error) {
      toast.error('Error al guardar el combo');
      console.error(error);
    }
  };

  const handleEdit = (combo: Combo) => {
    setFormData({
      name: combo.name,
      description: combo.description || '',
      price_type: combo.price_type,
      fixed_price: combo.fixed_price?.toString() || '',
      discount_type: combo.discount_type || 'percentage',
      discount_value: combo.discount_value?.toString() || '',
      active: combo.active,
    });
    setSlots(
      combo.slots.map((s) => ({
        id: s.id,
        name: s.name,
        is_dynamic: s.is_dynamic,
        product_ids: s.product_ids,
        default_product_id: s.default_product_id,
        quantity: s.quantity,
      }))
    );
    setEditingId(combo.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    toast('Eliminar Combo', {
      description: '¿Estás seguro de que deseas eliminar este combo?',
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await deleteCombo(id);
            toast.success('Combo eliminado exitosamente');
          } catch (error) {
            toast.error('Error al eliminar el combo');
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
      price_type: 'fixed',
      fixed_price: '',
      discount_type: 'percentage',
      discount_value: '',
      active: true,
    });
    setSlots([]);
    setShowForm(false);
    setEditingId(null);
  };

  const addSlot = () => {
    setSlots([
      ...slots,
      {
        id: crypto.randomUUID(),
        name: '',
        is_dynamic: false,
        product_ids: [],
        default_product_id: '',
        quantity: 1,
      },
    ]);
  };

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const updateSlot = (
    index: number,
    field: keyof SlotFormData,
    value: string | boolean | string[] | number
  ) => {
    const updated = [...slots];
    (updated[index] as unknown as Record<string, unknown>)[field] = value;

    // If changing products, ensure default is still valid
    if (field === 'product_ids') {
      const productIds = value as string[];
      if (!productIds.includes(updated[index].default_product_id)) {
        updated[index].default_product_id = productIds[0] || '';
      }
    }

    setSlots(updated);
  };

  const toggleProductInSlot = (index: number, productId: string) => {
    const slot = slots[index];
    const newProductIds = slot.product_ids.includes(productId)
      ? slot.product_ids.filter((id) => id !== productId)
      : [...slot.product_ids, productId];
    updateSlot(index, 'product_ids', newProductIds);
  };

  const exportCombosForWeb = async () => {
    try {
      const exportData = await Promise.all(
        combos
          .filter((c) => c.active)
          .map(async (combo) => {
            const slotsData = await Promise.all(
              combo.slots.map(async (slot) => {
                const slotProducts = await Promise.all(
                  slot.product_ids.map(async (productId) => {
                    const product = products.find((p) => p.id === productId);
                    if (!product) return null;

                    let ingredients: Array<{
                      id: string;
                      name: string;
                      is_variable?: boolean;
                      min_quantity?: number;
                      max_quantity?: number;
                      default_quantity?: number;
                      price_per_unit?: number;
                    }> = [];
                    if (product.uses_materia_prima) {
                      const productIngredients = await getProductMateriaPrima(
                        productId
                      );
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
                      id: product.id,
                      name: product.name,
                      price: product.price,
                      ingredients,
                    };
                  })
                );

                return {
                  id: slot.id,
                  name: slot.name,
                  is_dynamic: slot.is_dynamic,
                  quantity: slot.quantity,
                  default_product_id: slot.default_product_id,
                  products: slotProducts.filter(Boolean),
                };
              })
            );

            return {
              id: combo.id,
              name: combo.name,
              description: combo.description || '',
              price_type: combo.price_type,
              fixed_price: combo.fixed_price,
              discount_type: combo.discount_type,
              discount_value: combo.discount_value,
              slots: slotsData,
            };
          })
      );

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'combos.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Combos exportados exitosamente');
    } catch (error) {
      console.error('Error exporting combos:', error);
      toast.error('Error al exportar combos');
    }
  };

  const getProductName = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return product?.name || 'Producto no encontrado';
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
            Combos
          </h1>
          <p className='opacity-60 mt-2' style={{ color: 'var(--color-text)' }}>
            Creá combos de productos con descuentos
          </p>
        </div>
        {!showForm && (
          <div className='flex gap-2'>
            <button
              onClick={exportCombosForWeb}
              className='flex items-center gap-2 px-4 py-2 rounded-lg font-semibold'
              style={{
                backgroundColor: 'var(--color-background-accent)',
                color: 'var(--color-text)',
              }}
              title='Exportar combos para la web de clientes'
            >
              <Download size={20} />
              Exportar Web
            </button>
            <button
              onClick={() => setShowForm(true)}
              className='flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold'
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
              }}
            >
              <Plus size={20} />
              Nuevo Combo
            </button>
          </div>
        )}
      </div>

      {/* Combo Form Modal */}
      {showForm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
          <div
            className='w-full max-w-3xl max-h-[90vh] overflow-auto rounded-xl shadow-2xl p-6 mx-4'
            style={{ backgroundColor: 'var(--color-background-secondary)' }}
          >
            <h2
              className='text-xl font-bold mb-4'
              style={{ color: 'var(--color-text)' }}
            >
              {editingId ? 'Editar Combo' : 'Nuevo Combo'}
            </h2>
            <form onSubmit={handleSubmit} className='space-y-4'>
              {/* Name */}
              <div>
                <label
                  className='block text-sm font-medium mb-1'
                  style={{ color: 'var(--color-text)' }}
                >
                  Nombre del Combo
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
                  placeholder='Ej: Combo Familiar'
                />
              </div>

              {/* Description */}
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
                  className='w-full px-3 py-2 border rounded-lg resize-none'
                  style={{
                    backgroundColor: 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                    borderColor: 'var(--color-text)',
                  }}
                />
              </div>

              {/* Price Type */}
              <div>
                <label
                  className='block text-sm font-medium mb-2'
                  style={{ color: 'var(--color-text)' }}
                >
                  Tipo de Precio
                </label>
                <div className='flex gap-4'>
                  <label className='flex items-center gap-2 cursor-pointer'>
                    <input
                      type='radio'
                      name='price_type'
                      value='fixed'
                      checked={formData.price_type === 'fixed'}
                      onChange={() =>
                        setFormData({ ...formData, price_type: 'fixed' })
                      }
                      className='w-4 h-4'
                    />
                    <span style={{ color: 'var(--color-text)' }}>
                      Precio Fijo
                    </span>
                  </label>
                  <label className='flex items-center gap-2 cursor-pointer'>
                    <input
                      type='radio'
                      name='price_type'
                      value='calculated'
                      checked={formData.price_type === 'calculated'}
                      onChange={() =>
                        setFormData({ ...formData, price_type: 'calculated' })
                      }
                      className='w-4 h-4'
                    />
                    <span style={{ color: 'var(--color-text)' }}>
                      Calculado con Descuento
                    </span>
                  </label>
                </div>
              </div>

              {/* Fixed Price */}
              {formData.price_type === 'fixed' && (
                <div>
                  <label
                    className='block text-sm font-medium mb-1'
                    style={{ color: 'var(--color-text)' }}
                  >
                    Precio del Combo
                  </label>
                  <input
                    type='number'
                    required
                    min='0'
                    step='0.01'
                    value={formData.fixed_price}
                    onChange={(e) =>
                      setFormData({ ...formData, fixed_price: e.target.value })
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

              {/* Discount */}
              {formData.price_type === 'calculated' && (
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label
                      className='block text-sm font-medium mb-1'
                      style={{ color: 'var(--color-text)' }}
                    >
                      Tipo de Descuento
                    </label>
                    <select
                      value={formData.discount_type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discount_type: e.target.value as
                            | 'percentage'
                            | 'fixed',
                        })
                      }
                      className='w-full px-3 py-2 border rounded-lg'
                      style={{
                        backgroundColor: 'var(--color-background-accent)',
                        color: 'var(--color-text)',
                        borderColor: 'var(--color-text)',
                      }}
                    >
                      <option value='percentage'>Porcentaje (%)</option>
                      <option value='fixed'>Monto Fijo ($)</option>
                    </select>
                  </div>
                  <div>
                    <label
                      className='block text-sm font-medium mb-1'
                      style={{ color: 'var(--color-text)' }}
                    >
                      Valor del Descuento
                    </label>
                    <input
                      type='number'
                      required
                      min='0'
                      step='0.01'
                      value={formData.discount_value}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discount_value: e.target.value,
                        })
                      }
                      className='w-full px-3 py-2 border rounded-lg'
                      style={{
                        backgroundColor: 'var(--color-background-accent)',
                        color: 'var(--color-text)',
                        borderColor: 'var(--color-text)',
                      }}
                      placeholder={
                        formData.discount_type === 'percentage' ? '10' : '500'
                      }
                    />
                  </div>
                </div>
              )}

              {/* Active */}
              <div className='flex items-center gap-2'>
                <input
                  type='checkbox'
                  id='combo_active'
                  checked={formData.active}
                  onChange={(e) =>
                    setFormData({ ...formData, active: e.target.checked })
                  }
                  className='w-4 h-4'
                />
                <label
                  htmlFor='combo_active'
                  className='text-sm font-medium'
                  style={{ color: 'var(--color-text)' }}
                >
                  Combo activo
                </label>
              </div>

              {/* Slots */}
              <div
                className='border rounded-lg p-4'
                style={{ borderColor: 'var(--color-text)' }}
              >
                <div className='flex justify-between items-center mb-3'>
                  <h3
                    className='font-semibold'
                    style={{ color: 'var(--color-text)' }}
                  >
                    Slots del Combo
                  </h3>
                  <button
                    type='button'
                    onClick={addSlot}
                    className='flex items-center gap-1 px-3 py-1 rounded text-sm text-white'
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <Plus size={16} />
                    Agregar Slot
                  </button>
                </div>

                {slots.length === 0 ? (
                  <p
                    className='text-sm opacity-60 text-center py-4'
                    style={{ color: 'var(--color-text)' }}
                  >
                    No hay slots. Agregá al menos uno.
                  </p>
                ) : (
                  <div className='space-y-4'>
                    {slots.map((slot, index) => (
                      <div
                        key={slot.id}
                        className='border rounded-lg p-3'
                        style={{
                          borderColor: 'var(--color-text)',
                          opacity: 0.9,
                        }}
                      >
                        <div className='flex justify-between items-start mb-2'>
                          <span
                            className='text-sm font-medium'
                            style={{ color: 'var(--color-text)' }}
                          >
                            Slot {index + 1}
                          </span>
                          <button
                            type='button'
                            onClick={() => removeSlot(index)}
                            className='text-red-500 hover:text-red-700'
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className='grid grid-cols-2 gap-3 mb-3'>
                          <div>
                            <label
                              className='block text-xs mb-1'
                              style={{ color: 'var(--color-text)' }}
                            >
                              Nombre del Slot
                            </label>
                            <input
                              type='text'
                              required
                              value={slot.name}
                              onChange={(e) =>
                                updateSlot(index, 'name', e.target.value)
                              }
                              className='w-full px-2 py-1 border rounded text-sm'
                              style={{
                                backgroundColor:
                                  'var(--color-background-accent)',
                                color: 'var(--color-text)',
                                borderColor: 'var(--color-text)',
                              }}
                              placeholder='Ej: Hamburguesa'
                            />
                          </div>
                          <div>
                            <label
                              className='block text-xs mb-1'
                              style={{ color: 'var(--color-text)' }}
                            >
                              Cantidad
                            </label>
                            <input
                              type='number'
                              required
                              min='1'
                              value={slot.quantity}
                              onChange={(e) =>
                                updateSlot(
                                  index,
                                  'quantity',
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className='w-full px-2 py-1 border rounded text-sm'
                              style={{
                                backgroundColor:
                                  'var(--color-background-accent)',
                                color: 'var(--color-text)',
                                borderColor: 'var(--color-text)',
                              }}
                            />
                          </div>
                        </div>

                        <div className='flex items-center gap-2 mb-3'>
                          <input
                            type='checkbox'
                            id={`dynamic_${slot.id}`}
                            checked={slot.is_dynamic}
                            onChange={(e) =>
                              updateSlot(index, 'is_dynamic', e.target.checked)
                            }
                            className='w-4 h-4'
                          />
                          <label
                            htmlFor={`dynamic_${slot.id}`}
                            className='text-sm'
                            style={{ color: 'var(--color-text)' }}
                          >
                            Permitir elegir entre opciones
                          </label>
                        </div>

                        <div className='mb-3'>
                          <label
                            className='block text-xs mb-1'
                            style={{ color: 'var(--color-text)' }}
                          >
                            {slot.is_dynamic
                              ? 'Productos disponibles'
                              : 'Producto'}
                          </label>
                          <div
                            className='max-h-32 overflow-y-auto border rounded p-2'
                            style={{ borderColor: 'var(--color-text)' }}
                          >
                            {activeProducts.length === 0 ? (
                              <p
                                className='text-xs opacity-60'
                                style={{ color: 'var(--color-text)' }}
                              >
                                No hay productos activos
                              </p>
                            ) : (
                              activeProducts.map((product) => (
                                <label
                                  key={product.id}
                                  className='flex items-center gap-2 py-1 cursor-pointer hover:bg-black/5 rounded px-1'
                                >
                                  <input
                                    type={
                                      slot.is_dynamic ? 'checkbox' : 'radio'
                                    }
                                    name={`slot_product_${slot.id}`}
                                    checked={slot.product_ids.includes(
                                      product.id
                                    )}
                                    onChange={() => {
                                      if (slot.is_dynamic) {
                                        toggleProductInSlot(index, product.id);
                                      } else {
                                        updateSlot(index, 'product_ids', [
                                          product.id,
                                        ]);
                                        updateSlot(
                                          index,
                                          'default_product_id',
                                          product.id
                                        );
                                      }
                                    }}
                                    className='w-3 h-3'
                                  />
                                  <span
                                    className='text-sm'
                                    style={{ color: 'var(--color-text)' }}
                                  >
                                    {product.name} -{' '}
                                    {formatPrice(product.price)}
                                  </span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>

                        {slot.is_dynamic && slot.product_ids.length > 1 && (
                          <div>
                            <label
                              className='block text-xs mb-1'
                              style={{ color: 'var(--color-text)' }}
                            >
                              Producto por defecto
                            </label>
                            <select
                              value={slot.default_product_id}
                              onChange={(e) =>
                                updateSlot(
                                  index,
                                  'default_product_id',
                                  e.target.value
                                )
                              }
                              className='w-full px-2 py-1 border rounded text-sm'
                              style={{
                                backgroundColor:
                                  'var(--color-background-accent)',
                                color: 'var(--color-text)',
                                borderColor: 'var(--color-text)',
                              }}
                            >
                              {slot.product_ids.map((productId) => (
                                <option key={productId} value={productId}>
                                  {getProductName(productId)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className='flex gap-3 pt-4'>
                <button
                  type='button'
                  onClick={handleCancel}
                  className='flex-1 flex items-center justify-center gap-2 px-4 py-2 border rounded-lg'
                  style={{
                    borderColor: 'var(--color-text)',
                    color: 'var(--color-text)',
                  }}
                >
                  <X size={18} />
                  Cancelar
                </button>
                <button
                  type='submit'
                  className='flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-semibold'
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Save size={18} />
                  {editingId ? 'Guardar' : 'Crear Combo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Combos List */}
      {combos.length === 0 ? (
        <div
          className='text-center py-12 rounded-xl'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <Package
            size={48}
            className='mx-auto mb-4 opacity-50'
            style={{ color: 'var(--color-text)' }}
          />
          <p className='opacity-60' style={{ color: 'var(--color-text)' }}>
            No hay combos creados
          </p>
          <button
            onClick={() => setShowForm(true)}
            className='mt-4 px-4 py-2 rounded-lg text-white font-semibold'
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Crear primer combo
          </button>
        </div>
      ) : (
        <div className='grid gap-4'>
          {combos.map((combo) => (
            <div
              key={combo.id}
              className='rounded-xl p-4'
              style={{
                backgroundColor: 'var(--color-background-secondary)',
                opacity: combo.active ? 1 : 0.6,
              }}
            >
              <div className='flex justify-between items-start'>
                <div className='flex-1'>
                  <div className='flex items-center gap-2'>
                    <h3
                      className='font-bold text-lg'
                      style={{ color: 'var(--color-text)' }}
                    >
                      {combo.name}
                    </h3>
                    {!combo.active && (
                      <span
                        className='text-xs px-2 py-0.5 rounded'
                        style={{
                          backgroundColor: 'var(--color-background-accent)',
                          color: 'var(--color-text)',
                        }}
                      >
                        Inactivo
                      </span>
                    )}
                  </div>
                  {combo.description && (
                    <p
                      className='text-sm opacity-70 mt-1'
                      style={{ color: 'var(--color-text)' }}
                    >
                      {combo.description}
                    </p>
                  )}
                  <div className='flex flex-wrap gap-2 mt-2'>
                    {combo.slots.map((slot) => (
                      <span
                        key={slot.id}
                        className='text-xs px-2 py-1 rounded'
                        style={{
                          backgroundColor: 'var(--color-background-accent)',
                          color: 'var(--color-text)',
                        }}
                      >
                        {slot.quantity}x {slot.name}
                        {slot.is_dynamic &&
                          ` (${slot.product_ids.length} opc.)`}
                      </span>
                    ))}
                  </div>
                </div>
                <div className='flex items-center gap-4'>
                  <div className='text-right'>
                    {combo.price_type === 'fixed' ? (
                      <p
                        className='font-bold text-lg'
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {formatPrice(combo.fixed_price || 0)}
                      </p>
                    ) : (
                      <p
                        className='font-bold'
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {combo.discount_type === 'percentage'
                          ? `-${combo.discount_value}%`
                          : `-${formatPrice(combo.discount_value || 0)}`}
                      </p>
                    )}
                  </div>
                  <div className='flex gap-2'>
                    <button
                      onClick={() => handleEdit(combo)}
                      className='flex justify-center items-center p-2 rounded-lg transition-colors'
                      style={{
                        backgroundColor: 'var(--color-background-accent)',
                        color: 'var(--color-text)',
                      }}
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(combo.id)}
                      className='flex justify-center items-center p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors'
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
