import React, { useRef, useState, useEffect } from 'react';

interface DigitCodeInputProps {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
}

export const DigitCodeInput: React.FC<DigitCodeInputProps> = ({
  length = 6,
  onComplete,
  disabled = false,
}) => {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index: number, value: string) => {
    const val = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = val;
    setDigits(newDigits);

    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === length && !newDigits.includes('')) {
      onComplete(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pastedData) return;

    const newDigits = Array(length).fill('');
    for (let i = 0; i < pastedData.length; i++) {
      newDigits[i] = pastedData[i];
    }
    setDigits(newDigits);

    if (pastedData.length === length) {
      onComplete(pastedData);
      inputRefs.current[length - 1]?.focus();
    } else {
      inputRefs.current[pastedData.length]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-11 h-12 sm:w-12 sm:h-12 text-center text-xl font-heading font-semibold rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:border-[#1F5F99] focus:outline-none focus:ring-2 focus:ring-[#1F5F99]/20 transition-all tabular-nums"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
};
