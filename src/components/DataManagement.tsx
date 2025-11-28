import React, { useState } from 'react';
import { Download, Upload, AlertTriangle, Trash2 } from 'lucide-react';
import { db } from '../lib/indexeddb';

export function DataManagement() {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleExport = async () => {
    try {
      setError(null);
      const jsonData = await db.exportData();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pos-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccess('Datos exportados correctamente');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Error al exportar datos');
      console.error(err);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setError(null);
      const text = await file.text();
      await db.importData(text);
      setSuccess('Datos importados correctamente. Recargá la página para ver los cambios.');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError('Error al importar datos. Verificá que el archivo sea válido.');
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const handleResetDatabase = async () => {
    if (resetConfirmText !== 'RESETEAR') {
      setError('Debés escribir "RESETEAR" para confirmar');
      return;
    }

    try {
      setResetting(true);
      setError(null);
      await db.resetDatabase();
      setSuccess('Base de datos reseteada correctamente. Recargando...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError('Error al resetear la base de datos');
      console.error(err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="rounded-lg shadow-md p-6" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
      <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text)' }}>Gestión de Datos</h3>
      <p className="text-sm opacity-60 mb-6" style={{ color: 'var(--color-text)' }}>
        Exportá e importá todos los datos de la aplicación en formato JSON
      </p>

      <div className="space-y-4">
        <button
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Download size={20} />
          Exportar Datos
        </button>

        <div>
          <label className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer">
            <Upload size={20} />
            {importing ? 'Importando...' : 'Importar Datos'}
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={importing}
              className="hidden"
            />
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
            <AlertTriangle size={18} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg">
            <span className="text-sm">{success}</span>
          </div>
        )}

        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-300">
              <strong>Advertencia:</strong> Importar datos reemplazará todos los datos actuales.
              Asegurate de exportar tus datos antes de importar para evitar pérdida de información.
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t dark:border-gray-700">
          <h4 className="text-md font-bold mb-3 text-red-600 dark:text-red-400">Zona Peligrosa</h4>

          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <Trash2 size={20} />
              Resetear Base de Datos
            </button>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800 dark:text-red-300">
                    <strong>ADVERTENCIA:</strong> Esta acción eliminará TODOS los datos de forma permanente:
                    productos, ventas, movimientos de caja y configuración. Esta acción NO se puede deshacer.
                  </div>
                </div>
                <div className="text-sm text-red-800 dark:text-red-300 mb-3">
                  Escribí <strong>"RESETEAR"</strong> para confirmar:
                </div>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Escribí RESETEAR"
                  className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg dark:bg-gray-700 dark:text-white mb-3"
                  disabled={resetting}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleResetDatabase}
                  disabled={resetConfirmText !== 'RESETEAR' || resetting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={20} />
                  {resetting ? 'Reseteando...' : 'Confirmar Reseteo'}
                </button>
                <button
                  onClick={() => {
                    setShowResetConfirm(false);
                    setResetConfirmText('');
                    setError(null);
                  }}
                  disabled={resetting}
                  className="px-4 py-3 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
