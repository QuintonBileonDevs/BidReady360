import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'surface' | 'dark' | 'outline' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Editorial Panel Card:
 * 10px radius, hairline #D5E0EA border, subtle shadow.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'default',
      padding = 'md',
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles = 'rounded-[10px] transition-all relative';

    const paddingStyles = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8 sm:p-10',
    };

    const variantStyles = {
      default:
        'bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] shadow-subtle',
      surface:
        'bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A]',
      dark:
        'bg-[#10212E] text-white border border-[#1E364A] shadow-elevated',
      outline:
        'bg-transparent border border-[#D5E0EA] dark:border-[#1E364A]',
      interactive:
        'bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] shadow-subtle hover:border-[#1F5F99] dark:hover:border-[#6FAEE0] hover:shadow-elevated cursor-pointer',
    };

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${paddingStyles[padding]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
