import { useState, useEffect } from 'react';
import { db, Product } from '../lib/indexeddb';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      await db.init();
      const data = await db.getAll<Product>('products');
      const sorted = data.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
      });
      setProducts(sorted);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.init();
      const now = new Date().toISOString();
      const newProduct: Product = {
        ...product,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      };
      await db.add('products', newProduct);
      await loadProducts();
      return newProduct.id;
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      await db.init();
      const existing = await db.get<Product>('products', id);
      if (!existing) throw new Error('Product not found');

      const updated: Product = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await db.put('products', updated);
      await loadProducts();
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await db.init();
      await db.delete('products', id);
      await loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  };

  const updateStock = async (id: string, quantity: number) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    const newStock = product.stock + quantity;
    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }

    await updateProduct(id, { stock: newStock });
  };

  return {
    products,
    loading,
    addProduct,
    updateProduct,
    deleteProduct,
    updateStock,
    refresh: loadProducts,
  };
}
