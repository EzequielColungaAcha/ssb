import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import packageJson from './package.json';

// Plugin to update manifest.json version and generate version.json from package.json
const updateManifestVersion = (): Plugin => {
  return {
    name: 'update-manifest-version',
    buildStart() {
      const manifestPath = path.resolve(__dirname, 'public/manifest.json');
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        manifest.version = packageJson.version;
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      } catch (error) {
        console.error('Error updating manifest.json:', error);
      }

      // Generate version.json in public/ so it ends up in dist/
      const versionJsonPath = path.resolve(__dirname, 'public/version.json');
      try {
        fs.writeFileSync(
          versionJsonPath,
          JSON.stringify({ version: packageJson.version }) + '\n'
        );
      } catch (error) {
        console.error('Error writing version.json:', error);
      }

    },
    generateBundle() {
      // Emit sw.js with the version placeholder replaced, so the output
      // gets a unique cache name per deploy while the source keeps the placeholder.
      const swPath = path.resolve(__dirname, 'public/sw.js');
      try {
        const swContent = fs.readFileSync(swPath, 'utf-8');
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: swContent.replace(/__APP_VERSION__/g, packageJson.version),
        });
      } catch (error) {
        console.error('Error injecting version into sw.js:', error);
      }
    },
  };
};

export default defineConfig({
  plugins: [react(), updateManifestVersion()],
  base: process.env.LOCAL_DEPLOY ? '/' : '/ssb/',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
