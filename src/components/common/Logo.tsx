import React from 'react';
import { useApp } from '../../context/AppContext';

export interface IconProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'light' | 'dark';
  alt?: string;
}

/**
 * BidReadyIcon - Renders the BidReady360 standalone symbol (ring + amber dot)
 */
export const BidReadyIcon: React.FC<IconProps> = ({
  className = '',
  size = 'md',
  theme,
  alt = 'BidReady360',
}) => {
  let isDark = theme === 'dark';
  try {
    const { theme: appTheme } = useApp();
    const activeTheme = theme || appTheme;
    isDark = activeTheme === 'dark';
  } catch {
    isDark = theme === 'dark';
  }

  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <img
      src="/brand/bidready360-symbol.svg"
      alt={alt}
      width={size === 'xs' ? 16 : size === 'sm' ? 24 : size === 'md' ? 32 : size === 'lg' ? 48 : 64}
      height={size === 'xs' ? 16 : size === 'sm' ? 24 : size === 'md' ? 32 : size === 'lg' ? 48 : 64}
      className={`shrink-0 object-contain select-none ${sizeClasses[size]} ${className}`}
      loading="eager"
      decoding="async"
    />
  );
};

export interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  theme?: 'light' | 'dark';
  variant?: 'standard' | 'tagline' | 'black' | 'white';
  alt?: string;
}

/**
 * Logo - Renders the official BidReady360 SVG wordmark.
 * Replaces any code-drawn inline SVGs or HTML text.
 * Switches between primary (light backgrounds) and reversed (dark backgrounds).
 * Proportional scaling with minimum 120px width for readability.
 */
export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  theme,
  variant = 'standard',
  alt = 'BidReady360',
}) => {
  let isDark = theme === 'dark';
  try {
    const { theme: appTheme } = useApp();
    const activeTheme = theme || appTheme;
    isDark = activeTheme === 'dark';
  } catch {
    isDark = theme === 'dark';
  }

  // Determine SVG file based on variant and theme
  let logoSrc = '/brand/bidready360-logo-primary.svg';
  if (variant === 'tagline') {
    logoSrc = '/brand/bidready360-logo-tagline.svg';
  } else if (variant === 'black') {
    logoSrc = '/brand/bidready360-logo-black.svg';
  } else if (variant === 'white') {
    logoSrc = '/brand/bidready360-logo-white.svg';
  } else if (isDark) {
    logoSrc = '/brand/bidready360-logo-reversed.svg';
  }

  // Dimensions maintaining ~4.43:1 aspect ratio with min-width >= 120px
  const sizeMap: Record<NonNullable<LogoProps['size']>, { height: number; width: number; styleClasses: string }> = {
    sm: { height: 28, width: 124, styleClasses: 'h-[28px] w-auto min-w-[124px]' },
    md: { height: 36, width: 160, styleClasses: 'h-[36px] w-auto min-w-[160px]' },
    lg: { height: 44, width: 195, styleClasses: 'h-[44px] w-auto min-w-[195px]' },
    hero: { height: 56, width: 248, styleClasses: 'h-[48px] sm:h-[56px] w-auto min-w-[212px] sm:min-w-[248px]' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`inline-flex items-center shrink-0 select-none ${className}`}>
      <img
        src={logoSrc}
        alt={alt}
        width={currentSize.width}
        height={currentSize.height}
        className={`${currentSize.styleClasses} object-contain`}
        loading="eager"
        decoding="async"
      />
    </div>
  );
};
