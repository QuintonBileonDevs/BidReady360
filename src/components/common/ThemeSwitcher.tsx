import React, { useEffect, useRef, useState } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { ThemeMode, useTheme } from '../../context/ThemeContext';

interface ThemeSwitcherProps {
  variant?: 'compact' | 'segmented';
  className?: string;
}

const THEME_OPTIONS: { id: ThemeMode; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'dark', label: 'Dark', icon: Moon },
];

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (variant === 'segmented') {
    return (
      <div
        role="group"
        aria-label="Theme appearance"
        className={`inline-flex items-center gap-1 p-1 rounded-[8px] bg-[#EAF2FA] dark:bg-[#162C3D] border border-[#D5E0EA] dark:border-[#244157] ${className}`}
      >
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = theme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-[#1C364B] text-[#1F5F99] dark:text-[#6FAEE0] font-semibold shadow-subtle border border-[#D5E0EA] dark:border-[#244157]'
                  : 'text-[#43525F] dark:text-[#D3E3F2] hover:text-[#10212E] dark:hover:text-white border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const ActiveIcon =
    theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const activeLabel =
    theme === 'system'
      ? `System (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})`
      : theme === 'dark'
      ? 'Dark'
      : 'Light';

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Theme: ${activeLabel}. Change appearance`}
        title={`Theme: ${activeLabel}`}
        className="min-w-[40px] min-h-[40px] px-2.5 flex items-center justify-center gap-1.5 rounded-[6px] text-[#43525F] dark:text-[#D3E3F2] hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] hover:bg-[#EAF2FA] dark:hover:bg-[#162C3D] transition-colors cursor-pointer shrink-0"
      >
        <ActiveIcon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
        <span className="hidden xl:inline text-[13px] font-medium whitespace-nowrap">
          {theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'}
        </span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Choose theme"
          className="absolute right-0 mt-2 w-44 bg-white dark:bg-[#1C364B] border border-[#D5E0EA] dark:border-[#244157] rounded-[10px] p-1.5 z-50 shadow-elevated space-y-0.5"
        >
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  setTheme(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[6px] text-[13px] transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#EAF2FA] dark:bg-[#162C3D] text-[#1F5F99] dark:text-[#6FAEE0] font-semibold'
                    : 'text-[#10212E] dark:text-[#EAF2FA] hover:bg-[#EAF2FA]/60 dark:hover:bg-[#162C3D]/70'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  <span>{opt.label}</span>
                </span>
                {isActive && <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
