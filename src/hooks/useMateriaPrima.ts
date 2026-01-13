import { useState, useEffect, useCallback } from 'react';
import {
  db,
  MateriaPrima,
  ProductMateriaPrima,
  Product,
} from '../lib/indexeddb';

export function useMateriaPrima() {
  const [materiaPrima, setMateriaPrima] = useState<MateriaPrima[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMateriaPrima();
  }, []);

  const loadMateriaPrima = async () => {
    try {
      await db.init();
      if (!db.hasStore('materia_prima')) {
        console.warn('materia_prima store not found, database needs upgrade');
        setMateriaPrima([]);
        setLoading(false);
        return;
      }
      const data = await db.getAll<MateriaPrima>('materia_prima');
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setMateriaPrima(sorted);
    } catch (error) {
      console.error('Error loading materia prima:', error);
      setMateriaPrima([]);
    } finally {
      setLoading(false);
    }
  };

  const addMateriaPrima = async (
    mp: Omit<MateriaPrima, 'id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      await db.init();
      const now = new Date().toISOString();
      const newMP: MateriaPrima = {
        ...mp,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      };
      await db.add('materia_prima', newMP);
      await loadMateriaPrima();
    } catch (error) {
      console.error('Error adding materia prima:', error);
      throw error;
    }
  };

  const updateMateriaPrima = async (
    id: string,
    updates: Partial<MateriaPrima>
  ) => {
    try {
      await db.init();
      const existing = await db.get<MateriaPrima>('materia_prima', id);
      if (!existing) throw new Error('Materia prima not found');

      const updated: MateriaPrima = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await db.put('materia_prima', updated);

      // If cost changed, recalculate affected products
      if (updates.cost_per_unit !== undefined) {
        await recalculateAffectedProductsCost(id);
      }

      await loadMateriaPrima();
    } catch (error) {
      console.error('Error updating materia prima:', error);
      throw error;
    }
  };

  const deleteMateriaPrima = async (id: string) => {
    try {
      await db.init();
      const productLinks = await db.getAllByIndex<ProductMateriaPrima>(
        'product_materia_prima',
        'materia_prima_id',
        id
      );

      if (productLinks.length > 0) {
        throw new Error('No se puede eliminar: está vinculado a productos');
      }

      await db.delete('materia_prima', id);
      await loadMateriaPrima();
    } catch (error) {
      console.error('Error deleting materia prima:', error);
      throw error;
    }
  };

  const updateStock = async (id: string, delta: number) => {
    // Read current stock from database to avoid stale state issues
    await db.init();
    const mp = await db.get<MateriaPrima>('materia_prima', id);
    if (!mp) return;

    const newStock = mp.stock + delta;
    if (newStock < 0) {
      throw new Error('Stock insuficiente');
    }

    // Update directly in database without triggering full reload
    const updated: MateriaPrima = {
      ...mp,
      stock: newStock,
      updated_at: new Date().toISOString(),
    };
    await db.put('materia_prima', updated);
  };

  const getProductMateriaPrima = async (productId: string) => {
    try {
      await db.init();
      if (!db.hasStore('product_materia_prima')) {
        return [];
      }
      return await db.getAllByIndex<ProductMateriaPrima>(
        'product_materia_prima',
        'product_id',
        productId
      );
    } catch (error) {
      console.error('Error getting product materia prima:', error);
      return [];
    }
  };

  const setProductMateriaPrima = async (
    productId: string,
    items: Array<{
      materia_prima_id: string;
      quantity: number;
      removable: boolean;
    }>
  ) => {
    try {
      await db.init();

      const existing = await db.getAllByIndex<ProductMateriaPrima>(
        'product_materia_prima',
        'product_id',
        productId
      );

      for (const item of existing) {
        await db.delete('product_materia_prima', item.id);
      }

      for (const item of items) {
        const newLink: ProductMateriaPrima = {
          id: crypto.randomUUID(),
          product_id: productId,
          materia_prima_id: item.materia_prima_id,
          quantity: item.quantity,
          removable: item.removable,
          created_at: new Date().toISOString(),
        };
        await db.add('product_materia_prima', newLink);
      }
    } catch (error) {
      console.error('Error setting product materia prima:', error);
      throw error;
    }
  };

  const calculateProductCost = async (productId: string): Promise<number> => {
    try {
      await db.init();
      if (
        !db.hasStore('materia_prima') ||
        !db.hasStore('product_materia_prima')
      ) {
        return 0;
      }
      const links = await getProductMateriaPrima(productId);

      let totalCost = 0;
      for (const link of links) {
        const mp = await db.get<MateriaPrima>(
          'materia_prima',
          link.materia_prima_id
        );
        if (mp) {
          totalCost += mp.cost_per_unit * link.quantity;
        }
      }

      return totalCost;
    } catch (error) {
      console.error('Error calculating product cost:', error);
      return 0;
    }
  };

  const recalculateAffectedProductsCost = async (materiaPrimaId: string) => {
    try {
      await db.init();

      // Find all product links using this materia prima
      const links = await db.getAllByIndex<ProductMateriaPrima>(
        'product_materia_prima',
        'materia_prima_id',
        materiaPrimaId
      );

      // Get unique product IDs
      const productIds = [...new Set(links.map((l) => l.product_id))];

      // Recalculate and update each product
      for (const productId of productIds) {
        const cost = await calculateProductCost(productId);
        const product = await db.get<Product>('products', productId);
        if (product && product.uses_materia_prima) {
          await db.put('products', {
            ...product,
            production_cost: cost,
            updated_at: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Error recalculating affected products cost:', error);
    }
  };

  const checkStockAvailability = async (
    productId: string
  ): Promise<boolean> => {
    try {
      await db.init();
      if (
        !db.hasStore('materia_prima') ||
        !db.hasStore('product_materia_prima')
      ) {
        return true;
      }
      const links = await getProductMateriaPrima(productId);

      for (const link of links) {
        const mp = await db.get<MateriaPrima>(
          'materia_prima',
          link.materia_prima_id
        );
        if (!mp || mp.stock < link.quantity) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking stock availability:', error);
      return false;
    }
  };

  const deductMateriaPrimaStock = async (
    productId: string,
    quantity: number = 1,
    removedIngredients?: string[]
  ) => {
    try {
      await db.init();
      const links = await getProductMateriaPrima(productId);

      for (const link of links) {
        // Skip if this ingredient was removed from the order
        if (removedIngredients && removedIngredients.length > 0) {
          const mp = materiaPrima.find((m) => m.id === link.materia_prima_id);
          if (mp && removedIngredients.includes(mp.name)) {
            continue;
          }
        }
        await updateStock(link.materia_prima_id, -(link.quantity * quantity));
      }
    } catch (error) {
      console.error('Error deducting materia prima stock:', error);
      throw error;
    }
  };

  const calculateAvailableStock = useCallback(
    async (productId: string): Promise<number> => {
      try {
        await db.init();
        if (
          !db.hasStore('materia_prima') ||
          !db.hasStore('product_materia_prima')
        ) {
          return 0;
        }
        const links = await getProductMateriaPrima(productId);

        if (links.length === 0) {
          return 0;
        }

        let minStock = Infinity;

        for (const link of links) {
          const mp = await db.get<MateriaPrima>(
            'materia_prima',
            link.materia_prima_id
          );
          if (!mp) {
            return 0;
          }

          const possibleUnits = Math.floor(mp.stock / link.quantity);
          minStock = Math.min(minStock, possibleUnits);
        }

        return minStock === Infinity ? 0 : minStock;
      } catch (error) {
        console.error('Error calculating available stock:', error);
        return 0;
      }
    },
    []
  );

  return {
    materiaPrima,
    loading,
    addMateriaPrima,
    updateMateriaPrima,
    deleteMateriaPrima,
    updateStock,
    getProductMateriaPrima,
    setProductMateriaPrima,
    calculateProductCost,
    checkStockAvailability,
    deductMateriaPrimaStock,
    calculateAvailableStock,
    refresh: loadMateriaPrima,
  };
}
