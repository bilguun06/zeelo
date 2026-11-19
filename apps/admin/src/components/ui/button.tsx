import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white shadow-glow hover:bg-brand/90',
        secondary: 'bg-surface-alt text-ink hover:bg-line dark:bg-surface-altdark dark:text-ink-inverse dark:hover:bg-line-dark',
        outline: 'border border-line bg-transparent text-ink hover:bg-surface-alt dark:border-line-dark dark:text-ink-inverse dark:hover:bg-surface-altdark',
        ghost: 'text-ink-muted hover:bg-surface-alt hover:text-ink dark:hover:bg-surface-altdark dark:hover:text-ink-inverse',
        success: 'bg-mint text-navy hover:bg-mint/90',
        danger: 'bg-danger text-white hover:bg-danger/90',
        navy: 'bg-navy text-white hover:bg-navy-2 dark:bg-brand',
      },
      size: { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4', lg: 'h-12 px-6 text-base', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, loading, children, disabled, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    {children}
  </button>
));
Button.displayName = 'Button';
