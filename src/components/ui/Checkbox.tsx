import React from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className = '', id, checked, ...props }, ref) => {
    const checkId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <label htmlFor={checkId} className={`inline-flex items-start gap-2.5 cursor-pointer select-none ${className}`}>
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            id={checkId}
            checked={checked}
            className="peer sr-only"
            {...props}
          />
          <div className="w-4 h-4 rounded-[4px] border border-[#D5E0EA] dark:border-[#244157] bg-white dark:bg-[#162C3D] peer-checked:bg-[#1F5F99] dark:peer-checked:bg-[#6FAEE0] peer-checked:border-[#1F5F99] dark:peer-checked:border-[#6FAEE0] transition-colors flex items-center justify-center" />
          <Check
            className="w-3 h-3 text-white dark:text-[#10212E] absolute opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
            strokeWidth={2.5}
          />
        </div>

        {(label || description) && (
          <div className="space-y-0.5 text-left">
            {label && (
              <span className="text-sm font-medium text-[#10212E] dark:text-white block leading-tight">
                {label}
              </span>
            )}
            {description && (
              <span className="text-xs text-[#6B7A87] dark:text-[#9CB4C9] block leading-tight">
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
