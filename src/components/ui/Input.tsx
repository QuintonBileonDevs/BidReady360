import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      leftIcon,
      rightIcon,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-[#10212E] dark:text-white tracking-tight"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-[#6B7A87] dark:text-[#9CB4C9] pointer-events-none shrink-0 [&>svg]:w-4 [&>svg]:h-4 [&>svg]:stroke-[1.5px]">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={`w-full h-10 rounded-[6px] bg-white dark:bg-[#162C3D] text-sm text-[#10212E] dark:text-white border transition-colors placeholder:text-[#6B7A87] dark:placeholder:text-[#9CB4C9] focus:outline-none ${
              leftIcon ? 'pl-9' : 'pl-3.5'
            } ${rightIcon ? 'pr-9' : 'pr-3.5'} ${
              error
                ? 'border-[#C2412D] focus:border-[#C2412D] focus:ring-1 focus:ring-[#C2412D]'
                : 'border-[#D5E0EA] dark:border-[#244157] focus:border-[#1F5F99] dark:focus:border-[#6FAEE0] focus:ring-1 focus:ring-[#1F5F99] dark:focus:ring-[#6FAEE0]'
            } disabled:opacity-50 disabled:bg-[#EAF2FA]/60 dark:disabled:bg-[#10212E] ${className}`}
            {...props}
          />

          {rightIcon && (
            <span className="absolute right-3 text-[#6B7A87] dark:text-[#9CB4C9] shrink-0 [&>svg]:w-4 [&>svg]:h-4 [&>svg]:stroke-[1.5px]">
              {rightIcon}
            </span>
          )}
        </div>

        {error && <p className="text-xs text-[#C2412D] dark:text-[#FCA5A5] font-medium">{error}</p>}
        {hint && !error && <p className="text-xs text-[#6B7A87] dark:text-[#9CB4C9]">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
