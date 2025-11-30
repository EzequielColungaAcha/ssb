import { useState, useEffect } from 'react';
import { db, CashDrawer, CashMovement } from '../lib/indexeddb';

export interface CashDrawerBill {
  id: string;
  denomination: number;
  quantity: number;
  updated_at: string;
}

export interface ChangeBreakdown {
  bill_value: number;
  quantity: number;
}

const BILL_DENOMINATIONS = [10, 20, 50, 100, 200, 500, 1000, 2000, 10000, 20000];

export function useCashDrawer() {
  const [bills, setBills] = useState<CashDrawerBill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBills();
  }, []);

  const initializeBills = async () => {
    await db.init();
    for (const denomination of BILL_DENOMINATIONS) {
      const existing = await db.getAllByIndex<CashDrawer>('cash_drawer', 'denomination', denomination);
      if (existing.length === 0) {
        const newBill: CashDrawer = {
          id: crypto.randomUUID(),
          denomination,
          quantity: 0,
          updated_at: new Date().toISOString(),
        };
        await db.add('cash_drawer', newBill);
      }
    }
  };

  const loadBills = async () => {
    try {
      await db.init();
      await initializeBills();
      const data = await db.getAll<CashDrawer>('cash_drawer');
      const mapped: CashDrawerBill[] = data.map(d => ({
        id: d.id,
        denomination: d.denomination,
        quantity: d.quantity,
        updated_at: d.updated_at,
      }));
      const sorted = mapped.sort((a, b) => b.denomination - a.denomination);
      setBills(sorted);
    } catch (error) {
      console.error('Error loading cash drawer:', error);
    } finally {
      setLoading(false);
    }
  };

  const ensureBillExists = async (denomination: number) => {
    await db.init();
    const existing = await db.getAllByIndex<CashDrawer>('cash_drawer', 'denomination', denomination);
    if (existing.length === 0) {
      const newBill: CashDrawer = {
        id: crypto.randomUUID(),
        denomination,
        quantity: 0,
        updated_at: new Date().toISOString(),
      };
      await db.add('cash_drawer', newBill);
    }
  };

  const logMovement = async (
    type: CashMovement['movement_type'],
    billsIn?: Record<string, number>,
    billsOut?: Record<string, number>,
    saleId?: string,
    notes?: string
  ) => {
    try {
      await db.init();
      const movement: CashMovement = {
        id: crypto.randomUUID(),
        movement_type: type,
        bills_in: billsIn,
        bills_out: billsOut,
        sale_id: saleId,
        notes: notes,
        created_at: new Date().toISOString(),
      };
      await db.add('cash_movements', movement);
    } catch (error) {
      console.error('Error logging cash movement:', error);
    }
  };

  const updateBillQuantity = async (
    denomination: number,
    quantity: number,
    logType?: CashMovement['movement_type'],
    description?: string
  ) => {
    try {
      await db.init();
      await ensureBillExists(denomination);

      const existing = await db.getAllByIndex<CashDrawer>('cash_drawer', 'denomination', denomination);
      if (existing.length === 0) throw new Error('Bill not found');

      const currentBill = existing[0];
      const quantityDiff = quantity - currentBill.quantity;

      const updated: CashDrawer = {
        ...currentBill,
        quantity,
        updated_at: new Date().toISOString(),
      };
      await db.put('cash_drawer', updated);

      if (logType && quantityDiff !== 0) {
        const billChange = { [denomination.toString()]: Math.abs(quantityDiff) };
        await logMovement(
          logType,
          quantityDiff > 0 ? billChange : undefined,
          quantityDiff < 0 ? billChange : undefined,
          undefined,
          description
        );
      }

      await loadBills();
    } catch (error) {
      console.error('Error updating bill quantity:', error);
      throw error;
    }
  };

  const addBills = async (denomination: number, quantity: number, saleId?: string) => {
    await ensureBillExists(denomination);
    const bill = bills.find((b) => b.denomination === denomination);
    if (bill) {
      await updateBillQuantity(denomination, bill.quantity + quantity);
      await logMovement(
        saleId ? 'sale' : 'manual_add',
        { [denomination.toString()]: quantity },
        undefined,
        saleId
      );
    }
  };

  const removeBills = async (denomination: number, quantity: number, saleId?: string) => {
    const bill = bills.find((b) => b.denomination === denomination);
    if (bill && bill.quantity >= quantity) {
      await updateBillQuantity(denomination, bill.quantity - quantity);
      await logMovement(
        saleId ? 'change_given' : 'manual_remove',
        undefined,
        { [denomination.toString()]: quantity },
        saleId
      );
    }
  };

  const calculateOptimalChange = (changeAmount: number): ChangeBreakdown[] | null => {
    if (changeAmount === 0) return [];
    if (changeAmount < 0) return null;

    const sortedBills = [...bills].sort((a, b) => b.denomination - a.denomination);
    const result: ChangeBreakdown[] = [];
    let remaining = changeAmount;

    for (const bill of sortedBills) {
      if (bill.quantity === 0) continue;

      const maxBillsNeeded = Math.floor(remaining / bill.denomination);
      const billsToUse = Math.min(maxBillsNeeded, bill.quantity);

      if (billsToUse > 0) {
        result.push({
          bill_value: bill.denomination,
          quantity: billsToUse,
        });
        remaining -= billsToUse * bill.denomination;
      }

      if (remaining === 0) break;
    }

    if (remaining > 0) {
      return null;
    }

    return result;
  };

  const processChange = async (changeBreakdown: ChangeBreakdown[], saleId: string) => {
    try {
      for (const item of changeBreakdown) {
        await removeBills(item.bill_value, item.quantity, saleId);
      }
    } catch (error) {
      console.error('Error processing change:', error);
      throw error;
    }
  };

  const processCashReceived = async (cashReceived: number, saleId: string) => {
    try {
      const billCounts: { [key: number]: number } = {};

      [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10].forEach((value) => {
        const count = Math.floor(cashReceived / value);
        if (count > 0) {
          billCounts[value] = count;
          cashReceived -= count * value;
        }
      });

      for (const [value, count] of Object.entries(billCounts)) {
        await addBills(parseInt(value), count, saleId);
      }

      return billCounts;
    } catch (error) {
      console.error('Error processing cash received:', error);
      throw error;
    }
  };

  const getTotalCash = () => {
    return bills.reduce((sum, bill) => sum + bill.denomination * bill.quantity, 0);
  };

  const getCashMovements = async (): Promise<CashMovement[]> => {
    try {
      await db.init();
      const data = await db.getAll<CashMovement>('cash_movements');
      return data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 100);
    } catch (error) {
      console.error('Error loading cash movements:', error);
      return [];
    }
  };

  const resetCashDrawer = async () => {
    try {
      await db.init();

      const currentState: Record<string, number> = {};
      bills.forEach(bill => {
        if (bill.quantity > 0) {
          currentState[bill.denomination.toString()] = bill.quantity;
        }
      });

      for (const bill of bills) {
        if (bill.quantity > 0) {
          const updated: CashDrawer = {
            ...bill,
            quantity: 0,
            updated_at: new Date().toISOString(),
          };
          const existing = await db.getAllByIndex<CashDrawer>('cash_drawer', 'denomination', bill.denomination);
          if (existing.length > 0) {
            await db.put('cash_drawer', { ...updated, id: existing[0].id });
          }
        }
      }

      const totalCashBefore = Object.entries(currentState).reduce(
        (sum, [denom, qty]) => sum + Number(denom) * qty,
        0
      );

      await logMovement(
        'cash_closing',
        undefined,
        currentState,
        undefined,
        `Cierre de caja - Total: $${totalCashBefore.toFixed(2)}`
      );

      await loadBills();
    } catch (error) {
      console.error('Error resetting cash drawer:', error);
      throw error;
    }
  };

  return {
    bills,
    loading,
    updateBillQuantity,
    addBills,
    removeBills,
    calculateOptimalChange,
    processChange,
    processCashReceived,
    getTotalCash,
    getCashMovements,
    resetCashDrawer,
    refresh: loadBills,
  };
}
