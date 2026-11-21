import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLogo } from '../contexts/LogoContext';
import { useBusiness } from '../contexts/BusinessContext';
import { activateBusiness } from '../lib/businessRegistry';
import { CreateBusinessForm } from './CreateBusinessForm';

const HOLD_MS = 500;
const MOVE_CANCEL_PX = 10;

export function BusinessSwitcher({ collapsed }: { collapsed: boolean }) {
  const { logoConfig } = useLogo();
  const { business, businesses } = useBusiness();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const timerRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    originRef.current = null;
  };

  const close = () => {
    setOpen(false);
    setCreating(false);
  };

  useEffect(() => {
    if (!open) return;

    const main = document.querySelector('main');
    const previousOverflow = main?.style.overflow ?? '';
    if (main) main.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (main) main.style.overflow = previousOverflow;
    };
  }, [open]);

  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    originRef.current = { x: event.clientX, y: event.clientY };
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      setOpen(true);
      timerRef.current = null;
    }, HOLD_MS);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!originRef.current) return;
    const dx = event.clientX - originRef.current.x;
    const dy = event.clientY - originRef.current.y;
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) clearTimer();
  };

  const mark = logoConfig.logo_image ? (
    <img
      src={logoConfig.logo_image}
      alt={business.name}
      className={
        collapsed
          ? 'max-w-full max-h-full object-contain'
          : 'h-10 w-10 object-contain'
      }
    />
  ) : (
    <div
      className={`font-bold ${collapsed ? 'text-2xl px-2 py-1' : 'text-lg px-2 py-1 rounded'}`}
      style={{ color: 'var(--color-primary)' }}
    >
      {logoConfig.acronym || business.acronym || 'SSB'}
    </div>
  );

  return (
    <div className='relative'>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={clearTimer}
        onPointerCancel={clearTimer}
        onPointerLeave={clearTimer}
        onContextMenu={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          suppressClickRef.current = false;
        }}
        role='button'
        tabIndex={0}
        aria-label={`${business.name}. Mantené presionado para cambiar de negocio`}
        className={
          collapsed
            ? 'flex flex-col items-center gap-1'
            : 'flex items-center gap-3'
        }
        style={{ touchAction: 'none', userSelect: 'none', cursor: 'pointer' }}
        title='Mantené presionado para cambiar de negocio'
      >
        <div
          className={
            collapsed
              ? 'w-12 h-12 flex items-center justify-center'
              : 'w-10 h-10 flex items-center justify-center shrink-0'
          }
        >
          {mark}
        </div>
        <div
          className={
            collapsed
              ? 'text-[10px] font-semibold text-center leading-tight max-w-full truncate'
              : 'text-lg font-bold leading-tight'
          }
          style={{ color: collapsed ? 'var(--color-text)' : 'var(--color-primary)' }}
        >
          {business.name}
        </div>
      </div>

      {open &&
        createPortal(
          <div
            className='fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'
            onClick={close}
          >
            <div
              ref={dialogRef}
              role='dialog'
              aria-modal='true'
              aria-label='Cambiar de negocio'
              tabIndex={-1}
              className='w-full max-w-sm rounded-lg shadow-xl p-4 space-y-2 outline-none'
              style={{
                backgroundColor: 'var(--color-background-secondary)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-background-accent)',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <p className='text-xs font-semibold opacity-60 px-1'>Negocios</p>
              <div className='max-h-64 overflow-y-auto space-y-1 scrollbar-hide'>
                {businesses.map((item) => {
                  const selected = item.id === business.id;
                  return (
                    <button
                      key={item.id}
                      type='button'
                      disabled={selected}
                      onClick={() => activateBusiness(item.id)}
                      className='w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left disabled:opacity-100'
                      style={{
                        backgroundColor: selected
                          ? 'var(--color-primary)'
                          : 'transparent',
                        color: selected
                          ? 'var(--color-on-primary, #fff)'
                          : 'var(--color-text)',
                      }}
                    >
                      <span className='text-xs font-bold w-10 shrink-0'>
                        {item.acronym}
                      </span>
                      <span className='text-sm font-medium truncate'>{item.name}</span>
                    </button>
                  );
                })}
              </div>
              {creating ? (
                <div
                  className='pt-2 border-t'
                  style={{ borderColor: 'var(--color-background-accent)' }}
                >
                  <CreateBusinessForm />
                </div>
              ) : (
                <button
                  type='button'
                  onClick={() => setCreating(true)}
                  className='w-full px-3 py-2 rounded-lg text-sm font-semibold'
                  style={{
                    backgroundColor: 'var(--color-background-accent)',
                    color: 'var(--color-text)',
                  }}
                >
                  Crear negocio
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
