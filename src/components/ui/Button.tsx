import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline-dark';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      ...props
    },
    ref
  ) => {
    // 6px control radius per tokens
    const baseStyles =
      'inline-flex items-center justify-center font-medium font-sans rounded-[6px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5F99] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none tracking-tight cursor-pointer';

    const sizeStyles = {
      sm: 'text-xs h-8 px-3 gap-1.5',
      md: 'text-sm h-10 px-4 gap-2',
      lg: 'text-base h-12 px-6 gap-2.5 font-semibold',
    };

    const variantStyles = {
      primary:
        'bg-[#1F5F99] text-white hover:bg-[#184b7a] active:bg-[#12385b] border border-[#1F5F99] shadow-subtle',
      secondary:
        'bg-white dark:bg-[#132635] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] dark:hover:bg-[#1A3347] border border-[#D5E0EA] dark:border-[#1E364A] shadow-subtle',
      ghost:
        'bg-transparent text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#EAF2FA] dark:hover:bg-[#162C3E] hover:text-[#10212E] dark:hover:text-white',
      destructive:
        'bg-[#C2412D] text-white hover:bg-[#a63624] active:bg-[#8b2d1d] border border-[#C2412D]',
      'outline-dark':
        'bg-transparent text-white border border-white/30 hover:bg-white/10 hover:border-white/50',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" strokeWidth={1.5} />
        ) : (
          leftIcon && <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4 [&>svg]:stroke-[1.5px]">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4 [&>svg]:stroke-[1.5px]">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
