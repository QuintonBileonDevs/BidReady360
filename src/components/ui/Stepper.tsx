import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-[#EAF2FA] dark:bg-[#1C364B] rounded-[6px] ${className}`}
    />
  );
};

export interface StepItem {
  id: string | number;
  label: string;
  description?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  className = '',
}) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <button
              key={step.id}
              type="button"
              disabled={!onStepClick}
              onClick={() => onStepClick && onStepClick(index)}
              className={`p-3.5 rounded-[8px] border text-left transition-all ${
                isCurrent
                  ? 'border-[#1F5F99] dark:border-[#6FAEE0] bg-[#EAF2FA]/60 dark:bg-[#6FAEE0]/15'
                  : isComplete
                  ? 'border-[#D5E0EA] dark:border-[#244157] bg-white dark:bg-[#1C364B]'
                  : 'border-transparent bg-[#EAF2FA]/45 dark:bg-[#162C3D] opacity-70'
              } ${onStepClick ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-5 h-5 rounded-[4px] font-heading tabular-nums text-[11px] font-semibold flex items-center justify-center ${
                    isCurrent
                      ? 'bg-[#1F5F99] text-white dark:bg-[#6FAEE0] dark:text-[#10212E]'
                      : isComplete
                      ? 'bg-[#2F8F5B] text-white'
                      : 'bg-[#D5E0EA] dark:bg-[#244157] text-[#43525F] dark:text-[#D3E3F2]'
                  }`}
                >
                  {isComplete ? '✓' : index + 1}
                </span>
                <span
                  className={`text-xs font-semibold tracking-tight ${
                    isCurrent
                      ? 'text-[#1F5F99] dark:text-[#6FAEE0]'
                      : 'text-[#10212E] dark:text-white'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {step.description && (
                <p className="text-[11px] text-[#6B7A87] dark:text-[#9CB4C9] leading-tight pl-7">
                  {step.description}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
