import React from 'react';

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
