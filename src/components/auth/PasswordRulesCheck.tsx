import React from 'react';

interface PasswordRulesCheckProps {
  password: string;
}

export const PasswordRulesCheck: React.FC<PasswordRulesCheckProps> = ({ password }) => {
  const rules = [
    { label: 'At least 10 characters', met: password.length >= 10 },
    { label: 'At least one uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'At least one number (0-9)', met: /[0-9]/.test(password) },
    { label: 'At least one special character (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const metCount = rules.filter((r) => r.met).length;

  const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-slate-200', 'bg-[#C2412D]', 'bg-[#E8A33D]', 'bg-[#1F5F99]', 'bg-[#2F8F5B]'];

  return (
    <div className="space-y-3 pt-1 text-[14px]" aria-live="polite">
      {/* Strength Meter Bar */}
      {password.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[14px]">
            <span className="text-[#6B7A87]">Password strength:</span>
            <span className="font-semibold text-[#10212E] dark:text-white">
              {strengthLabels[metCount]}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 h-1.5">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`rounded-full transition-all ${
                  metCount >= step ? strengthColors[metCount] : 'bg-slate-200 dark:bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Rules Checklist */}
      <div className="space-y-1.5 bg-[#F7FAFD] dark:bg-[#10212E] p-3 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A]">
        <span className="text-[13px] font-semibold text-[#6B7A87] block uppercase tracking-wider mb-1">
          Password requirements
        </span>
        {rules.map((rule, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 transition-colors ${
              rule.met
                ? 'text-[#2F8F5B] font-medium'
                : 'text-[#6B7A87]'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-[4px] flex items-center justify-center text-[11px] font-bold ${
                rule.met
                  ? 'bg-[#2F8F5B] text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
              }`}
            >
              {rule.met ? '✓' : '•'}
            </span>
            <span className="text-[14px]">{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
