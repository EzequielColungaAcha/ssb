import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBusiness } from '../contexts/BusinessContext';
import { deleteBusiness } from '../lib/businessRegistry';

export function DeleteBusinessSection() {
  const { business } = useBusiness();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const matches = confirmText === business.name;

  const handleDelete = async () => {
    if (!matches || deleting) return;
    try {
      setDeleting(true);
      await deleteBusiness(business.id);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo eliminar el negocio');
      setDeleting(false);
    }
  };

  return (
    <div
      className='rounded-lg shadow-md p-6 mt-6'
      style={{ backgroundColor: 'var(--color-background-secondary)' }}
    >
      <h3 className='text-lg font-bold mb-2 text-red-600 dark:text-red-400'>
        Eliminar negocio
      </h3>
      <p className='text-sm opacity-70 mb-4' style={{ color: 'var(--color-text)' }}>
        Borra el negocio activo y todo lo que hay en él.
      </p>

      {!open ? (
        <button
          type='button'
          onClick={() => setOpen(true)}
          className='w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors'
        >
          <Trash2 size={20} />
          Eliminar {business.name}
        </button>
      ) : (
        <div className='space-y-4'>
          <div className='p-4 bg-red-50 dark:bg-red-900/20 rounded-lg'>
            <div className='flex items-start gap-2 mb-3'>
              <AlertTriangle
                size={18}
                className='text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5'
              />
              <div className='text-sm text-red-800 dark:text-red-300'>
                <strong>Esto borra todo este negocio:</strong> productos, materia
                prima, combos, ventas, caja, pedidos KDS locales y ajustes. No se
                puede deshacer. Si necesitás una copia, exportá antes desde
                Gestión de datos.
              </div>
            </div>
            <div className='text-sm text-red-800 dark:text-red-300 mb-3'>
              Escribí <strong>{business.name}</strong> para confirmar:
            </div>
            <input
              type='text'
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={business.name}
              className='w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg dark:bg-gray-700 dark:text-white'
              disabled={deleting}
            />
          </div>
          <div className='flex gap-2'>
            <button
              type='button'
              onClick={handleDelete}
              disabled={!matches || deleting}
              className='flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              <Trash2 size={20} />
              {deleting ? 'Eliminando...' : 'Eliminar negocio'}
            </button>
            <button
              type='button'
              onClick={() => {
                setOpen(false);
                setConfirmText('');
              }}
              disabled={deleting}
              className='px-4 py-3 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg'
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
