import React from 'react';
import { useApp } from '../../context/AppContext';

interface IconProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'light' | 'dark';
}

export const BidReadyIcon: React.FC<IconProps> = ({
  className = '',
  size = 'md',
  theme,
}) => {
  const { theme: appTheme } = useApp();
  const activeTheme = theme || appTheme;
  const isDark = activeTheme === 'dark';

  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const ringStroke = isDark ? '#6FAEE0' : '#1F5F99';

  return (
    <svg
      className={`${sizeClasses[size]} shrink-0 ${className}`}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M 97.59 46.32 A 40 40 0 1 1 73.68 22.41"
        fill="none"
        stroke={ringStroke}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <circle cx="60" cy="60" r="12" fill="#E8A33D" />
    </svg>
  );
};

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  theme?: 'light' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', theme }) => {
  const { theme: appTheme } = useApp();
  const activeTheme = theme || appTheme;
  const isDark = activeTheme === 'dark';

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    hero: 'w-12 h-12 sm:w-16 sm:h-16',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    hero: 'text-3xl sm:text-4xl lg:text-5xl',
  };

  const ringStroke = isDark ? '#6FAEE0' : '#1F5F99';
  const textColor = isDark ? '#FFFFFF' : '#10212E';
  const accentColor = isDark ? '#6FAEE0' : '#1F5F99';

  return (
    <div
      className={`inline-flex items-center gap-[0.45em] select-none font-heading font-bold tracking-[-0.03em] leading-none ${className}`}
      style={{ color: textColor }}
    >
      <svg
        className={`${iconSizes[size]} shrink-0`}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M 97.59 46.32 A 40 40 0 1 1 73.68 22.41"
          fill="none"
          stroke={ringStroke}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <circle cx="60" cy="60" r="12" fill="#E8A33D" />
      </svg>

      <span className={textSizes[size]}>
        BidReady<b style={{ color: accentColor, fontWeight: 700 }}>360</b>
      </span>
    </div>
  );
};
