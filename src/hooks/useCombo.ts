import { useState, useEffect, useCallback } from 'react';
import { db, Combo, ComboSlot, Product } from '../lib/indexeddb';

export interface ComboSelection {
  slotId: string;
  slotName: string;
  productId: string;
  productName: string;
  productPrice: number;
  removedIngredients: string[];
}

export function useCombo() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCombos();
  }, []);

  const loadCombos = async () => {
    try {
      await db.init();
      if (!db.hasStore('combos')) {
        console.warn('combos store not found, database needs upgrade');
        setCombos([]);
        setLoading(false);
        return;
      }
      const data = await db.getAll<Combo>('combos');
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setCombos(sorted);
    } catch (error) {
      console.error('Error loading combos:', error);
      setCombos([]);
    } finally {
      setLoading(false);
    }
  };

  const addCombo = async (
    combo: Omit<Combo, 'id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      await db.init();
      const now = new Date().toISOString();
      const newCombo: Combo = {
        ...combo,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      };
      await db.add('combos', newCombo);
      await loadCombos();
      return newCombo.id;
    } catch (error) {
      console.error('Error adding combo:', error);
      throw error;
    }
  };

  const updateCombo = async (id: string, updates: Partial<Combo>) => {
    try {
      await db.init();
      const existing = await db.get<Combo>('combos', id);
      if (!existing) throw new Error('Combo not found');

      const updated: Combo = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await db.put('combos', updated);
      await loadCombos();
    } catch (error) {
      console.error('Error updating combo:', error);
      throw error;
    }
  };

  const deleteCombo = async (id: string) => {
    try {
      await db.init();
      await db.delete('combos', id);
      await loadCombos();
    } catch (error) {
      console.error('Error deleting combo:', error);
      throw error;
    }
  };

  const calculateComboPrice = useCallback(
    async (
      combo: Combo,
      selectedProducts: Array<{ productId: string; quantity: number }>
    ): Promise<number> => {
      if (combo.price_type === 'fixed') {
        return combo.fixed_price || 0;
      }

      // Calculated price: sum of products minus discount
      try {
        await db.init();
        let totalPrice = 0;

        for (const selection of selectedProducts) {
          const product = await db.get<Product>(
            'products',
            selection.productId
          );
          if (product) {
            totalPrice += product.price * selection.quantity;
          }
        }

        if (combo.discount_type === 'percentage' && combo.discount_value) {
          totalPrice = totalPrice * (1 - combo.discount_value / 100);
        } else if (combo.discount_type === 'fixed' && combo.discount_value) {
          totalPrice = Math.max(0, totalPrice - combo.discount_value);
        }

        return Math.round(totalPrice);
      } catch (error) {
        console.error('Error calculating combo price:', error);
        return 0;
      }
    },
    []
  );

  const getDefaultSelections = useCallback(
    async (combo: Combo): Promise<ComboSelection[]> => {
      try {
        await db.init();
        const selections: ComboSelection[] = [];

        for (const slot of combo.slots) {
          const product = await db.get<Product>(
            'products',
            slot.default_product_id
          );
          if (product) {
            for (let i = 0; i < slot.quantity; i++) {
              selections.push({
                slotId: slot.id,
                slotName: slot.name,
                productId: product.id,
                productName: product.name,
                productPrice: product.price,
                removedIngredients: [],
              });
            }
          }
        }

        return selections;
      } catch (error) {
        console.error('Error getting default selections:', error);
        return [];
      }
    },
    []
  );

  const getSlotProducts = useCallback(
    async (slot: ComboSlot): Promise<Product[]> => {
      try {
        await db.init();
        const products: Product[] = [];

        for (const productId of slot.product_ids) {
          const product = await db.get<Product>('products', productId);
          if (product && product.active) {
            products.push(product);
          }
        }

        return products;
      } catch (error) {
        console.error('Error getting slot products:', error);
        return [];
      }
    },
    []
  );

  return {
    combos,
    loading,
    addCombo,
    updateCombo,
    deleteCombo,
    calculateComboPrice,
    getDefaultSelections,
    getSlotProducts,
    refresh: loadCombos,
  };
}
