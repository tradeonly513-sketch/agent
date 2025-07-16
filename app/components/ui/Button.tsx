import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { classNames } from '~/utils/classNames';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 touch-manipulation active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-bolt-elements-borderColor bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text',
        secondary: 'bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs min-h-[44px] md:min-h-[36px]', // Mobile-friendly touch targets
        lg: 'h-11 rounded-md px-8 min-h-[44px]',
        icon: 'h-10 w-10 min-h-[44px] min-w-[44px] md:min-h-[40px] md:min-w-[40px]', // Ensure touch-friendly size
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  _asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, _asChild = false, ...props }, ref) => {
    return <button className={classNames(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
