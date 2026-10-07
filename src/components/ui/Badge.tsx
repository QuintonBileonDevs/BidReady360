import React from 'react';

export type BadgeVariant = 'verified' | 'warning' | 'alert' | 'pula' | 'neutral' | 'outline';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  const variantStyles = {
    verified:
      'bg-[#ECFDF5] dark:bg-[#065F46]/25 text-[#065F46] dark:text-[#6EE7B7] border border-[#A7F3D0] dark:border-[#065F46]/40',
    warning:
      'bg-[#FFFBEB] dark:bg-[#92400E]/25 text-[#92400E] dark:text-[#FCD34D] border border-[#FDE68A] dark:border-[#92400E]/40',
    alert:
      'bg-[#FEF2F2] dark:bg-[#991B1B]/25 text-[#991B1B] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#991B1B]/40',
    pula:
      'bg-[#EAF2FA] dark:bg-[#1F5F99]/25 text-[#1F5F99] dark:text-[#6FAEE0] border border-[#C9D9E8] dark:border-[#1F5F99]/40',
    neutral:
      'bg-[#F7FAFD] dark:bg-[#16283A] text-[#43525F] dark:text-[#B2C3D2] border border-[#D5E0EA] dark:border-[#1E364A]',
    outline:
      'bg-transparent text-[#43525F] dark:text-[#B2C3D2] border border-[#D5E0EA] dark:border-[#1E364A]',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-[6px] tracking-tight whitespace-nowrap select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {icon && <span className="shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5 [&>svg]:stroke-[1.5px]">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
