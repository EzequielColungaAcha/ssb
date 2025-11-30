import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg text-base font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 touch-manipulation',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:opacity-90 active:scale-98',
        destructive: 'bg-red-600 text-white hover:bg-red-700 active:scale-98',
        outline: 'border-2 border-gray-300 bg-white hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 active:scale-98',
        secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 active:scale-98',
        ghost: 'hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-98',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-[48px] px-5 py-3',
        sm: 'min-h-[44px] rounded-md px-4 py-2',
        lg: 'min-h-[56px] rounded-lg px-8 py-4 text-lg',
        icon: 'min-h-[48px] min-w-[48px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
