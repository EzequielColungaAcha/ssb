import React, { useState, useEffect, useRef } from 'react';
import { Palette, Type, Upload, X, Settings, Monitor } from 'lucide-react';
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
import { db, AppSettings } from '../lib/indexeddb';

export function SettingsView() {
  const { theme, themeConfig, updateThemeConfig } = useTheme();
  const { logoConfig, updateLogoConfig } = useLogo();
  const [colors, setColors] = useState(themeConfig);
  const [acronym, setAcronym] = useState(logoConfig.acronym);
  const [logoImage, setLogoImage] = useState<string | undefined>(
    logoConfig.logo_image
  );
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [kdsEnabled, setKdsEnabled] = useState(false);
  const [kdsUrl, setKdsUrl] = useState('http://192.168.1.100:3001');

  useEffect(() => {
    setColors(themeConfig);
  }, [themeConfig]);

  useEffect(() => {
    setAcronym(logoConfig.acronym);
    setLogoImage(logoConfig.logo_image);
  }, [logoConfig]);

  useEffect(() => {
    const loadKdsSettings = async () => {
      try {
        await db.init();
        const settings = await db.get<AppSettings>('app_settings', 'default');
        if (settings) {
          setKdsEnabled(settings.kds_enabled || false);
          setKdsUrl(settings.kds_url || 'http://192.168.1.100:3001');
        }
      } catch (error) {
        console.error('Error loading KDS settings:', error);
      }
    };
    loadKdsSettings();
  }, []);

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
      setLogoImage(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoImage(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateThemeConfig(colors);
      await updateLogoConfig({ acronym, logo_image: logoImage });

      await db.init();
      const existingSettings =
        (await db.get<AppSettings>('app_settings', 'default')) || {
          id: 'default',
          pos_layout_locked: false,
          updated_at: new Date().toISOString(),
        };

      const updatedSettings: AppSettings = {
        ...existingSettings,
        kds_enabled: kdsEnabled,
        kds_url: kdsUrl,
        updated_at: new Date().toISOString(),
      };

      await db.put('app_settings', updatedSettings);

      toast.success(t.settings.successSaving);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(t.settings.errorSaving);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
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

  return (
    <div className='p-6'>
      <div className='mb-6'>
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
                  />
                  <Button
                    variant='secondary'
                    onClick={() => fileInputRef.current?.click()}
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
              onChange={(e) => setAcronym(e.target.value.toUpperCase())}
              placeholder={t.settings.acronymPlaceholder}
              maxLength={5}
              className='mt-2'
            />
            <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
              Se mostrará cuando no haya logo o la barra esté expandida
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
                        className='w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-gray-600'
                      />
                      <Input
                        type='text'
                        value={colors.light[key]}
                        onChange={(e) =>
                          handleColorChange('light', key, e.target.value)
                        }
                        className='flex-1'
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
                      color: '#fff',
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
                      color: '#fff',
                    }}
                  >
                    Botón Primario
                  </button>
                  <button
                    className='w-full rounded-md py-2 text-xs font-semibold'
                    style={{
                      backgroundColor: colors.light.accent,
                      color: '#fff',
                    }}
                  >
                    Botón Acento
                  </button>

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
                        className='w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-gray-600'
                      />
                      <Input
                        type='text'
                        value={colors.dark[key]}
                        onChange={(e) =>
                          handleColorChange('dark', key, e.target.value)
                        }
                        className='flex-1'
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
                      color: '#fff',
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
                      color: '#fff',
                    }}
                  >
                    Botón Primario
                  </button>
                  <button
                    className='w-full rounded-md py-2 text-xs font-semibold'
                    style={{
                      backgroundColor: colors.dark.accent,
                      color: '#fff',
                    }}
                  >
                    Botón Acento
                  </button>

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
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className='flex gap-3 pt-4'>
            <Button onClick={handleSave} disabled={saving} variant='secondary'>
              {saving ? t.settings.saving : t.settings.saveChanges}
            </Button>
            <Button onClick={handleReset} variant='secondary'>
              {t.settings.resetToDefault}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className='mt-6'>
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
          <div className='flex items-center gap-3'>
            <input
              type='checkbox'
              id='kds-enabled'
              checked={kdsEnabled}
              onChange={(e) => setKdsEnabled(e.target.checked)}
              className='w-5 h-5 rounded cursor-pointer'
            />
            <Label htmlFor='kds-enabled' className='cursor-pointer'>
              Enviar pedidos al KDS automáticamente
            </Label>
          </div>

          {kdsEnabled && (
            <div>
              <Label htmlFor='kds-url'>URL del servidor KDS</Label>
              <Input
                id='kds-url'
                type='url'
                value={kdsUrl}
                onChange={(e) => setKdsUrl(e.target.value)}
                placeholder='http://192.168.1.100:3001'
                className='mt-2'
              />
              <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
                Ingresá la dirección IP y puerto del servidor KDS (ejemplo:
                http://192.168.1.100:3001)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className='mt-6'>
        <DataManagement />
      </div>
    </div>
  );
}
