import { db, LogoConfig } from './indexeddb';

const REGISTRY_NAME = 'POS_REGISTRY';
const REGISTRY_VERSION = 1;
const LEGACY_DB_NAME = 'POS_DB';
const ACTIVE_ID = 'active';

export interface BusinessRecord {
  id: string;
  name: string;
  acronym: string;
  logo_image?: string;
  dbName: string;
  created_at: string;
}

interface ActivePointer {
  id: typeof ACTIVE_ID;
  business_id: string;
}

let registryDb: IDBDatabase | null = null;

function openRegistry(): Promise<IDBDatabase> {
  if (registryDb) return Promise.resolve(registryDb);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(REGISTRY_NAME, REGISTRY_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      registryDb = request.result;
      resolve(request.result);
    };
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('businesses')) {
        database.createObjectStore('businesses', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta', { keyPath: 'id' });
      }
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  name: 'businesses' | 'meta',
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await openRegistry();
  return requestToPromise(run(database.transaction(name, mode).objectStore(name)));
}

export function suggestAcronym(name: string): string {
  const cleaned = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const words = cleaned.trim().split(/\s+/).filter(Boolean);
  const raw =
    words.length > 1
      ? words
          .slice(0, 3)
          .map((word) => word[0] || '')
          .join('')
      : cleaned.trim().slice(0, 3);
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'POS';
}

async function databaseExists(name: string): Promise<boolean> {
  const factory = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };
  if (typeof factory.databases !== 'function') return false;
  const databases = await factory.databases();
  return databases.some((entry) => entry.name === name);
}

export async function listBusinesses(): Promise<BusinessRecord[]> {
  const rows = await withStore(
    'businesses',
    'readonly',
    (store) => store.getAll() as IDBRequest<BusinessRecord[]>
  );
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

async function readActiveId(): Promise<string | null> {
  const row = await withStore(
    'meta',
    'readonly',
    (store) => store.get(ACTIVE_ID) as IDBRequest<ActivePointer | undefined>
  );
  return row?.business_id ?? null;
}

export async function setActiveBusiness(id: string): Promise<void> {
  await withStore('meta', 'readwrite', (store) =>
    store.put({ id: ACTIVE_ID, business_id: id } satisfies ActivePointer)
  );
}

async function clearActiveBusiness(): Promise<void> {
  await withStore('meta', 'readwrite', (store) => store.delete(ACTIVE_ID));
}

export async function getActiveBusiness(): Promise<BusinessRecord | null> {
  const businesses = await listBusinesses();
  if (businesses.length === 0) return null;
  const activeId = await readActiveId();
  return (
    businesses.find((business) => business.id === activeId) ??
    [...businesses].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  );
}

async function putBusiness(business: BusinessRecord): Promise<void> {
  await withStore('businesses', 'readwrite', (store) => store.put(business));
}

export async function syncActiveBranding(
  patch: Partial<Pick<BusinessRecord, 'name' | 'acronym' | 'logo_image'>>
): Promise<void> {
  const active = await getActiveBusiness();
  if (!active) return;
  await putBusiness({ ...active, ...patch });
}

export async function ensureActiveBusiness(): Promise<BusinessRecord | null> {
  const existing = await listBusinesses();
  if (existing.length > 0) {
    const active = await getActiveBusiness();
    if (active) {
      const activeId = await readActiveId();
      if (activeId !== active.id) await setActiveBusiness(active.id);
      return active;
    }
  }

  const legacyExists = await databaseExists(LEGACY_DB_NAME);
  if (!legacyExists) return null;

  await db.init(LEGACY_DB_NAME);
  const logos = await db.getAll<LogoConfig>('logo_config');
  const acronym = logos[0]?.acronym?.trim();
  const name =
    acronym && acronym !== 'SSB' ? acronym : 'Súper Smash Burger';
  const business: BusinessRecord = {
    id: crypto.randomUUID(),
    name,
    acronym: acronym || 'SSB',
    logo_image: logos[0]?.logo_image,
    dbName: LEGACY_DB_NAME,
    created_at: new Date().toISOString(),
  };
  await putBusiness(business);
  await setActiveBusiness(business.id);
  return business;
}

export async function createBusiness(input: {
  name: string;
  acronym?: string;
  logo_image?: string;
}): Promise<BusinessRecord> {
  const id = crypto.randomUUID();
  const acronym = (input.acronym || suggestAcronym(input.name)).trim() || 'POS';
  const business: BusinessRecord = {
    id,
    name: input.name.trim(),
    acronym,
    logo_image: input.logo_image,
    dbName: `POS_DB_${id}`,
    created_at: new Date().toISOString(),
  };
  await putBusiness(business);
  await setActiveBusiness(business.id);
  db.close();
  await db.init(business.dbName);
  await db.add('logo_config', {
    id: crypto.randomUUID(),
    acronym: business.acronym,
    logo_image: business.logo_image,
    updated_at: new Date().toISOString(),
  } satisfies LogoConfig);
  return business;
}

export async function activateBusiness(id: string): Promise<void> {
  await setActiveBusiness(id);
  db.close();
  window.location.reload();
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const timer = window.setTimeout(() => {
      finish(new Error('No se pudo borrar la base del negocio'));
    }, 2000);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => finish();
    request.onerror = () => finish(request.error);
    request.onblocked = () => {
      console.warn(`No se pudo borrar ${name} porque hay otra conexión abierta`);
    };
  });
}

export async function deleteBusiness(id: string): Promise<void> {
  const businesses = await listBusinesses();
  const target = businesses.find((business) => business.id === id);
  if (!target) return;

  db.close();
  await deleteDatabase(target.dbName);

  await withStore('businesses', 'readwrite', (store) => store.delete(id));

  const remaining = (await listBusinesses()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  if (remaining.length > 0) {
    await setActiveBusiness(remaining[0].id);
  } else {
    await clearActiveBusiness();
  }
  window.location.reload();
}
