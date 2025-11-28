import React, { useState, useEffect } from 'react';
import {
  Store,
  Package,
  BarChart3,
  Settings,
  ShoppingBag,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
} from 'lucide-react';
import { Toaster } from 'sonner';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { POSView } from './components/POSView';
import { ProductsView } from './components/ProductsView';
import { SalesView } from './components/SalesView';
import { MetricsView } from './components/MetricsView';
import { SettingsView } from './components/SettingsView';
import { CashDrawerView } from './components/CashDrawerView';
import { useLogo } from './hooks/useLogo';
import { translations as t } from './lib/translations';

type View =
  | 'pos'
  | 'products'
  | 'sales'
  | 'metrics'
  | 'cashdrawer'
  | 'settings';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('pos');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const { logoConfig } = useLogo();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
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

  const navigation = [
    { id: 'pos' as View, label: t.nav.pos, icon: Store },
    { id: 'products' as View, label: t.nav.products, icon: Package },
    { id: 'sales' as View, label: t.nav.sales, icon: ShoppingBag },
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
      <nav
        className={`${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } shadow-lg flex flex-col transition-all duration-300`}
        style={{ backgroundColor: 'var(--color-background-secondary)' }}
      >
        <div className='p-6 border-b dark:border-gray-700'>
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
              <div
                className='text-2xl font-bold px-2 py-1 rounded'
                style={{ color: 'var(--color-primary)' }}
              >
                {logoConfig.acronym || 'SSB'}
              </div>
            </div>
          )}
          <div
            className={`mt-4 ${
              sidebarCollapsed
                ? 'text-lg flex justify-center'
                : 'text-2xl text-center'
            } font-mono font-bold`}
            style={{ color: 'var(--color-text)' }}
          >
            {currentTime}
          </div>
        </div>

        <div className='flex-1 p-4'>
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center ${
                  sidebarCollapsed ? 'justify-center' : 'gap-3'
                } px-4 py-3 rounded-lg mb-2 transition-all ${
                  isActive ? 'text-white shadow-md' : 'hover:opacity-70'
                }`}
                style={
                  isActive
                    ? { backgroundColor: 'var(--color-primary)' }
                    : { color: 'var(--color-text)' }
                }
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon size={20} />
                {!sidebarCollapsed && (
                  <span className='font-semibold'>{item.label}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className='p-4 border-t dark:border-gray-700 space-y-2'>
          <button
            onClick={toggleTheme}
            className='w-full flex items-center justify-center gap-2 py-2 rounded-lg hover:opacity-70 transition-all'
            style={{ color: 'var(--color-text)' }}
            title={
              theme === 'light'
                ? 'Cambiar a modo oscuro'
                : 'Cambiar a modo claro'
            }
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className='w-full flex items-center justify-center gap-2 py-2 rounded-lg hover:opacity-70 transition-all'
            style={{ color: 'var(--color-text)' }}
            title={
              sidebarCollapsed
                ? 'Expandir barra lateral'
                : 'Contraer barra lateral'
            }
          >
            {sidebarCollapsed ? (
              <ChevronRight size={20} />
            ) : (
              <ChevronLeft size={20} />
            )}
            {!sidebarCollapsed && (
              <span className='text-sm font-medium'>{t.nav.collapse}</span>
            )}
          </button>
          {!sidebarCollapsed && (
            <div
              className='text-xs opacity-60 text-center mt-2'
              style={{ color: 'var(--color-text)' }}
            >
              v1.0.0
            </div>
          )}
        </div>
      </nav>

      <main className='flex-1 overflow-auto scrollbar-hide'>
        {renderView()}
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
      <Toaster position='top-center' richColors duration={1000} />
    </ThemeProvider>
  );
}

export default App;
