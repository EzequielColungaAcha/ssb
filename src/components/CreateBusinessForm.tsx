import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createBusiness, suggestAcronym } from '../lib/businessRegistry';

export function CreateBusinessForm() {
  const [name, setName] = useState('');
  const [acronym, setAcronym] = useState('');
  const [acronymTouched, setAcronymTouched] = useState(false);
  const [logoImage, setLogoImage] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleName = (value: string) => {
    setName(value);
    if (!acronymTouched) setAcronym(suggestAcronym(value));
  };

  const handleLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogoImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || saving) return;

    try {
      setSaving(true);
      setError(null);
      await createBusiness({
        name,
        acronym,
        logo_image: logoImage,
      });
      window.location.reload();
    } catch (err) {
      console.error(err);
      setError('No se pudo crear el negocio');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-3'>
      <label className='block text-sm font-medium'>
        Nombre
        <input
          value={name}
          onChange={(event) => handleName(event.target.value)}
          required
          className='mt-1 w-full rounded-lg px-3 py-2 border'
          style={{
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text)',
            borderColor: 'var(--color-background-accent)',
          }}
          placeholder='Nombre del negocio'
        />
      </label>
      <label className='block text-sm font-medium'>
        Acrónimo
        <input
          value={acronym}
          onChange={(event) => {
            setAcronymTouched(true);
            setAcronym(event.target.value.toUpperCase().slice(0, 5));
          }}
          maxLength={5}
          className='mt-1 w-full rounded-lg px-3 py-2 border'
          style={{
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text)',
            borderColor: 'var(--color-background-accent)',
          }}
          placeholder='SSB'
        />
      </label>
      <div>
        <input
          ref={fileInputRef}
          type='file'
          accept='image/png,image/jpeg,image/jpg,image/svg+xml'
          onChange={handleLogo}
          className='hidden'
        />
        <button
          type='button'
          onClick={() => fileInputRef.current?.click()}
          className='text-sm px-3 py-2 rounded-lg'
          style={{
            backgroundColor: 'var(--color-background-accent)',
            color: 'var(--color-text)',
          }}
        >
          {logoImage ? 'Cambiar logo' : 'Logo opcional'}
        </button>
        {logoImage && (
          <img
            src={logoImage}
            alt='Logo'
            className='mt-2 h-12 w-12 object-contain'
          />
        )}
      </div>
      {error && <p className='text-sm text-red-600'>{error}</p>}
      <button
        type='submit'
        disabled={saving || !name.trim()}
        className='w-full px-4 py-3 rounded-lg font-semibold disabled:opacity-50'
        style={{
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-on-primary, #fff)',
        }}
      >
        {saving ? 'Creando...' : 'Crear negocio'}
      </button>
    </form>
  );
}
