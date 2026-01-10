import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Beef } from 'lucide-react';
import { toast } from 'sonner';
import { useMateriaPrima } from '../hooks/useMateriaPrima';
import { MateriaPrima } from '../lib/indexeddb';
import { formatPrice, formatNumber } from '../lib/utils';

export function MateriaPrimaView() {
  const {
    materiaPrima,
    addMateriaPrima,
    updateMateriaPrima,
    deleteMateriaPrima,
    loading,
  } = useMateriaPrima();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    unit: 'units' as 'units' | 'kg',
    stock: '',
    cost_per_unit: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        await updateMateriaPrima(editingId, {
          name: formData.name,
          unit: formData.unit,
          stock: parseFloat(formData.stock),
          cost_per_unit: parseFloat(formData.cost_per_unit),
        } as Partial<MateriaPrima>);
      } else {
        await addMateriaPrima({
          name: formData.name,
          unit: formData.unit,
          stock: parseFloat(formData.stock),
          cost_per_unit: parseFloat(formData.cost_per_unit),
        });
      }

      setFormData({
        name: '',
        unit: 'units',
        stock: '',
        cost_per_unit: '',
      });
      setShowForm(false);
      setEditingId(null);
      toast.success(
        editingId
          ? 'Materia prima actualizada exitosamente'
          : 'Materia prima agregada exitosamente'
      );
    } catch (error) {
      toast.error('Error al guardar la materia prima');
      console.error(error);
    }
  };

  const handleEdit = (mp: MateriaPrima) => {
    setFormData({
      name: mp.name,
      unit: mp.unit,
      stock: mp.stock.toString(),
      cost_per_unit: mp.cost_per_unit.toString(),
    });
    setEditingId(mp.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    toast('Eliminar Materia Prima', {
      description: '¿Estás seguro de que deseas eliminar esta materia prima?',
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await deleteMateriaPrima(id);
            toast.success('Materia prima eliminada exitosamente');
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : 'Error al eliminar la materia prima'
            );
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
      unit: 'units',
      stock: '',
      cost_per_unit: '',
    });
    setShowForm(false);
    setEditingId(null);
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
            <Beef style={{ color: 'var(--color-primary)' }} />
            Materia Prima
          </h1>
          <p className='opacity-60 mt-2' style={{ color: 'var(--color-text)' }}>
            Gestioná los ingredientes y materiales necesarios para tus productos
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className='flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold'
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
            }}
          >
            <Plus size={20} />
            Añadir Materia Prima
          </button>
        )}
      </div>

      {showForm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
          <div
            className='w-full max-w-md max-h-[90vh] overflow-auto rounded-xl shadow-2xl p-6 mx-4'
            style={{ backgroundColor: 'var(--color-background-secondary)' }}
          >
            <h2
              className='text-xl font-bold mb-4'
              style={{ color: 'var(--color-text)' }}
            >
              {editingId ? 'Editar Materia Prima' : 'Nueva Materia Prima'}
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
                  placeholder='Ej: Pan, Carne, Queso'
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
                  Unidad de Medida
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      unit: e.target.value as 'units' | 'kg',
                    })
                  }
                  className='w-full px-3 py-2 border rounded-lg'
                  style={{
                    backgroundColor: 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                    borderColor: 'var(--color-text)',
                  }}
                >
                  <option value='units'>Unidades</option>
                  <option value='kg'>Kilogramos</option>
                </select>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label
                    className='block text-sm font-medium mb-1'
                    style={{ color: 'var(--color-text)' }}
                  >
                    Stock Disponible
                  </label>
                  <input
                    type='number'
                    step='0.001'
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

                <div>
                  <label
                    className='block text-sm font-medium mb-1'
                    style={{ color: 'var(--color-text)' }}
                  >
                    Costo por Unidad ($)
                  </label>
                  <input
                    type='number'
                    step='0.01'
                    required
                    value={formData.cost_per_unit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cost_per_unit: e.target.value,
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

      {materiaPrima.length === 0 ? (
        <div
          className='text-center py-12 rounded-lg'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <Beef
            size={48}
            className='mx-auto mb-4 opacity-40'
            style={{ color: 'var(--color-text)' }}
          />
          <p
            className='text-lg opacity-60'
            style={{ color: 'var(--color-text)' }}
          >
            No hay materia prima registrada
          </p>
          <p
            className='text-sm opacity-40 mt-2'
            style={{ color: 'var(--color-text)' }}
          >
            Agregá ingredientes para vincularlos a tus productos
          </p>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {materiaPrima.map((mp) => (
            <div
              key={mp.id}
              className='rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow border-2'
              style={{
                backgroundColor: 'var(--color-background-secondary)',
                borderColor: 'var(--color-primary)',
              }}
            >
              <div className='mb-3'>
                <h3
                  className='text-lg font-bold'
                  style={{ color: 'var(--color-text)' }}
                >
                  {mp.name}
                </h3>
                <p
                  className='text-sm opacity-60'
                  style={{ color: 'var(--color-text)' }}
                >
                  {mp.unit === 'units' ? 'Unidades' : 'Kilogramos'}
                </p>
              </div>

              <div className='space-y-1'>
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
                      color: mp.stock < 10 ? '#ef4444' : 'var(--color-text)',
                    }}
                  >
                    {formatNumber(mp.stock)}{' '}
                    {mp.unit === 'units' ? 'un.' : 'kg'}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span
                    className='text-sm opacity-60'
                    style={{ color: 'var(--color-text)' }}
                  >
                    Costo por Unidad:
                  </span>
                  <span
                    className='font-bold'
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatPrice(mp.cost_per_unit)}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span
                    className='text-sm opacity-60'
                    style={{ color: 'var(--color-text)' }}
                  >
                    Valor Total:
                  </span>
                  <span
                    className='font-bold'
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {formatPrice(mp.stock * mp.cost_per_unit)}
                  </span>
                </div>
              </div>

              <div className='flex gap-2 mt-4'>
                <button
                  onClick={() => handleEdit(mp)}
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
                  onClick={() => handleDelete(mp.id)}
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
