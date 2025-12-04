const DB_NAME = 'POS_DB';
const DB_VERSION = 5;

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
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
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
  payment_method: 'cash' | 'online';
  cash_received?: number;
  change_given?: number;
  bills_received?: Record<string, number>;
  bills_change?: Record<string, number>;
  completed_at: string;
  created_at: string;
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

export interface AppSettings {
  id: string;
  pos_layout_locked: boolean;
  category_order?: string[];
  kds_enabled?: boolean;
  kds_url?: string;
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
    ] = await Promise.all([
      this.getAll<Product>('products'),
      this.getAll<Sale>('sales'),
      this.getAll<SaleItem>('sale_items'),
      this.getAll<CashDrawer>('cash_drawer'),
      this.getAll<CashMovement>('cash_movements'),
      this.getAll<LogoConfig>('logo_config'),
      this.getAll<MateriaPrima>('materia_prima'),
      this.getAll<ProductMateriaPrima>('product_materia_prima'),
    ]);

    const data: Record<string, any[]> = {
      products,
      sales,
      sale_items,
      cash_drawer,
      cash_movements,
      logo_config,
      materia_prima,
      product_materia_prima,
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
  }

  async resetDatabase(): Promise<void> {
    await Promise.all([
      this.clear('products'),
      this.clear('sales'),
      this.clear('sale_items'),
      this.clear('cash_drawer'),
      this.clear('cash_movements'),
      this.clear('logo_config'),
      this.clear('materia_prima'),
      this.clear('product_materia_prima'),
    ]);
  }
}

export const db = new IndexedDBService();
