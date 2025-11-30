import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, LogoConfig } from '../lib/indexeddb';

interface LogoContextType {
  logoConfig: { acronym: string; logo_image?: string };
  loading: boolean;
  updateLogoConfig: (config: { acronym: string; logo_image?: string }) => Promise<void>;
  refresh: () => Promise<void>;
}

const LogoContext = createContext<LogoContextType | undefined>(undefined);

export function LogoProvider({ children }: { children: React.ReactNode }) {
  const [logoConfig, setLogoConfig] = useState<{ acronym: string; logo_image?: string }>({
    acronym: 'SSB',
    logo_image: undefined
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogoConfig();
  }, []);

  const loadLogoConfig = async () => {
    try {
      await db.init();
      const data = await db.getAll<LogoConfig>('logo_config');
      if (data.length > 0) {
        setLogoConfig({
          acronym: data[0].acronym,
          logo_image: data[0].logo_image
        });
      }
    } catch (error) {
      console.error('Error loading logo config:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLogoConfig = async (config: { acronym: string; logo_image?: string }) => {
    try {
      await db.init();
      const existing = await db.getAll<LogoConfig>('logo_config');

      const logoConfigData: LogoConfig = {
        id: existing.length > 0 ? existing[0].id : crypto.randomUUID(),
        acronym: config.acronym,
        logo_image: config.logo_image,
        theme_config: existing.length > 0 ? existing[0].theme_config : undefined,
        updated_at: new Date().toISOString(),
      };

      if (existing.length > 0) {
        await db.put('logo_config', logoConfigData);
      } else {
        await db.add('logo_config', logoConfigData);
      }

      setLogoConfig(config);
    } catch (error) {
      console.error('Error updating logo config:', error);
      throw error;
    }
  };

  return (
    <LogoContext.Provider value={{ logoConfig, loading, updateLogoConfig, refresh: loadLogoConfig }}>
      {children}
    </LogoContext.Provider>
  );
}

export function useLogo() {
  const context = useContext(LogoContext);
  if (context === undefined) {
    throw new Error('useLogo must be used within a LogoProvider');
  }
  return context;
}
