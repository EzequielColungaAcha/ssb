import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, LogoConfig, ThemeConfig } from '../lib/indexeddb';

export type { ThemeConfig };

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  themeConfig: ThemeConfig;
  updateThemeConfig: (config: ThemeConfig) => Promise<void>;
  applyTheme: () => void;
  isLoading: boolean;
}

const defaultThemeConfig: ThemeConfig = {
  light: {
    primary: '#dc2626',
    accent: '#ea580c',
    text: '#111827',
    background: '#f3f4f6',
    backgroundSecondary: '#ffffff',
    backgroundAccent: '#e5e7eb',
  },
  dark: {
    primary: '#ef4444',
    accent: '#fb923c',
    text: '#f9fafb',
    background: '#0f172a',
    backgroundSecondary: '#1e293b',
    backgroundAccent: '#334155',
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);


export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('theme');
    return (stored as 'light' | 'dark') || 'light';
  });

  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(defaultThemeConfig);
  const [isLoaded, setIsLoaded] = useState(false);

  const applyThemeColors = (config: ThemeConfig, currentTheme: 'light' | 'dark') => {
    const colors = config[currentTheme];
    document.documentElement.style.setProperty('--color-primary', colors.primary);
    document.documentElement.style.setProperty('--color-accent', colors.accent);
    document.documentElement.style.setProperty('--color-text', colors.text);
    document.documentElement.style.setProperty('--color-background', colors.background);
    document.documentElement.style.setProperty('--color-background-secondary', colors.backgroundSecondary);
    document.documentElement.style.setProperty('--color-background-accent', colors.backgroundAccent);

    if (currentTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    const loadThemeConfig = async () => {
      try {
        await db.init();
        const data = await db.getAll<LogoConfig>('logo_config');
        console.log('Loading combined config from IndexedDB:', data);
        if (data.length > 0 && data[0].theme_config) {
          console.log('Applying loaded theme config:', data[0].theme_config);
          setThemeConfig(data[0].theme_config);
          applyThemeColors(data[0].theme_config, theme);
        } else {
          console.log('No theme config found, using default');
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
  }, []);

  useEffect(() => {
    if (isLoaded) {
      applyThemeColors(themeConfig, theme);
    }
  }, [theme, themeConfig, isLoaded]);

  const applyTheme = (configToApply?: ThemeConfig) => {
    const config = configToApply || themeConfig;
    applyThemeColors(config, theme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const updateThemeConfig = async (config: ThemeConfig) => {
    try {
      console.log('updateThemeConfig called with:', config);
      await db.init();
      const existing = await db.getAll<LogoConfig>('logo_config');

      const combinedConfig: LogoConfig = {
        id: existing.length > 0 ? existing[0].id : crypto.randomUUID(),
        acronym: existing.length > 0 ? existing[0].acronym : 'SSB',
        logo_image: existing.length > 0 ? existing[0].logo_image : undefined,
        theme_config: config,
        updated_at: new Date().toISOString(),
      };

      console.log('Saving combined config to IndexedDB:', combinedConfig);

      if (existing.length > 0) {
        await db.put('logo_config', combinedConfig);
      } else {
        await db.add('logo_config', combinedConfig);
      }

      console.log('Theme config saved successfully');
      setThemeConfig(config);
      applyTheme(config);
    } catch (error) {
      console.error('Failed to update theme config:', error);
      throw error;
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, themeConfig, updateThemeConfig, applyTheme, isLoading: !isLoaded }}>
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
