import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useProducts } from '../hooks/useProducts';
import { Product } from '../lib/indexeddb';
import { formatPrice, formatNumber } from '../lib/utils';

export function ProductsView() {
  const { products, addProduct, updateProduct, deleteProduct, loading } = useProducts();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    production_cost: '',
    stock: '',
    category: 'burgers',
    active: true,
  });

  const categories = [
    { value: 'burgers', label: 'Burgers' },
    { value: 'sides', label: 'Sides' },
    { value: 'drinks', label: 'Drinks' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        await updateProduct(editingId, {
          name: formData.name,
          price: parseFloat(formData.price),
          production_cost: parseFloat(formData.production_cost),
          stock: parseInt(formData.stock),
          category: formData.category,
          active: formData.active,
        } as Partial<Product>);
      } else {
        await addProduct({
          name: formData.name,
          price: parseFloat(formData.price),
          production_cost: parseFloat(formData.production_cost),
          stock: parseInt(formData.stock),
          category: formData.category,
          active: formData.active,
        });
      }

      setFormData({ name: '', price: '', production_cost: '', stock: '', category: 'burgers', active: true });
      setShowForm(false);
      setEditingId(null);
      toast.success(editingId ? 'Producto actualizado exitosamente' : 'Producto agregado exitosamente');
    } catch (error) {
      toast.error('Error al guardar el producto');
    }
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price: product.price.toString(),
      production_cost: product.production_cost.toString(),
      stock: product.stock.toString(),
      category: product.category,
      active: product.active,
    });
    setEditingId(product.id);
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
    setFormData({ name: '', price: '', production_cost: '', stock: '', category: 'burgers', active: true });
    setShowForm(false);
    setEditingId(null);
  };

  if (loading) {
    return <div className="p-6 dark:text-white">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>Products</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <Plus size={20} />
            Add Product
          </button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg shadow-md p-6 mb-6" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
            {editingId ? 'Edit Product' : 'New Product'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ backgroundColor: 'var(--color-background-accent)', color: 'var(--color-text)', borderColor: 'var(--color-text)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Sale Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  style={{ backgroundColor: 'var(--color-background-accent)', color: 'var(--color-text)', borderColor: 'var(--color-text)' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Production Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.production_cost}
                  onChange={(e) => setFormData({ ...formData, production_cost: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  style={{ backgroundColor: 'var(--color-background-accent)', color: 'var(--color-text)', borderColor: 'var(--color-text)' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Stock</label>
              <input
                type="number"
                required
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ backgroundColor: 'var(--color-background-accent)', color: 'var(--color-text)', borderColor: 'var(--color-text)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ backgroundColor: 'var(--color-background-accent)', color: 'var(--color-text)', borderColor: 'var(--color-text)' }}
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="active" className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                Active
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Save size={18} />
                {editingId ? 'Update' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-600 dark:text-white font-semibold"
              >
                <X size={18} />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            className="rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow border-2"
            style={{ backgroundColor: 'var(--color-background-secondary)', borderColor: 'var(--color-primary)' }}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{product.name}</h3>
                <p className="text-sm opacity-60 capitalize" style={{ color: 'var(--color-text)' }}>{product.category}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(product)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>Sale Price:</span>
                <span className="font-bold" style={{ color: 'var(--color-text)' }}>{formatPrice(product.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>Cost:</span>
                <span className="font-bold opacity-60" style={{ color: 'var(--color-text)' }}>{formatPrice(product.production_cost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>Margin:</span>
                <span className="font-bold" style={{ color: 'var(--color-primary)' }}>
                  {formatPrice(product.price - product.production_cost)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>Stock:</span>
                <span
                  className="font-bold"
                  style={{ color: product.stock < 10 ? '#ef4444' : 'var(--color-text)' }}
                >
                  {formatNumber(product.stock)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>Status:</span>
                <span
                  className="font-semibold"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {product.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
