import React from 'react';
import { RingMotif } from './RingMotif';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon,
  className = '',
}) => {
  return (
    <div
      className={`relative overflow-hidden rounded-[10px] border border-dashed border-[#D5E0EA] dark:border-[#244157] bg-[#EAF2FA]/45 dark:bg-[#162C3D]/55 p-10 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 ${className}`}
    >
      <RingMotif size={220} dotAngle={60} opacity={0.35} position="center" />

      <div className="relative z-10 space-y-2 max-w-sm mx-auto">
        {icon && (
          <div className="mx-auto w-10 h-10 rounded-[6px] bg-white dark:bg-[#1C364B] border border-[#D5E0EA] dark:border-[#244157] flex items-center justify-center text-[#1F5F99] dark:text-[#6FAEE0] shadow-subtle mb-3 [&>svg]:w-5 [&>svg]:h-5 [&>svg]:stroke-[1.5px]">
            {icon}
          </div>
        )}
        <h4 className="text-base font-heading font-semibold text-[#10212E] dark:text-white">
          {title}
        </h4>
        <p className="text-xs text-[#6B7A87] dark:text-[#9CB4C9] leading-relaxed">
          {description}
        </p>
      </div>

      {action && <div className="relative z-10 pt-2">{action}</div>}
    </div>
  );
};
