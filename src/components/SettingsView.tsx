import React, { useState, useEffect, useRef } from 'react';
import { Palette, Type, Upload, X, Settings, Monitor, Truck, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../contexts/ThemeContext';
import { useLogo } from '../contexts/LogoContext';
import { translations as t } from '../lib/translations';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { DataManagement } from './DataManagement';
import { db, AppSettings, KdsMode, resolveKdsMode } from '../lib/indexeddb';

// Helper function to calculate contrast color (black or white) based on background luminance
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function SettingsView() {
  const { theme, themeConfig, updateThemeConfig, syncThemeToKDS } = useTheme();
  const { logoConfig, updateLogoConfig } = useLogo();
  const [colors, setColors] = useState(themeConfig);
  const [acronym, setAcronym] = useState(logoConfig.acronym);
  const [logoImage, setLogoImage] = useState<string | undefined>(
    logoConfig.logo_image
  );
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [kdsMode, setKdsMode] = useState<KdsMode>('off');
  const [kdsUrl, setKdsUrl] = useState('http://192.168.1.100:3001');
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);

  // Track if user has modified any field (triggers save on change)
  const hasUserModifiedRef = useRef(false);

  // Helper to mark form as modified
  const markModified = () => {
    hasUserModifiedRef.current = true;
  };

  // Store functions in refs to avoid dependency issues
  const updateThemeConfigRef = useRef(updateThemeConfig);
  const updateLogoConfigRef = useRef(updateLogoConfig);
  useEffect(() => {
    updateThemeConfigRef.current = updateThemeConfig;
    updateLogoConfigRef.current = updateLogoConfig;
  }, [updateThemeConfig, updateLogoConfig]);

  useEffect(() => {
    if (!isInitialized) {
      setColors(themeConfig);
    }
  }, [themeConfig, isInitialized]);

  useEffect(() => {
    if (!isInitialized) {
      setAcronym(logoConfig.acronym);
      setLogoImage(logoConfig.logo_image);
    }
  }, [logoConfig, isInitialized]);

  useEffect(() => {
    // Only load once
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadSettings = async () => {
      try {
        await db.init();
        const settings = await db.get<AppSettings>('app_settings', 'default');
        const loadedKdsMode = resolveKdsMode(settings);
        const loadedKdsUrl = settings?.kds_url || 'http://192.168.1.100:3001';
        const loadedDeliveryCharge = settings?.delivery_charge || 0;
        const loadedFreeDeliveryThreshold = settings?.free_delivery_threshold || 0;
        
        setKdsMode(loadedKdsMode);
        setKdsUrl(loadedKdsUrl);
        setDeliveryCharge(loadedDeliveryCharge);
        setFreeDeliveryThreshold(loadedFreeDeliveryThreshold);

        // Mark as initialized after React has processed state updates
        setTimeout(() => {
          setIsInitialized(true);
        }, 150);
      } catch (error) {
        console.error('Error loading settings:', error);
        // Still set initialized even on error
        setTimeout(() => setIsInitialized(true), 150);
      }
    };
    loadSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save with debounce when user modifies any field
  useEffect(() => {
    // Don't save until initialized and user has made changes
    if (!isInitialized || !hasUserModifiedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateThemeConfigRef.current(colors);
        await updateLogoConfigRef.current({ acronym, logo_image: logoImage });
        await db.init();
        const existingSettings = (await db.get<AppSettings>(
          'app_settings',
          'default'
        )) || {
          id: 'default',
          pos_layout_locked: false,
          updated_at: new Date().toISOString(),
        };

        const updatedSettings: AppSettings = {
          ...existingSettings,
          kds_mode: kdsMode,
          kds_enabled: kdsMode === 'server', // keep legacy field in sync
          kds_url: kdsUrl,
          delivery_charge: deliveryCharge,
          free_delivery_threshold: freeDeliveryThreshold,
          updated_at: new Date().toISOString(),
        };
        await db.put('app_settings', updatedSettings);

        // Sync theme to KDS after settings are saved using latest colors/mode
        if (kdsMode === 'server' && kdsUrl) {
          await syncThemeToKDS(colors, theme);
        }

        // Reset modified flag after successful save
        hasUserModifiedRef.current = false;
        
        toast.success(t.settings.successSaving);
      } catch (error) {
        console.error('Error saving settings:', error);
        toast.error(t.settings.errorSaving);
      } finally {
        setSaving(false);
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isInitialized, colors, acronym, logoImage, kdsMode, kdsUrl, deliveryCharge, freeDeliveryThreshold, syncThemeToKDS, theme]);

  const handleColorChange = (
    mode: 'light' | 'dark',
    key:
      | 'primary'
      | 'accent'
      | 'text'
      | 'background'
      | 'backgroundSecondary'
      | 'backgroundAccent',
    value: string
  ) => {
    markModified();
    setColors({
      ...colors,
      [mode]: {
        ...colors[mode],
        [key]: value,
      },
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpg|jpeg|svg\+xml)$/)) {
      toast.error('Por favor selecciona una imagen PNG, JPG o SVG');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no debe superar 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      markModified();
      setLogoImage(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    markModified();
    setLogoImage(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    markModified();
    const defaultConfig = {
      light: {
        primary: '#ef4444',
        accent: '#f59e0b',
        text: '#1f2937',
        background: '#f9fafb',
        backgroundSecondary: '#ffffff',
        backgroundAccent: '#f3f4f6',
      },
      dark: {
        primary: '#dc2626',
        accent: '#f59e0b',
        text: '#f9fafb',
        background: '#111827',
        backgroundSecondary: '#1f2937',
        backgroundAccent: '#374151',
      },
    };
    setColors(defaultConfig);
    setAcronym('SSB');
    setLogoImage(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    toast.info(t.settings.checkingUpdates);

    try {
      // Fetch version from KDS server
      const response = await fetch(`${kdsUrl}/health`);
      const data = await response.json();
      const serverVersion = data.ssb_version;

      if (!serverVersion) {
        toast.error(t.settings.updateError);
        setCheckingUpdate(false);
        return;
      }

      if (serverVersion !== __APP_VERSION__) {
        // Update available - clear cache and reload
        toast.success(`${t.settings.updateFound}: v${serverVersion}`);

        if ('serviceWorker' in navigator) {
          // Clear all caches
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));

          // Unregister service worker
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.unregister();
          }
        }

        // Reload the page to get fresh content
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast.info(t.settings.noUpdateAvailable);
        setCheckingUpdate(false);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      toast.error(t.settings.updateError);
      setCheckingUpdate(false);
    }
  };

  return (
    <div className='p-6 relative'>
      {/* Saving Overlay */}
      {saving && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm'>
          <div
            className='flex items-center gap-3 rounded-xl px-6 py-4 shadow-lg'
            style={{
              backgroundColor: 'var(--color-background-secondary)',
            }}
          >
            <Loader2
              className='animate-spin'
              size={24}
              style={{ color: 'var(--color-primary)' }}
            />
            <span
              className='text-lg font-semibold'
              style={{ color: 'var(--color-text)' }}
            >
              {t.settings.saving}
            </span>
          </div>
        </div>
      )}

      <div className='mb-6 relative'>
        <h1
          className='text-3xl font-bold flex items-center gap-3'
          style={{ color: 'var(--color-text)' }}
        >
          <Settings style={{ color: 'var(--color-primary)' }} />
          {t.settings.title}
        </h1>
        <p className='opacity-60 mt-2' style={{ color: 'var(--color-text)' }}>
          Personalizá la apariencia y configuración de tu sistema de punto de
          venta
        </p>
        <div className='absolute top-0 right-0 flex items-center gap-2'>
          <button
            onClick={handleCheckForUpdates}
            disabled={checkingUpdate || saving}
            className='flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50'
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#fff',
            }}
            title={t.settings.checkForUpdates}
          >
            <RefreshCw
              size={14}
              className={checkingUpdate ? 'animate-spin' : ''}
            />
            {checkingUpdate ? t.settings.checkingUpdates : t.settings.checkForUpdates}
          </button>
          <span
            className='px-3 py-1 rounded-full text-xs font-semibold'
            style={{
              backgroundColor: 'var(--color-background-accent)',
              color: 'var(--color-text)',
            }}
          >
            v{__APP_VERSION__}
          </span>
        </div>
      </div>

      <Card className='mb-6'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Type size={24} />
            {t.settings.logoSettings}
          </CardTitle>
          <CardDescription>{t.settings.logoSettingsDesc}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div>
            <Label htmlFor='logo-image'>Logo (PNG, JPG, SVG)</Label>
            <div className='mt-2 space-y-4'>
              {logoImage ? (
                <div className='flex items-center gap-4'>
                  <div className='w-24 h-24 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center overflow-hidden bg-white'>
                    <img
                      src={logoImage}
                      alt='Logo preview'
                      className='max-w-full max-h-full object-contain'
                    />
                  </div>
                  <Button
                    variant='secondary'
                    size='sm'
                    onClick={handleRemoveLogo}
                    disabled={saving}
                  >
                    <X size={16} className='mr-2' />
                    Eliminar Logo
                  </Button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type='file'
                    id='logo-image'
                    accept='image/png,image/jpeg,image/jpg,image/svg+xml'
                    onChange={handleImageUpload}
                    className='hidden'
                    disabled={saving}
                  />
                  <Button
                    variant='secondary'
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                  >
                    <Upload size={16} className='mr-2' />
                    Subir Logo
                  </Button>
                  <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
                    El logo tendrá prioridad sobre las letras cuando la barra
                    lateral esté colapsada
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor='acronym'>{t.settings.acronym}</Label>
            <Input
              id='acronym'
              value={acronym}
              onChange={(e) => { markModified(); setAcronym(e.target.value.toUpperCase()); }}
              placeholder={t.settings.acronymPlaceholder}
              maxLength={5}
              className='mt-2'
              disabled={saving}
            />
            <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
              Se mostrará cuando no haya logo o la barra esté expandida
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className='my-6'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Monitor size={24} />
            Kitchen Display System (KDS)
          </CardTitle>
          <CardDescription>
            Configurá la conexión al sistema de visualización de pedidos para
            cocina
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <Label className='mb-2 block'>Modo KDS</Label>
            <div className='flex gap-2'>
              {([
                { value: 'off', label: 'Desactivado' },
                { value: 'local', label: 'Local' },
                { value: 'server', label: 'Servidor' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type='button'
                  onClick={() => { markModified(); setKdsMode(opt.value); }}
                  disabled={saving}
                  className='px-4 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-50'
                  style={{
                    backgroundColor:
                      kdsMode === opt.value
                        ? 'var(--color-accent)'
                        : 'var(--color-background-secondary)',
                    color:
                      kdsMode === opt.value
                        ? 'var(--color-on-accent)'
                        : 'var(--color-text)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
              {kdsMode === 'off' && 'KDS desactivado. Los pedidos no se enviarán al sistema de cocina.'}
              {kdsMode === 'local' && 'Los pedidos se guardan localmente en este dispositivo.'}
              {kdsMode === 'server' && 'Los pedidos se envían a un servidor KDS remoto.'}
            </p>
          </div>

          {kdsMode === 'server' && (
            <div>
              <Label htmlFor='kds-url'>URL del servidor KDS</Label>
              <Input
              id='kds-url'
              type='url'
              value={kdsUrl}
              onChange={(e) => { markModified(); setKdsUrl(e.target.value); }}
              placeholder='http://192.168.1.100:3001'
              className='mt-2'
              disabled={saving}
              />
              <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
                Ingresá la dirección IP y puerto del servidor KDS (ejemplo:
                http://192.168.1.100:3001)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className='my-6'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Truck size={24} />
            Configuración de Delivery
          </CardTitle>
          <CardDescription>
            Configurá el costo de envío y el monto mínimo para envío gratis
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <Label htmlFor='delivery-charge'>Cargo por Delivery</Label>
            <Input
              id='delivery-charge'
              type='number'
              min='0'
              value={deliveryCharge}
              onChange={(e) => { markModified(); setDeliveryCharge(Number(e.target.value) || 0); }}
              placeholder='500'
              className='mt-2'
              disabled={saving}
            />
            <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
              Monto fijo que se agrega al total cuando el pedido es delivery
            </p>
          </div>

          <div>
            <Label htmlFor='free-delivery-threshold'>Monto mínimo para Delivery Gratis</Label>
            <Input
              id='free-delivery-threshold'
              type='number'
              min='0'
              value={freeDeliveryThreshold}
              onChange={(e) => { markModified(); setFreeDeliveryThreshold(Number(e.target.value) || 0); }}
              placeholder='10000'
              className='mt-2'
              disabled={saving}
            />
            <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
              Si el subtotal del carrito supera este monto, el delivery es gratis. Dejá en 0 para desactivar.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Palette size={24} />
            {t.settings.themeColors}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* LIGHT THEME SECTION */}
          <div>
            <h3 className='text-lg font-semibold mb-4 dark:text-white'>
              {t.settings.lightModeColors}
            </h3>

            <div className='grid md:grid-cols-2 gap-6'>
              {/* Color Pickers - thinner layout */}
              <div className='space-y-3'>
                {(
                  [
                    ['primary', t.settings.primaryColor],
                    ['accent', t.settings.accentColor],
                    ['text', t.settings.textColor],
                    ['background', t.settings.backgroundColor],
                    ['backgroundSecondary', 'Color Fondo Secundario'],
                    ['backgroundAccent', 'Color Fondo Acento'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <div className='flex items-center gap-2 mt-1'>
                      <input
                        type='color'
                        value={colors.light[key]}
                        onChange={(e) =>
                          handleColorChange('light', key, e.target.value)
                        }
                        className='w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                        disabled={saving}
                      />
                      <Input
                        type='text'
                        value={colors.light[key]}
                        onChange={(e) =>
                          handleColorChange('light', key, e.target.value)
                        }
                        className='flex-1'
                        disabled={saving}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Preview */}
              <div
                className='rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col text-xs'
                style={{
                  backgroundColor: colors.light.background,
                  color: colors.light.text,
                }}
              >
                <div
                  className='px-3 py-2 font-semibold flex justify-between items-center'
                  style={{ backgroundColor: colors.light.backgroundSecondary }}
                >
                  <span>Encabezado</span>
                  <span
                    className='rounded-full px-2 py-1 text-[10px]'
                    style={{
                      backgroundColor: colors.light.primary,
                      color: getContrastColor(colors.light.primary),
                    }}
                  >
                    Badge
                  </span>
                </div>

                <div className='p-3 space-y-2'>
                  <button
                    className='w-full rounded-md py-2 text-xs font-semibold'
                    style={{
                      backgroundColor: colors.light.primary,
                      color: getContrastColor(colors.light.primary),
                    }}
                  >
                    Botón Primario
                  </button>
                  <button
                    className='w-full rounded-md py-2 text-xs font-semibold'
                    style={{
                      backgroundColor: colors.light.accent,
                      color: getContrastColor(colors.light.accent),
                    }}
                  >
                    Botón Acento
                  </button>

                  {/* Primary and Accent on Secondary Background */}
                  <div
                    className='rounded-md p-2 mt-2 flex gap-2'
                    style={{
                      backgroundColor: colors.light.backgroundSecondary,
                    }}
                  >
                    <span
                      className='rounded px-2 py-1 text-[10px] font-semibold'
                      style={{
                        backgroundColor: colors.light.primary,
                        color: getContrastColor(colors.light.primary),
                      }}
                    >
                      Primario
                    </span>
                    <span
                      className='rounded px-2 py-1 text-[10px] font-semibold'
                      style={{
                        backgroundColor: colors.light.accent,
                        color: getContrastColor(colors.light.accent),
                      }}
                    >
                      Acento
                    </span>
                    <span
                      className='rounded px-2 py-1 text-[10px]'
                      style={{
                        color: colors.light.primary,
                        border: `1px solid ${colors.light.primary}`,
                      }}
                    >
                      Outline
                    </span>
                  </div>

                  <div
                    className='rounded-md p-2 mt-2'
                    style={{
                      backgroundColor: colors.light.backgroundAccent,
                    }}
                  >
                    <div className='font-semibold text-[11px] mb-1'>
                      Tarjeta de Ejemplo
                    </div>
                    <div className='text-[10px] opacity-80'>
                      Texto con color principal configurado.
                    </div>
                    <div className='flex gap-2 mt-2'>
                      <span
                        className='text-[10px] font-semibold'
                        style={{ color: colors.light.primary }}
                      >
                        Texto Primario
                      </span>
                      <span
                        className='text-[10px] font-semibold'
                        style={{ color: colors.light.accent }}
                      >
                        Texto Acento
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DARK THEME SECTION */}
          <div className='border-t pt-6 dark:border-gray-700'>
            <h3 className='text-lg font-semibold mb-4 dark:text-white'>
              {t.settings.darkModeColors}
            </h3>

            <div className='grid md:grid-cols-2 gap-6'>
              {/* Color Pickers - thinner layout */}
              <div className='space-y-3'>
                {(
                  [
                    ['primary', t.settings.primaryColor],
                    ['accent', t.settings.accentColor],
                    ['text', t.settings.textColor],
                    ['background', t.settings.backgroundColor],
                    ['backgroundSecondary', 'Color Fondo Secundario'],
                    ['backgroundAccent', 'Color Fondo Acento'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <div className='flex items-center gap-2 mt-1'>
                      <input
                        type='color'
                        value={colors.dark[key]}
                        onChange={(e) =>
                          handleColorChange('dark', key, e.target.value)
                        }
                        className='w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                        disabled={saving}
                      />
                      <Input
                        type='text'
                        value={colors.dark[key]}
                        onChange={(e) =>
                          handleColorChange('dark', key, e.target.value)
                        }
                        className='flex-1'
                        disabled={saving}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Preview */}
              <div
                className='rounded-lg border border-gray-700 shadow-sm overflow-hidden flex flex-col text-xs'
                style={{
                  backgroundColor: colors.dark.background,
                  color: colors.dark.text,
                }}
              >
                <div
                  className='px-3 py-2 font-semibold flex justify-between items-center'
                  style={{ backgroundColor: colors.dark.backgroundSecondary }}
                >
                  <span>Encabezado</span>
                  <span
                    className='rounded-full px-2 py-1 text-[10px]'
                    style={{
                      backgroundColor: colors.dark.primary,
                      color: getContrastColor(colors.dark.primary),
                    }}
                  >
                    Badge
                  </span>
                </div>

                <div className='p-3 space-y-2'>
                  <button
                    className='w-full rounded-md py-2 text-xs font-semibold'
                    style={{
                      backgroundColor: colors.dark.primary,
                      color: getContrastColor(colors.dark.primary),
                    }}
                  >
                    Botón Primario
                  </button>
                  <button
                    className='w-full rounded-md py-2 text-xs font-semibold'
                    style={{
                      backgroundColor: colors.dark.accent,
                      color: getContrastColor(colors.dark.accent),
                    }}
                  >
                    Botón Acento
                  </button>

                  {/* Primary and Accent on Secondary Background */}
                  <div
                    className='rounded-md p-2 mt-2 flex gap-2'
                    style={{
                      backgroundColor: colors.dark.backgroundSecondary,
                    }}
                  >
                    <span
                      className='rounded px-2 py-1 text-[10px] font-semibold'
                      style={{
                        backgroundColor: colors.dark.primary,
                        color: getContrastColor(colors.dark.primary),
                      }}
                    >
                      Primario
                    </span>
                    <span
                      className='rounded px-2 py-1 text-[10px] font-semibold'
                      style={{
                        backgroundColor: colors.dark.accent,
                        color: getContrastColor(colors.dark.accent),
                      }}
                    >
                      Acento
                    </span>
                    <span
                      className='rounded px-2 py-1 text-[10px]'
                      style={{
                        color: colors.dark.primary,
                        border: `1px solid ${colors.dark.primary}`,
                      }}
                    >
                      Outline
                    </span>
                  </div>

                  <div
                    className='rounded-md p-2 mt-2'
                    style={{
                      backgroundColor: colors.dark.backgroundAccent,
                    }}
                  >
                    <div className='font-semibold text-[11px] mb-1'>
                      Tarjeta de Ejemplo
                    </div>
                    <div className='text-[10px] opacity-80'>
                      Texto con color principal configurado.
                    </div>
                    <div className='flex gap-2 mt-2'>
                      <span
                        className='text-[10px] font-semibold'
                        style={{ color: colors.dark.primary }}
                      >
                        Texto Primario
                      </span>
                      <span
                        className='text-[10px] font-semibold'
                        style={{ color: colors.dark.accent }}
                      >
                        Texto Acento
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className='flex gap-3 pt-4 items-center'>
            <Button onClick={handleReset} variant='secondary' disabled={saving}>
              {t.settings.resetToDefault}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className='mt-6'>
        <DataManagement />
      </div>
    </div>
  );
}
