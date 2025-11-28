import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/indexeddb';

export interface ThemeConfig {
  light: {
    primary: string;
    accent: string;
    text: string;
    background: string;
    backgroundSecondary: string;
    backgroundAccent: string;
  };
  dark: {
    primary: string;
    accent: string;
    text: string;
    background: string;
    backgroundSecondary: string;
    backgroundAccent: string;
  };
}

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  themeConfig: ThemeConfig;
  updateThemeConfig: (config: ThemeConfig) => Promise<void>;
  applyTheme: () => void;
}

const defaultThemeConfig: ThemeConfig = {
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

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeConfigData {
  id: string;
  config: ThemeConfig;
  updated_at: string;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('theme');
    return (stored as 'light' | 'dark') || 'light';
  });

  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(defaultThemeConfig);

  useEffect(() => {
    loadThemeConfig();
  }, []);

  const loadThemeConfig = async () => {
    try {
      await db.init();
      const data = await db.get<ThemeConfigData>('logo_config', 'theme_config');
      if (data?.config) {
        setThemeConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to load theme config:', error);
    }
  };

  const applyTheme = () => {
    const currentTheme = themeConfig[theme];
    document.documentElement.style.setProperty('--color-primary', currentTheme.primary);
    document.documentElement.style.setProperty('--color-accent', currentTheme.accent);
    document.documentElement.style.setProperty('--color-text', currentTheme.text);
    document.documentElement.style.setProperty('--color-background', currentTheme.background);
    document.documentElement.style.setProperty('--color-background-secondary', currentTheme.backgroundSecondary);
    document.documentElement.style.setProperty('--color-background-accent', currentTheme.backgroundAccent);

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    applyTheme();
  }, [theme, themeConfig]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const updateThemeConfig = async (config: ThemeConfig) => {
    try {
      await db.init();
      const themeData: ThemeConfigData = {
        id: 'theme_config',
        config,
        updated_at: new Date().toISOString(),
      };
      await db.put('logo_config', themeData);
      setThemeConfig(config);
    } catch (error) {
      console.error('Failed to update theme config:', error);
      throw error;
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, themeConfig, updateThemeConfig, applyTheme }}>
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
