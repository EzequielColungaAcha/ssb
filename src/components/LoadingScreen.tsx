import React from 'react';
import { useLogo } from '../contexts/LogoContext';

const iconPath = `${import.meta.env.BASE_URL}icon-192.png`;

export function LoadingScreen() {
  return (
    <div
      className='fixed inset-0 flex items-center justify-center'
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div className='flex flex-col items-center gap-6'>
        <div className='w-32 h-32 flex items-center justify-center animate-pulse'>
          <img
            src={iconPath}
            alt='Loading'
            className='max-w-full max-h-full object-contain'
          />
        </div>
      </div>
    </div>
  );
}

export function ViewLoader() {
  const { logoConfig } = useLogo();
  const logoSrc = logoConfig.logo_image || iconPath;

  return (
    <div className='flex items-center justify-center h-full w-full'>
      <div className='relative w-28 h-28 flex items-center justify-center'>
        {/* Spinning ring */}
        <div
          className='absolute inset-0 rounded-full animate-spin'
          style={{
            border: '4px solid var(--color-primary)',
            borderTopColor: 'transparent',
          }}
        />
        {/* Logo */}
        <img
          src={logoSrc}
          alt='Loading'
          className='w-16 h-16 object-contain rounded-lg'
        />
      </div>
    </div>
  );
}
