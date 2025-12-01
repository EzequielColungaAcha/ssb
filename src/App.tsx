import React, { useState, useEffect } from 'react';
import {
  Store,
  Package,
  BarChart3,
  Settings,
  History,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Beef,
} from 'lucide-react';
import { Toaster } from 'sonner';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { LogoProvider, useLogo } from './contexts/LogoContext';
import { POSView } from './components/POSView';
import { ProductsView } from './components/ProductsView';
import { SalesView } from './components/SalesView';
import { MetricsView } from './components/MetricsView';
import { SettingsView } from './components/SettingsView';
import { CashDrawerView } from './components/CashDrawerView';
import { MateriaPrimaView } from './components/MateriaPrimaView';
import { LoadingScreen } from './components/LoadingScreen';
import { translations as t } from './lib/translations';
import { db } from './lib/indexeddb';

type View =
  | 'pos'
  | 'products'
  | 'materiaprima'
  | 'sales'
  | 'metrics'
  | 'cashdrawer'
  | 'settings';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('pos');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const { logoConfig, loading: logoLoading } = useLogo();
  const { theme, toggleTheme, isLoading: themeLoading } = useTheme();

  useEffect(() => {
    const checkDatabase = async () => {
      try {
        await db.init();
        if (
          !db.hasStore('materia_prima') ||
          !db.hasStore('product_materia_prima')
        ) {
          setNeedsRefresh(true);
        }
      } catch (error) {
        console.error('Database check error:', error);
      }
    };

    checkDatabase();

    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  if (logoLoading || themeLoading) {
    return <LoadingScreen />;
  }

  const navigation = [
    { id: 'pos' as View, label: t.nav.pos, icon: Store },
    { id: 'products' as View, label: t.nav.products, icon: Package },
    { id: 'materiaprima' as View, label: 'Materia Prima', icon: Beef },
    { id: 'sales' as View, label: t.nav.sales, icon: History },
    { id: 'metrics' as View, label: t.nav.metrics, icon: BarChart3 },
    { id: 'cashdrawer' as View, label: t.nav.cashDrawer, icon: Wallet },
    { id: 'settings' as View, label: t.nav.settings, icon: Settings },
  ];

  const renderView = () => {
    switch (currentView) {
      case 'pos':
        return <POSView />;
      case 'products':
        return <ProductsView />;
      case 'materiaprima':
        return <MateriaPrimaView />;
      case 'sales':
        return <SalesView />;
      case 'metrics':
        return <MetricsView />;
      case 'cashdrawer':
        return <CashDrawerView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <POSView />;
    }
  };

  return (
    <div
      className='flex h-screen'
      style={{
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text)',
      }}
    >
      {needsRefresh && (
        <div
          className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
          style={{ zIndex: 9999 }}
        >
          <div
            className='rounded-lg shadow-lg p-8 max-w-md'
            style={{ backgroundColor: 'var(--color-background-secondary)' }}
          >
            <h2
              className='text-2xl font-bold mb-4'
              style={{ color: 'var(--color-primary)' }}
            >
              Actualización Requerida
            </h2>
            <p className='mb-6' style={{ color: 'var(--color-text)' }}>
              La base de datos necesita actualizarse para soportar las nuevas
              funciones de Materia Prima. Por favor, recargá la página para
              continuar.
            </p>
            <button
              onClick={() => window.location.reload()}
              className='w-full px-4 py-3 rounded-lg text-white font-semibold'
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Recargar Página
            </button>
          </div>
        </div>
      )}
      <nav
        className={`${
          sidebarCollapsed ? 'w-20' : 'w-72'
        } shadow-lg flex flex-col transition-all duration-300`}
        style={{ backgroundColor: 'var(--color-background-secondary)' }}
      >
        <div className='p-4 border-b dark:border-gray-700'>
          {!sidebarCollapsed ? (
            <>
              <h1
                className='text-2xl font-bold'
                style={{ color: 'var(--color-primary)' }}
              >
                Súper Smash Burger
              </h1>
            </>
          ) : (
            <div className='flex justify-center'>
              {logoConfig.logo_image ? (
                <div className='w-12 h-12 flex items-center justify-center'>
                  <img
                    src={logoConfig.logo_image}
                    alt='Logo'
                    className='max-w-full max-h-full object-contain'
                  />
                </div>
              ) : (
                <div
                  className='text-2xl font-bold px-2 py-1 rounded'
                  style={{ color: 'var(--color-primary)' }}
                >
                  {logoConfig.acronym || 'SSB'}
                </div>
              )}
            </div>
          )}
          <div
            className={`mt-3 ${
              sidebarCollapsed
                ? 'text-xl flex justify-center'
                : 'text-3xl text-center'
            } font-mono font-bold`}
            style={{ color: 'var(--color-text)' }}
          >
            {currentTime}
          </div>
        </div>

        <div className='flex-1 p-3 space-y-2'>
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center ${
                  sidebarCollapsed
                    ? 'justify-center px-2 py-1'
                    : 'gap-4 px-5 py-4'
                } rounded-lg transition-all ${
                  isActive ? 'text-white shadow-lg' : 'hover:opacity-80'
                }`}
                style={
                  isActive
                    ? {
                        backgroundColor: 'var(--color-primary)',
                        minHeight: '56px',
                      }
                    : { color: 'var(--color-text)', minHeight: '56px' }
                }
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon size={24} />
                {!sidebarCollapsed && (
                  <span className='font-semibold text-base'>{item.label}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className='p-3 border-t dark:border-gray-700 space-y-2'>
          <button
            onClick={toggleTheme}
            className='w-full flex items-center justify-center gap-2 py-3 rounded-lg hover:opacity-80 transition-all'
            style={{ color: 'var(--color-text)', minHeight: '52px' }}
            title={
              theme === 'light'
                ? 'Cambiar a modo oscuro'
                : 'Cambiar a modo claro'
            }
          >
            {theme === 'light' ? <Moon size={24} /> : <Sun size={24} />}
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className='w-full flex items-center justify-center gap-2 py-3 rounded-lg hover:opacity-80 transition-all'
            style={{ color: 'var(--color-text)', minHeight: '52px' }}
            title={
              sidebarCollapsed
                ? 'Expandir barra lateral'
                : 'Contraer barra lateral'
            }
          >
            {sidebarCollapsed ? (
              <ChevronRight size={24} />
            ) : (
              <ChevronLeft size={24} />
            )}
            {!sidebarCollapsed && (
              <span className='text-base font-medium'>{t.nav.collapse}</span>
            )}
          </button>
        </div>
      </nav>

      <main className='flex-1 overflow-y-auto scrollbar-hide'>
        {renderView()}
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LogoProvider>
        <AppContent />
        <Toaster position='top-center' richColors duration={1000} />
      </LogoProvider>
    </ThemeProvider>
  );
}

export default App;
