import React, { useState, useEffect, useRef } from 'react';
import { Palette, Type, Upload, X, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../contexts/ThemeContext';
import { useLogo } from '../contexts/LogoContext';
import { translations as t } from '../lib/translations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { DataManagement } from './DataManagement';
import { db, AppSettings } from '../lib/indexeddb';

export function SettingsView() {
  const { theme, themeConfig, updateThemeConfig, applyTheme } = useTheme();
  const { logoConfig, updateLogoConfig } = useLogo();
  const [colors, setColors] = useState(themeConfig);
  const [acronym, setAcronym] = useState(logoConfig.acronym);
  const [logoImage, setLogoImage] = useState<string | undefined>(logoConfig.logo_image);
  const [saving, setSaving] = useState(false);
  const [posLayoutLocked, setPosLayoutLocked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setColors(themeConfig);
  }, [themeConfig]);

  useEffect(() => {
    setAcronym(logoConfig.acronym);
    setLogoImage(logoConfig.logo_image);
  }, [logoConfig]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      await db.init();
      const settings = await db.get<AppSettings>('app_settings', 'default');
      if (settings) {
        setPosLayoutLocked(settings.pos_layout_locked);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleColorChange = (mode: 'light' | 'dark', key: 'primary' | 'accent' | 'text' | 'background' | 'backgroundSecondary' | 'backgroundAccent', value: string) => {
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

  const handlePosLayoutLockToggle = async () => {
    try {
      await db.init();
      const newLockState = !posLayoutLocked;

      if (newLockState) {
        window.dispatchEvent(new CustomEvent('pos-layout-save-order'));
      }

      const settings: AppSettings = {
        id: 'default',
        pos_layout_locked: newLockState,
        updated_at: new Date().toISOString(),
      };
      await db.put('app_settings', settings);
      setPosLayoutLocked(newLockState);

      if (newLockState) {
        toast.success('Diseño de POS bloqueado. No se podrán mover productos hasta desbloquear.');
      } else {
        toast.success('Diseño de POS desbloqueado. Ahora puedes reorganizar los productos.');
      }

      window.dispatchEvent(new CustomEvent('pos-layout-lock-changed', { detail: { locked: newLockState } }));
    } catch (error) {
      console.error('Error toggling POS layout lock:', error);
      toast.error('Error al cambiar el estado del bloqueo');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log('SettingsView handleSave: Saving theme config with colors:', colors);
      await updateThemeConfig(colors);
      console.log('SettingsView handleSave: Theme config saved, now saving logo config');
      await updateLogoConfig({ acronym, logo_image: logoImage });
      console.log('SettingsView handleSave: All settings saved successfully');
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
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold dark:text-white">{t.settings.title}</h1>
        <p
          className='text-sm opacity-60 mt-1'
          style={{ color: 'var(--color-text)' }}
        >
          Personalizá la apariencia y configuración de tu sistema de punto de venta
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type size={24} />
            {t.settings.logoSettings}
          </CardTitle>
          <CardDescription>{t.settings.logoSettingsDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="logo-image">Logo (PNG, JPG, SVG)</Label>
            <div className="mt-2 space-y-4">
              {logoImage ? (
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center overflow-hidden bg-white">
                    <img
                      src={logoImage}
                      alt="Logo preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRemoveLogo}
                  >
                    <X size={16} className="mr-2" />
                    Eliminar Logo
                  </Button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="logo-image"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={16} className="mr-2" />
                    Subir Logo
                  </Button>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    El logo tendrá prioridad sobre las letras cuando la barra lateral esté colapsada
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="acronym">{t.settings.acronym}</Label>
            <Input
              id="acronym"
              value={acronym}
              onChange={(e) => setAcronym(e.target.value.toUpperCase())}
              placeholder={t.settings.acronymPlaceholder}
              maxLength={5}
              className="mt-2"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Se mostrará cuando no haya logo o la barra esté expandida
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette size={24} />
            {t.settings.themeColors}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4 dark:text-white">{t.settings.lightModeColors}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t.settings.primaryColor}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={colors.light.primary}
                    onChange={(e) => handleColorChange('light', 'primary', e.target.value)}
                    className="w-16 h-16 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={colors.light.primary}
                    onChange={(e) => handleColorChange('light', 'primary', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>{t.settings.accentColor}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={colors.light.accent}
                    onChange={(e) => handleColorChange('light', 'accent', e.target.value)}
                    className="w-16 h-16 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={colors.light.accent}
                    onChange={(e) => handleColorChange('light', 'accent', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>{t.settings.textColor}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={colors.light.text}
                    onChange={(e) => handleColorChange('light', 'text', e.target.value)}
                    className="w-16 h-16 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={colors.light.text}
                    onChange={(e) => handleColorChange('light', 'text', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>{t.settings.backgroundColor}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={colors.light.background}
                    onChange={(e) => handleColorChange('light', 'background', e.target.value)}
                    className="w-16 h-16 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={colors.light.background}
                    onChange={(e) => handleColorChange('light', 'background', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Color de Fondo Secundario</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={colors.light.backgroundSecondary}
                    onChange={(e) => handleColorChange('light', 'backgroundSecondary', e.target.value)}
                    className="w-16 h-16 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={colors.light.backgroundSecondary}
                    onChange={(e) => handleColorChange('light', 'backgroundSecondary', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Color de Fondo Acento</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={colors.light.backgroundAccent}
                    onChange={(e) => handleColorChange('light', 'backgroundAccent', e.target.value)}
                    className="w-16 h-16 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={colors.light.backgroundAccent}
                    onChange={(e) => handleColorChange('light', 'backgroundAccent', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-6 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">{t.settings.darkModeColors}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t.settings.primaryColor}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={colors.dark.primary}
                    onChange={(e) => handleColorChange('dark', 'primary', e.target.value)}
                    className="w-16 h-16 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={colors.dark.primary}
                    onChange={(e) => handleColorChange('dark', 'primary', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>{t.settings.accentColor}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={colors.dark.accent}
                    onChange={(e) => handleColorChange('dark', 'accent', e.target.value)}
                    className="w-16 h-16 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={colors.dark.accent}
                    onChange={(e) => handleColorChange('dark', 'accent', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>{t.settings.textColor}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={colors.dark.text}
                    onChange={(e) => handleColorChange('dark', 'text', e.target.value)}
                    className="w-16 h-16 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={colors.dark.text}
                    onChange={(e) => handleColorChange('dark', 'text', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>{t.settings.backgroundColor}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={colors.dark.background}
                    onChange={(e) => handleColorChange('dark', 'background', e.target.value)}
                    className="w-16 h-16 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={colors.dark.background}
                    onChange={(e) => handleColorChange('dark', 'background', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Color de Fondo Secundario</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={colors.dark.backgroundSecondary}
                    onChange={(e) => handleColorChange('dark', 'backgroundSecondary', e.target.value)}
                    className="w-16 h-16 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={colors.dark.backgroundSecondary}
                    onChange={(e) => handleColorChange('dark', 'backgroundSecondary', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Color de Fondo Acento</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    value={colors.dark.backgroundAccent}
                    onChange={(e) => handleColorChange('dark', 'backgroundAccent', e.target.value)}
                    className="w-16 h-16 rounded cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={colors.dark.backgroundAccent}
                    onChange={(e) => handleColorChange('dark', 'backgroundAccent', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-6 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">{t.settings.preview}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-lg" style={{ backgroundColor: colors[theme].primary }}>
                <div className="text-white font-bold text-lg mb-2">{t.settings.primaryColorPreview}</div>
              </div>
              <div className="p-6 rounded-lg" style={{ backgroundColor: colors[theme].accent }}>
                <div className="text-white font-bold text-lg mb-2">{t.settings.accentColorPreview}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t.settings.saving : t.settings.saveChanges}
            </Button>
            <Button onClick={handleReset} variant="secondary">
              {t.settings.resetToDefault}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock size={24} />
            Configuración del Punto de Venta
          </CardTitle>
          <CardDescription>
            Controla cómo se comporta la organización de productos en el punto de venta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background-accent)' }}>
            <div className="flex-1">
              <div className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                Bloquear diseño del POS
              </div>
              <div className="text-sm opacity-70" style={{ color: 'var(--color-text)' }}>
                {posLayoutLocked
                  ? 'Los productos no se pueden reorganizar. Desbloquea para permitir cambios en el orden. Las posiciones actuales se mantendrán.'
                  : 'Los productos se pueden reorganizar arrastrándolos. Las posiciones se guardan automáticamente. Bloquea para evitar cambios accidentales durante las ventas.'
                }
              </div>
            </div>
            <Button
              onClick={handlePosLayoutLockToggle}
              variant={posLayoutLocked ? "default" : "secondary"}
              className="ml-4"
            >
              {posLayoutLocked ? (
                <>
                  <Lock size={16} className="mr-2" />
                  Bloqueado
                </>
              ) : (
                <>
                  <Lock size={16} className="mr-2" />
                  Desbloqueado
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <DataManagement />
      </div>
    </div>
  );
}
