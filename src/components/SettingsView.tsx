import React, { useState, useEffect } from 'react';
import { Palette, Type } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../contexts/ThemeContext';
import { useLogo } from '../hooks/useLogo';
import { translations as t } from '../lib/translations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { DataManagement } from './DataManagement';

export function SettingsView() {
  const { theme, themeConfig, updateThemeConfig, applyTheme } = useTheme();
  const { logoConfig, updateLogoConfig } = useLogo();
  const [colors, setColors] = useState(themeConfig);
  const [acronym, setAcronym] = useState(logoConfig.acronym);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setColors(themeConfig);
  }, [themeConfig]);

  useEffect(() => {
    setAcronym(logoConfig.acronym);
  }, [logoConfig]);

  const handleColorChange = (mode: 'light' | 'dark', key: 'primary' | 'accent' | 'text' | 'background' | 'backgroundSecondary' | 'backgroundAccent', value: string) => {
    setColors({
      ...colors,
      [mode]: {
        ...colors[mode],
        [key]: value,
      },
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateThemeConfig(colors);
      await updateLogoConfig({ acronym });
      applyTheme();
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
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 dark:text-white">{t.settings.title}</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type size={24} />
            {t.settings.logoSettings}
          </CardTitle>
          <CardDescription>{t.settings.logoSettingsDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label htmlFor="acronym">{t.settings.acronym}</Label>
            <Input
              id="acronym"
              value={acronym}
              onChange={(e) => setAcronym(e.target.value.toUpperCase())}
              placeholder={t.settings.acronymPlaceholder}
              maxLength={5}
              className="mt-2"
            />
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

      <div className="mt-6">
        <DataManagement />
      </div>
    </div>
  );
}
