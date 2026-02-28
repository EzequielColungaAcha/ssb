const DB_NAME = 'POS_DB';
const DB_VERSION = 9;

export interface MateriaPrima {
  id: string;
  name: string;
  unit: 'units' | 'kg';
  stock: number;
  cost_per_unit: number;
  created_at: string;
  updated_at: string;
}

export interface ProductMateriaPrima {
  id: string;
  product_id: string;
  materia_prima_id: string;
  quantity: number;
  removable: boolean;
  created_at: string;
  // Variable quantity ingredient fields
  is_variable?: boolean; // If true, quantity is chosen at sale time
  min_quantity?: number; // Minimum allowed (e.g., 1)
  max_quantity?: number; // Maximum allowed (e.g., 5)
  price_per_unit?: number; // Price added per unit (e.g., $500 per bacon strip)
  default_quantity?: number; // Default quantity shown (e.g., 1)
  // Linked ingredient fields (for dependent stock calculation)
  linked_to?: string; // materia_prima_id of the parent variable ingredient
  linked_multiplier?: number; // e.g., 2 means 2 of this per 1 of parent
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  stock: number;
  active: boolean;
  production_cost: number;
  uses_materia_prima: boolean;
  display_order?: number;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  sale_number: string;
  total_amount: number;
  payment_method: 'cash' | 'online' | 'card' | 'on_delivery' | 'unpaid';
  cash_received?: number;
  change_given?: number;
  bills_received?: Record<string, number>;
  bills_change?: Record<string, number>;
  scheduled_time?: string; // ISO timestamp for when order should be ready
  customer_name?: string;
  order_type?: 'pickup' | 'delivery';
  delivery_address?: string;
  delivery_charge?: number; // The delivery charge applied to this sale
  delivered_at?: string; // ISO timestamp when delivery was completed
  completed_at: string;
  created_at: string;
}

export interface VariableIngredient {
  materia_prima_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  production_cost: number;
  quantity: number;
  subtotal: number;
  removed_ingredients?: string[];
  variable_ingredients?: VariableIngredient[]; // Track variable ingredient quantities
  combo_name?: string;
  combo_instance_id?: string; // Unique ID for each combo instance in a sale
  combo_slot_index?: number; // Order of product within combo (for proper display ordering)
  combo_unit_price?: number; // The actual combo price (not sum of products)
  created_at: string;
}

export interface CashDrawer {
  id: string;
  denomination: number;
  quantity: number;
  updated_at: string;
}

export interface CashMovement {
  id: string;
  movement_type:
    | 'sale'
    | 'manual_add'
    | 'manual_remove'
    | 'change_given'
    | 'cash_closing';
  sale_id?: string;
  bills_in?: Record<string, number>;
  bills_out?: Record<string, number>;
  notes?: string;
  created_at: string;
}

export interface ThemeConfig {
  light: {
    primary: string;
    accent: string;
    text: string;
    background: string;
    backgroundSecondary: string;
    backgroundAccent: string;
  };
  dark: {
    primary: string;
    accent: string;
    text: string;
    background: string;
    backgroundSecondary: string;
    backgroundAccent: string;
  };
}

export interface LogoConfig {
  id: string;
  acronym: string;
  logo_image?: string;
  theme_config?: ThemeConfig;
  updated_at: string;
}

export type KdsMode = 'off' | 'local' | 'server';

export interface AppSettings {
  id: string;
  pos_layout_locked: boolean;
  category_order?: string[];
  kds_enabled?: boolean; // DEPRECATED – kept for migration only
  kds_mode?: KdsMode;
  kds_url?: string;
  delivery_charge?: number; // Flat fee for delivery
  free_delivery_threshold?: number; // Cart total above which delivery is free
  hidden_categories?: string[]; // e.g. ["bebidas"] — categories hidden from POS
  hide_combos?: boolean; // true => combos hidden from POS
  updated_at: string;
}

export interface KDSOrderItem {
  product_name: string;
  quantity: number;
  product_price: number;
  removed_ingredients?: string[];
  combo_name?: string | null;
  category?: string;
  variable_ingredients?: { name: string; quantity: number }[] | null;
}

export interface KDSOrder {
  id: string;
  sale_number: string;
  items: KDSOrderItem[];
  total: number;
  status: 'pending' | 'preparing' | 'on_delivery' | 'completed';
  payment_method?: string;
  scheduled_time?: string;
  customer_name?: string;
  order_type?: 'pickup' | 'delivery';
  delivery_address?: string;
  created_at: string;
  finished_at?: string;
}

export interface ComboSlot {
  id: string;
  name: string;
  is_dynamic: boolean;
  product_ids: string[];
  default_product_id: string;
  quantity: number;
}

export interface Combo {
  id: string;
  name: string;
  description?: string;
  price_type: 'fixed' | 'calculated';
  fixed_price?: number;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  slots: ComboSlot[];
  active: boolean;
  display_order?: number;
  created_at: string;
  updated_at: string;
}

class IndexedDBService {
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized && this.db) return;

    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not available in this environment');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', {
            keyPath: 'id',
          });
          productStore.createIndex('category', 'category', { unique: false });
          productStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('sales')) {
          const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
          salesStore.createIndex('completed_at', 'completed_at', {
            unique: false,
          });
          salesStore.createIndex('sale_number', 'sale_number', {
            unique: true,
          });
        }

        if (!db.objectStoreNames.contains('sale_items')) {
          const saleItemsStore = db.createObjectStore('sale_items', {
            keyPath: 'id',
          });
          saleItemsStore.createIndex('sale_id', 'sale_id', { unique: false });
        }

        if (!db.objectStoreNames.contains('cash_drawer')) {
          const drawerStore = db.createObjectStore('cash_drawer', {
            keyPath: 'id',
          });
          drawerStore.createIndex('denomination', 'denomination', {
            unique: true,
          });
        }

        if (!db.objectStoreNames.contains('cash_movements')) {
          const movementsStore = db.createObjectStore('cash_movements', {
            keyPath: 'id',
          });
          movementsStore.createIndex('created_at', 'created_at', {
            unique: false,
          });
          movementsStore.createIndex('sale_id', 'sale_id', { unique: false });
        }

        if (!db.objectStoreNames.contains('logo_config')) {
          db.createObjectStore('logo_config', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('materia_prima')) {
          const materiaPrimaStore = db.createObjectStore('materia_prima', {
            keyPath: 'id',
          });
          materiaPrimaStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('product_materia_prima')) {
          const productMateriaPrimaStore = db.createObjectStore(
            'product_materia_prima',
            {
              keyPath: 'id',
            }
          );
          productMateriaPrimaStore.createIndex('product_id', 'product_id', {
            unique: false,
          });
          productMateriaPrimaStore.createIndex(
            'materia_prima_id',
            'materia_prima_id',
            { unique: false }
          );
        }

        if (!db.objectStoreNames.contains('app_settings')) {
          db.createObjectStore('app_settings', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('combos')) {
          const combosStore = db.createObjectStore('combos', { keyPath: 'id' });
          combosStore.createIndex('name', 'name', { unique: false });
          combosStore.createIndex('active', 'active', { unique: false });
        }

        if (!db.objectStoreNames.contains('kds_orders')) {
          const kdsStore = db.createObjectStore('kds_orders', { keyPath: 'id' });
          kdsStore.createIndex('status', 'status', { unique: false });
          kdsStore.createIndex('created_at', 'created_at', { unique: false });
        }
      };
    });
  }

  private getStore(
    storeName: string,
    mode: IDBTransactionMode = 'readonly'
  ): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');

    if (!this.db.objectStoreNames.contains(storeName)) {
      throw new Error(
        `Object store '${storeName}' not found. Please refresh the page to upgrade the database.`
      );
    }

    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  hasStore(storeName: string): boolean {
    return this.db ? this.db.objectStoreNames.contains(storeName) : false;
  }

  async add<T>(storeName: string, data: T): Promise<string> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result as string);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T>(storeName: string, data: T): Promise<string> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result as string);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(storeName: string, id: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllByIndex<T>(
    storeName: string,
    indexName: string,
    query?: IDBValidKey
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName);
      const index = store.index(indexName);
      const request =
        query !== undefined ? index.getAll(query) : index.getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async exportData(): Promise<string> {
    const [
      products,
      sales,
      sale_items,
      cash_drawer,
      cash_movements,
      logo_config,
      materia_prima,
      product_materia_prima,
      combos,
      app_settings,
      kds_orders,
    ] = await Promise.all([
      this.getAll<Product>('products'),
      this.getAll<Sale>('sales'),
      this.getAll<SaleItem>('sale_items'),
      this.getAll<CashDrawer>('cash_drawer'),
      this.getAll<CashMovement>('cash_movements'),
      this.getAll<LogoConfig>('logo_config'),
      this.getAll<MateriaPrima>('materia_prima'),
      this.getAll<ProductMateriaPrima>('product_materia_prima'),
      this.hasStore('combos') ? this.getAll<Combo>('combos') : [],
      this.getAll<AppSettings>('app_settings'),
      this.hasStore('kds_orders') ? this.getAll<KDSOrder>('kds_orders') : [],
    ]);

    const data = {
      products,
      sales,
      sale_items,
      cash_drawer,
      cash_movements,
      logo_config,
      materia_prima,
      product_materia_prima,
      combos,
      app_settings,
      kds_orders,
    };

    return JSON.stringify(data, null, 2);
  }

  async importData(jsonString: string): Promise<void> {
    const data = JSON.parse(jsonString);

    await this.clear('products');
    await this.clear('sales');
    await this.clear('sale_items');
    await this.clear('cash_drawer');
    await this.clear('cash_movements');
    await this.clear('logo_config');
    await this.clear('materia_prima');
    await this.clear('product_materia_prima');
    if (this.hasStore('combos')) await this.clear('combos');
    await this.clear('app_settings');

    for (const product of data.products || []) {
      await this.add('products', product);
    }
    for (const sale of data.sales || []) {
      await this.add('sales', sale);
    }
    for (const item of data.sale_items || []) {
      await this.add('sale_items', item);
    }
    for (const drawer of data.cash_drawer || []) {
      await this.add('cash_drawer', drawer);
    }
    for (const movement of data.cash_movements || []) {
      await this.add('cash_movements', movement);
    }
    for (const config of data.logo_config || []) {
      await this.add('logo_config', config);
    }
    for (const mp of data.materia_prima || []) {
      await this.add('materia_prima', mp);
    }
    for (const pmp of data.product_materia_prima || []) {
      await this.add('product_materia_prima', pmp);
    }
    if (this.hasStore('combos')) {
      for (const combo of data.combos || []) {
        await this.add('combos', combo);
      }
    }
    for (const setting of data.app_settings || []) {
      await this.add('app_settings', setting);
    }
    if (this.hasStore('kds_orders')) {
      await this.clear('kds_orders');
      for (const order of data.kds_orders || []) {
        await this.add('kds_orders', order);
      }
    }
  }

  async resetDatabase(): Promise<void> {
    const promises = [
      this.clear('products'),
      this.clear('sales'),
      this.clear('sale_items'),
      this.clear('cash_drawer'),
      this.clear('cash_movements'),
      this.clear('logo_config'),
      this.clear('materia_prima'),
      this.clear('product_materia_prima'),
    ];
    if (this.hasStore('combos')) {
      promises.push(this.clear('combos'));
    }
    if (this.hasStore('kds_orders')) {
      promises.push(this.clear('kds_orders'));
    }
    await Promise.all(promises);
  }
}

export const db = new IndexedDBService();

/** Resolve kds_mode from settings, handling migration from legacy kds_enabled boolean */
export function resolveKdsMode(settings?: AppSettings | null): KdsMode {
  if (!settings) return 'off';
  if (settings.kds_mode) return settings.kds_mode;
  // Legacy migration: kds_enabled true → server, false/undefined → off
  if (settings.kds_enabled) return 'server';
  return 'off';
}
