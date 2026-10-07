import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options?: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      hint,
      error,
      options,
      children,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-[#10212E] dark:text-white tracking-tight"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            className={`w-full h-10 rounded-[6px] bg-white dark:bg-[#132635] text-sm text-[#10212E] dark:text-white border appearance-none pr-9 pl-3.5 transition-colors ${
              error
                ? 'border-[#C2412D] focus:border-[#C2412D]'
                : 'border-[#D5E0EA] dark:border-[#1E364A] focus:border-[#1F5F99]'
            } disabled:opacity-50 ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <ChevronDown
            className="absolute right-3 w-4 h-4 text-[#6B7A87] pointer-events-none"
            strokeWidth={1.5}
          />
        </div>

        {error && <p className="text-xs text-[#C2412D] font-medium">{error}</p>}
        {hint && !error && <p className="text-xs text-[#6B7A87]">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
