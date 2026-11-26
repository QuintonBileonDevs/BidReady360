import React from 'react';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  count?: number | string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'segmented';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
  className = '',
}) => {
  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex items-center gap-1 p-1 bg-[#EAF2FA]/70 dark:bg-[#162C3D] border border-[#D5E0EA] dark:border-[#244157] rounded-[8px] ${className}`}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[6px] text-xs font-semibold transition-all select-none cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-[#1C364B] text-[#10212E] dark:text-white shadow-subtle border border-[#D5E0EA] dark:border-[#244157]'
                  : 'text-[#6B7A87] dark:text-[#9CB4C9] hover:text-[#10212E] dark:hover:text-white'
              }`}
            >
              {tab.icon && (
                <span className="shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5 [&>svg]:stroke-[1.5px]">
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-[4px] tabular-nums ${
                    isActive
                      ? 'bg-[#EAF2FA] dark:bg-[#6FAEE0]/20 text-[#1F5F99] dark:text-[#6FAEE0]'
                      : 'bg-[#D5E0EA]/60 dark:bg-[#244157] text-[#43525F] dark:text-[#D3E3F2]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-6 border-b border-[#D5E0EA] dark:border-[#244157] overflow-x-auto ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 pb-3.5 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap select-none cursor-pointer ${
              isActive
                ? 'border-[#1F5F99] dark:border-[#6FAEE0] text-[#1F5F99] dark:text-[#6FAEE0] font-semibold'
                : 'border-transparent text-[#6B7A87] dark:text-[#9CB4C9] hover:text-[#10212E] dark:hover:text-white hover:border-[#D5E0EA] dark:hover:border-[#244157]'
            }`}
          >
            {tab.icon && (
              <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4 [&>svg]:stroke-[1.5px]">
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-[4px] tabular-nums font-normal ${
                  isActive
                    ? 'bg-[#EAF2FA] dark:bg-[#6FAEE0]/20 text-[#1F5F99] dark:text-[#6FAEE0]'
                    : 'bg-[#EAF2FA]/70 dark:bg-[#162C3D] text-[#6B7A87] dark:text-[#9CB4C9]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
