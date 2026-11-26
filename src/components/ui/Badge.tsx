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
      'bg-[#ECFDF5] dark:bg-[#2F8F5B]/20 text-[#2F8F5B] dark:text-[#6EE7B7] border border-[#A7F3D0] dark:border-[#2F8F5B]/40',
    warning:
      'bg-[#FFFBEB] dark:bg-[#E8A33D]/20 text-[#92400E] dark:text-[#FCD34D] border border-[#FDE68A] dark:border-[#E8A33D]/40',
    alert:
      'bg-[#FEF2F2] dark:bg-[#C2412D]/20 text-[#C2412D] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#C2412D]/40',
    pula:
      'bg-[#EAF2FA] dark:bg-[#6FAEE0]/20 text-[#1F5F99] dark:text-[#6FAEE0] border border-[#C9D9E8] dark:border-[#6FAEE0]/35',
    neutral:
      'bg-[#EAF2FA]/70 dark:bg-[#162C3D] text-[#43525F] dark:text-[#D3E3F2] border border-[#D5E0EA] dark:border-[#244157]',
    outline:
      'bg-transparent text-[#43525F] dark:text-[#D3E3F2] border border-[#D5E0EA] dark:border-[#244157]',
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
