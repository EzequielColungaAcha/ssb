import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex min-h-[48px] w-full rounded-lg border-2 px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 touch-manipulation',
          className
        )}
        style={{
          backgroundColor: 'var(--color-background-secondary)',
          color: 'var(--color-text)',
          borderColor: 'var(--color-text)',
          ...style
        }}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
