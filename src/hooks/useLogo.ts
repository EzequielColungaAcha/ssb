import { useState, useEffect } from 'react';
import { db, LogoConfig } from '../lib/indexeddb';

export function useLogo() {
  const [logoConfig, setLogoConfig] = useState<{ acronym: string }>({ acronym: 'SSB' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogoConfig();
  }, []);

  const loadLogoConfig = async () => {
    try {
      await db.init();
      const data = await db.getAll<LogoConfig>('logo_config');
      if (data.length > 0) {
        setLogoConfig({ acronym: data[0].acronym });
      }
    } catch (error) {
      console.error('Error loading logo config:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLogoConfig = async (config: { acronym: string }) => {
    try {
      await db.init();
      const existing = await db.getAll<LogoConfig>('logo_config');

      const logoConfig: LogoConfig = {
        id: existing.length > 0 ? existing[0].id : crypto.randomUUID(),
        acronym: config.acronym,
        updated_at: new Date().toISOString(),
      };

      if (existing.length > 0) {
        await db.put('logo_config', logoConfig);
      } else {
        await db.add('logo_config', logoConfig);
      }

      setLogoConfig(config);
    } catch (error) {
      console.error('Error updating logo config:', error);
      throw error;
    }
  };

  return {
    logoConfig,
    loading,
    updateLogoConfig,
    refresh: loadLogoConfig,
  };
}
