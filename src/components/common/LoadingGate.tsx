import React, { useEffect, useRef, useState } from 'react';

interface LoadingGateProps {
  isVisible: boolean;
  step: number; // 0, 1, 2, 3, 4
  statusMessage: string;
  onExited?: () => void;
}

const steps = [
  'Signing you in',
  'Loading your company',
  'Checking your documents',
  'Setting up your dashboard',
];

export const LoadingGate: React.FC<LoadingGateProps> = ({
  isVisible,
  step,
  statusMessage,
  onExited,
}) => {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [isFading, setIsFading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setIsFading(false);
      previouslyFocusedElement.current = document.activeElement as HTMLElement | null;
      if (modalRef.current) {
        modalRef.current.focus();
      }
    } else if (shouldRender) {
      // Start 450ms fade-out transition
      setIsFading(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsFading(false);
        if (previouslyFocusedElement.current) {
          previouslyFocusedElement.current.focus();
        }
        if (onExited) onExited();
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Trap focus inside modal while visible
  useEffect(() => {
    if (!shouldRender) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        if (modalRef.current) modalRef.current.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shouldRender]);

  if (!shouldRender) return null;

  const progressPercent = Math.min(100, Math.max(0, (step / steps.length) * 100));

  return (
    <>
      <style>{`
        @keyframes gate-sp {
          to { transform: rotate(360deg); }
        }
        @keyframes gate-pl {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.25); }
        }
        .gate-spin-arc {
          transform-origin: 60px 60px;
          animation: gate-sp 2.4s linear infinite;
        }
        .gate-pulse-dot {
          transform-box: fill-box;
          transform-origin: center;
          animation: gate-pl 1.6s ease-in-out infinite;
        }
        .gate-step-spin {
          animation: gate-sp 0.8s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .gate-spin-arc, .gate-pulse-dot, .gate-step-spin {
            animation: none !important;
          }
          .gate-overlay, .gate-bar-fill {
            transition: none !important;
          }
        }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="loading-gate-title"
        className={`gate-overlay fixed inset-0 z-[99999] flex items-center justify-center bg-[#10212E] transition-opacity duration-450 ${
          isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{ backgroundColor: '#10212E' }}
      >
        <div
          ref={modalRef}
          tabIndex={-1}
          className="w-[340px] max-w-[88%] bg-[#132635] border border-[#1E364A] rounded-[14px] p-[26px_24px] text-center outline-none shadow-2xl"
          style={{
            backgroundColor: '#132635',
            borderColor: '#1E364A',
            color: '#FFFFFF',
          }}
        >
          {/* Animated SVG Brand Mark */}
          <svg
            width="84"
            height="84"
            viewBox="0 0 120 120"
            aria-hidden="true"
            className="mx-auto block"
          >
            <g className="gate-spin-arc">
              <path
                d="M 97.59 46.32 A 40 40 0 1 1 73.68 22.41"
                fill="none"
                stroke="#6FAEE0"
                strokeWidth="12"
                strokeLinecap="round"
              />
            </g>
            <circle
              cx="60"
              cy="60"
              r="12"
              fill="#E8A33D"
              className="gate-pulse-dot"
              style={{ fill: '#E8A33D', opacity: 1 }}
            />
          </svg>

          {/* Explicitly styled Title - immune to global theme overrides */}
          <h2
            id="loading-gate-title"
            className="text-[1.2rem] mt-[10px] mb-[4px] font-bold tracking-tight"
            style={{
              color: '#FFFFFF',
              fontFamily: "'Sora', 'Segoe UI', system-ui, sans-serif",
              letterSpacing: '-0.02em',
              margin: '10px 0 4px',
            }}
          >
            Preparing your workspace
          </h2>

          {/* Live Status Message */}
          <p
            className="text-[14px] min-h-[1.5em] mb-4"
            aria-live="polite"
            style={{
              color: '#B2C3D2',
              fontFamily: "'Source Sans 3', 'Segoe UI', system-ui, sans-serif",
              margin: '0.4rem auto 1rem',
            }}
          >
            {statusMessage || 'Getting everything ready'}
          </p>

          {/* 4-Step Checklist */}
          <ol
            className="text-left mb-4 list-none p-0 m-0 space-y-1.5"
            style={{
              fontFamily: "'Source Sans 3', 'Segoe UI', system-ui, sans-serif",
              fontSize: '15px',
            }}
          >
            {steps.map((label, idx) => {
              const isDone = idx < step;
              const isActive = idx === step;

              let textColor = '#7D92A4';
              if (isDone) textColor = '#DDE7F0';
              if (isActive) textColor = '#FFFFFF';

              return (
                <li
                  key={label}
                  className="flex items-center gap-3 py-1"
                  style={{ color: textColor }}
                >
                  <div
                    className="w-[18px] h-[18px] rounded-full flex-none flex items-center justify-center text-[11px] font-bold"
                    style={{
                      border: isDone
                        ? '2px solid #2F8F5B'
                        : isActive
                        ? '2px solid #6FAEE0'
                        : '2px solid #3A5870',
                      backgroundColor: isDone ? '#2F8F5B' : 'transparent',
                      borderTopColor: isActive ? 'transparent' : undefined,
                    }}
                  >
                    {isDone && (
                      <span style={{ color: '#FFFFFF', lineHeight: 1 }}>✓</span>
                    )}
                    {isActive && (
                      <div
                        className="w-full h-full rounded-full gate-step-spin"
                        style={{
                          border: '2px solid #6FAEE0',
                          borderTopColor: 'transparent',
                        }}
                      />
                    )}
                  </div>
                  <span className={isActive ? 'font-semibold' : ''}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* Progress Bar */}
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: '#1E364A' }}
          >
            <div
              className="h-full gate-bar-fill transition-all duration-400 ease-out"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: '#6FAEE0',
                transition: 'width 0.4s ease-out',
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};
