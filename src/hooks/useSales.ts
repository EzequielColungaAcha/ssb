import { useState, useEffect } from 'react';
import { db, Sale, SaleItem, Product } from '../lib/indexeddb';

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      await db.init();
      const data = await db.getAll<Sale>('sales');
      const sorted = data.sort(
        (a, b) =>
          new Date(b.completed_at).getTime() -
          new Date(a.completed_at).getTime()
      );
      setSales(sorted);
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSale = async (
    items: Array<{
      product_id: string;
      product_name: string;
      product_price: number;
      production_cost: number;
      quantity: number;
      removedIngredients?: string[];
      combo_name?: string;
    }>,
    paymentMethod: string,
    cashReceived?: number,
    billsReceived?: Record<number, number>,
    billsChange?: Record<number, number>,
    scheduledTime?: string,
    customerName?: string,
    orderType?: 'pickup' | 'delivery',
    deliveryAddress?: string
  ) => {
    try {
      await db.init();
      const totalAmount = items.reduce(
        (sum, item) => sum + item.product_price * item.quantity,
        0
      );
      const changeGiven = cashReceived ? cashReceived - totalAmount : undefined;

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
      const saleNumber = String(lastSaleNumber + 1);
      const now = new Date().toISOString();

      const newSale: Sale = {
        id: crypto.randomUUID(),
        sale_number: saleNumber,
        total_amount: totalAmount,
        payment_method: paymentMethod as 'cash' | 'online',
        cash_received: cashReceived,
        change_given: changeGiven,
        bills_received: billsReceived,
        bills_change: billsChange,
        scheduled_time: scheduledTime,
        customer_name: customerName,
        order_type: orderType,
        delivery_address: deliveryAddress,
        completed_at: now,
        created_at: now,
      };

      await db.add('sales', newSale);

      const saleItems: SaleItem[] = items.map((item) => ({
        id: crypto.randomUUID(),
        sale_id: newSale.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_price: item.product_price,
        production_cost: item.production_cost || 0,
        quantity: item.quantity,
        subtotal: item.product_price * item.quantity,
        removed_ingredients: item.removedIngredients,
        combo_name: item.combo_name,
        created_at: now,
      }));

      for (const saleItem of saleItems) {
        await db.add('sale_items', saleItem);
      }

      for (const item of items) {
        const product = await db.get<Product>('products', item.product_id);
        if (product && !product.uses_materia_prima) {
          const updatedProduct = {
            ...product,
            stock: Math.max(0, product.stock - item.quantity),
            updated_at: now,
          };
          await db.put('products', updatedProduct);
        }
      }

      await loadSales();
      return newSale;
    } catch (error) {
      console.error('Error creating sale:', error);
      throw error;
    }
  };

  const getSaleItems = async (saleId: string): Promise<SaleItem[]> => {
    try {
      await db.init();
      return await db.getAllByIndex<SaleItem>('sale_items', 'sale_id', saleId);
    } catch (error) {
      console.error('Error loading sale items:', error);
      return [];
    }
  };

  const getSaleById = async (saleId: string): Promise<Sale | null> => {
    try {
      await db.init();
      return (await db.get<Sale>('sales', saleId)) ?? null;
    } catch (error) {
      console.error('Error loading sale:', error);
      return null;
    }
  };

  const updateSale = async (saleId: string, updates: Partial<Sale>) => {
    try {
      await db.init();
      const existing = await db.get<Sale>('sales', saleId);
      if (!existing) throw new Error('Sale not found');

      const updatedSale: Sale = {
        ...existing,
        ...updates,
      };
      await db.put('sales', updatedSale);
      await loadSales();
      return updatedSale;
    } catch (error) {
      console.error('Error updating sale:', error);
      throw error;
    }
  };

  return {
    sales,
    loading,
    createSale,
    getSaleItems,
    getSaleById,
    updateSale,
    refresh: loadSales,
  };
}
