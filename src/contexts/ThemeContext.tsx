import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { db, LogoConfig, ThemeConfig, AppSettings, resolveKdsMode } from '../lib/indexeddb';

export type { ThemeConfig };

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  themeConfig: ThemeConfig;
  updateThemeConfig: (config: ThemeConfig) => Promise<void>;
  applyTheme: () => void;
  syncThemeToKDS: (
    configOverride?: ThemeConfig,
    modeOverride?: 'light' | 'dark'
  ) => Promise<void>;
  isLoading: boolean;
}

// 🔆 Default palettes optimized for:
// - Light: visibility on sunny day
// - Dark: modern, low-strain deep slate
const defaultThemeConfig: ThemeConfig = {
  light: {
    primary: '#D7191C', // bright red, high visibility
    accent: '#0077CC', // strong blue accent
    text: '#1A1A1A', // very dark gray for better readability than pure black
    background: '#FAFAF7', // warm off-white (less glare)
    backgroundSecondary: '#FFFFFF',
    backgroundAccent: '#E5E7EB',
  },
  dark: {
    primary: '#3B82F6', // blue-500
    accent: '#10B981', // emerald-500
    text: '#E5E7EB', // gray-200
    background: '#0F172A', // slate-900
    backgroundSecondary: '#1E293B', // slate-800
    backgroundAccent: '#334155', // slate-700
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 🔍 Small helper: returns black or white depending on background luminance
function getReadableTextColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#FFFFFF';

  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const [R, G, B] = [r, g, b].map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );

  const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  // Simple WCAG-inspired threshold
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('theme');
    return (stored as 'light' | 'dark') || 'light';
  });

  const [themeConfig, setThemeConfig] =
    useState<ThemeConfig>(defaultThemeConfig);
  const [isLoaded, setIsLoaded] = useState(false);

  const applyThemeColors = (
    config: ThemeConfig,
    currentTheme: 'light' | 'dark'
  ) => {
    const colors = config[currentTheme];
    const root = document.documentElement;

    // Base colors
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-accent', colors.accent);
    root.style.setProperty('--color-text', colors.text);
    root.style.setProperty('--color-background', colors.background);
    root.style.setProperty(
      '--color-background-secondary',
      colors.backgroundSecondary
    );
    root.style.setProperty(
      '--color-background-accent',
      colors.backgroundAccent
    );

    // 🔁 Derived "on" colors for good contrast on primary/accent surfaces
    root.style.setProperty(
      '--color-on-primary',
      getReadableTextColor(colors.primary)
    );
    root.style.setProperty(
      '--color-on-accent',
      getReadableTextColor(colors.accent)
    );

    // Tailwind dark mode toggle
    if (currentTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  useEffect(() => {
    const loadThemeConfig = async () => {
      try {
        await db.init();
        const data = await db.getAll<LogoConfig>('logo_config');
        if (data.length > 0 && data[0].theme_config) {
          setThemeConfig(data[0].theme_config);
          applyThemeColors(data[0].theme_config, theme);
        } else {
          applyThemeColors(defaultThemeConfig, theme);
        }
      } catch (error) {
        console.error('Failed to load theme config:', error);
        applyThemeColors(defaultThemeConfig, theme);
      } finally {
        setIsLoaded(true);
      }
    };

    loadThemeConfig();
  }, [theme]);

  useEffect(() => {
    if (isLoaded) {
      applyThemeColors(themeConfig, theme);
    }
  }, [theme, themeConfig, isLoaded]);

  const applyTheme = (configToApply?: ThemeConfig) => {
    const config = configToApply || themeConfig;
    applyThemeColors(config, theme);
  };

  // Sync theme to KDS server
  const syncThemeToKDS = useCallback(
    async (configOverride?: ThemeConfig, modeOverride?: 'light' | 'dark') => {
      try {
        await db.init();
        const settings = await db.get<AppSettings>('app_settings', 'default');

        const mode = resolveKdsMode(settings);
        if (mode !== 'server' || !settings?.kds_url) {
          return;
        }

        const cfg = configOverride || themeConfig;
        const modeToSend = modeOverride || theme;
        const colors = cfg[modeToSend];
        const themeData = {
          mode: modeToSend,
          colors: {
            primary: colors.primary,
            accent: colors.accent,
            text: colors.text,
            background: colors.background,
            backgroundSecondary: colors.backgroundSecondary,
            backgroundAccent: colors.backgroundAccent,
          },
        };

      // Use AbortController for fetch timeout (3 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      try {
        await fetch(`${settings.kds_url}/api/theme`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(themeData),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      } catch (error) {
        console.error('Error syncing theme to KDS:', error);
      }
    },
    [theme, themeConfig]
  );

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Sync theme to KDS when theme changes
  useEffect(() => {
    if (isLoaded) {
      syncThemeToKDS();
    }
  }, [theme, isLoaded, syncThemeToKDS]);

  const updateThemeConfig = async (config: ThemeConfig) => {
    try {
      await db.init();
      const existing = await db.getAll<LogoConfig>('logo_config');

      const combinedConfig: LogoConfig = {
        id: existing.length > 0 ? existing[0].id : crypto.randomUUID(),
        acronym: existing.length > 0 ? existing[0].acronym : 'SSB',
        logo_image: existing.length > 0 ? existing[0].logo_image : undefined,
        theme_config: config,
        updated_at: new Date().toISOString(),
      };

      if (existing.length > 0) {
        await db.put('logo_config', combinedConfig);
      } else {
        await db.add('logo_config', combinedConfig);
      }

      setThemeConfig(config);
      applyTheme(config);

      // Sync updated theme colors to KDS immediately with explicit config/mode
      await syncThemeToKDS(config, theme);
    } catch (error) {
      console.error('Failed to update theme config:', error);
      throw error;
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        themeConfig,
        updateThemeConfig,
        applyTheme,
        syncThemeToKDS,
        isLoading: !isLoaded,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
