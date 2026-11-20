import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { db } from '../lib/indexeddb';
import {
  BusinessRecord,
  ensureActiveBusiness,
  listBusinesses,
} from '../lib/businessRegistry';
import { LoadingScreen } from '../components/LoadingScreen';
import { CreateBusinessForm } from '../components/CreateBusinessForm';

interface BusinessContextType {
  business: BusinessRecord;
  businesses: BusinessRecord[];
  applyLocal: (
    patch: Partial<Pick<BusinessRecord, 'name' | 'acronym' | 'logo_image'>>
  ) => void;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [business, setBusiness] = useState<BusinessRecord | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRecord[]>([]);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const active = await ensureActiveBusiness();
        if (cancelled) return;
        if (!active) {
          setBusiness(null);
          return;
        }
        await db.init(active.dbName);
        if (cancelled) return;
        activeIdRef.current = active.id;
        setBusiness(active);
        setBusinesses(await listBusinesses());
      } catch (error) {
        console.error('Error al abrir el negocio activo:', error);
      } finally {
        if (!cancelled) setBooting(false);
      }
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyLocal = useCallback(
    (patch: Partial<Pick<BusinessRecord, 'name' | 'acronym' | 'logo_image'>>) => {
      const id = activeIdRef.current;
      if (!id) return;
      setBusiness((current) =>
        current && current.id === id ? { ...current, ...patch } : current
      );
      setBusinesses((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    []
  );

  if (booting) return <LoadingScreen />;

  if (!business) {
    return (
      <div
        className='min-h-screen flex items-center justify-center p-6'
        style={{
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-text)',
        }}
      >
        <div
          className='w-full max-w-md rounded-lg shadow-lg p-6'
          style={{ backgroundColor: 'var(--color-background-secondary)' }}
        >
          <h1
            className='text-2xl font-bold mb-2'
            style={{ color: 'var(--color-primary)' }}
          >
            Crear negocio
          </h1>
          <p className='text-sm opacity-70 mb-4'>
            Todavía no hay un negocio. Creá el primero para empezar a vender.
          </p>
          <CreateBusinessForm />
        </div>
      </div>
    );
  }

  return (
    <BusinessContext.Provider value={{ business, businesses, applyLocal }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}
