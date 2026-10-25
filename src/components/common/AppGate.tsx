import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';

/**
 * AppGate
 * Single gate and source of truth for the signed-in experience.
 *
 * READY requires:
 * 1. Auth state is signed-in (isAuthenticated === true)
 * 2. User ID matches current session
 * 3. Profile summary (displayName, tenantType, tenantId, role, supplierOrOrgName, verificationStatus) has loaded.
 *
 * UNTIL READY:
 * - Real data components do NOT mount.
 * - Entire page is blurred (Mist #EAF2FA tint @ 60% opacity with backdrop-filter: blur(8px)).
 * - Centered modal card (white, 12px radius, soft shadow, 360px wide, 28px padding).
 * - BidReady360 ring mark spinner (#1F5F99 rotating ring with gap, amber #E8A33D dot fixed in centre).
 *
 * SMART TIMING:
 * - Ready in < 300 ms -> Modal never flashes (shows nothing).
 * - If modal appears -> Visible for at least 500 ms to avoid blinking.
 * - When ready -> 250 ms fade-out of modal & blur, simultaneous fade-in of real content.
 * - > 6 seconds -> "Still working. Slow connections can take longer."
 * - > 15 seconds or error -> "We could not load your profile." with "Try again" and "Sign out".
 * - 401 session expired -> Redirect to sign-in page without modal.
 */
export const AppGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    isAuthenticated,
    currentUser,
    profileSummary,
    isGateReady,
    gatePurpose,
    switchingTargetName,
    gateError,
    retryProfileLoad,
    logout,
  } = useApp();

  // Modal UI state
  const [shouldRenderOverlay, setShouldRenderOverlay] = useState<boolean>(false);
  const [isOverlayFadingOut, setIsOverlayFadingOut] = useState<boolean>(false);
  const [isSlowNotice, setIsSlowNotice] = useState<boolean>(false);
  const [hasTimedOut, setHasTimedOut] = useState<boolean>(false);

  // Focus trap ref
  const modalCardRef = useRef<HTMLDivElement | null>(null);
  const modalShownTimeRef = useRef<number | null>(null);

  // If not authenticated (public mode), pass children straight through
  const isProtectedSession = isAuthenticated || currentUser !== null;

  // ---------------------------------------------------------------------------
  // SMART TIMING ENGINE
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isProtectedSession) {
      setShouldRenderOverlay(false);
      setIsOverlayFadingOut(false);
      setIsSlowNotice(false);
      setHasTimedOut(false);
      modalShownTimeRef.current = null;
      return;
    }

    // When NOT ready: start timers
    if (!isGateReady) {
      setIsOverlayFadingOut(false);
      setIsSlowNotice(false);
      setHasTimedOut(false);

      // Timer 1: 300ms anti-flicker delay before showing the modal
      const timer300 = setTimeout(() => {
        setShouldRenderOverlay(true);
        modalShownTimeRef.current = Date.now();
      }, 300);

      // Timer 2: 6s slow connection notice
      const timer6s = setTimeout(() => {
        setIsSlowNotice(true);
      }, 6000);

      // Timer 3: 15s timeout error state
      const timer15s = setTimeout(() => {
        setHasTimedOut(true);
      }, 15000);

      return () => {
        clearTimeout(timer300);
        clearTimeout(timer6s);
        clearTimeout(timer15s);
      };
    }

    // When BECOMES READY:
    if (isGateReady) {
      // If modal was never shown (loading finished in < 300ms), don't show anything!
      if (!modalShownTimeRef.current) {
        setShouldRenderOverlay(false);
        setIsOverlayFadingOut(false);
        return;
      }

      // If modal WAS shown, enforce min 500ms display time so it does not blink
      const elapsedSinceShow = Date.now() - modalShownTimeRef.current;
      const minDisplayRemaining = Math.max(0, 500 - elapsedSinceShow);

      const dismissTimer = setTimeout(() => {
        // Start 250ms fade-out
        setIsOverlayFadingOut(true);
        const unmountTimer = setTimeout(() => {
          setShouldRenderOverlay(false);
          setIsOverlayFadingOut(false);
          modalShownTimeRef.current = null;

          // Return focus to main page heading for accessibility
          const mainHeading = document.querySelector('h1') as HTMLElement | null;
          if (mainHeading) {
            mainHeading.focus();
          }
        }, 250);

        return () => clearTimeout(unmountTimer);
      }, minDisplayRemaining);

      return () => clearTimeout(dismissTimer);
    }
  }, [isGateReady, isProtectedSession]);

  // Trap focus inside modal when visible
  useEffect(() => {
    if (shouldRenderOverlay && modalCardRef.current) {
      modalCardRef.current.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Tab' && modalCardRef.current) {
          const focusable = modalCardRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) {
            e.preventDefault();
            return;
          }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [shouldRenderOverlay]);

  // Determine modal text copy based on use case
  const isErrorState = hasTimedOut || Boolean(gateError);

  const getHeadingText = (): string => {
    if (isErrorState) return 'We could not load your profile.';
    if (gatePurpose === 'setting_up') return 'Setting up your profile';
    if (gatePurpose === 'switching') {
      return switchingTargetName ? `Switching to ${switchingTargetName}` : 'Switching organization';
    }
    if (gatePurpose === 'logging_out') return 'Signing you out';
    return 'Loading your profile';
  };

  const getSubtext = (): string => {
    if (isErrorState) {
      return 'Please check your connection and try again.';
    }
    if (isSlowNotice) {
      return 'Still working. Slow connections can take longer.';
    }
    return 'This takes a few seconds.';
  };

  // If public view, render directly
  if (!isProtectedSession) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen">
      {/* ------------------------------------------------------------------ */}
      {/* 1. BACKGROUND CONTAINER (INERT & BLURRED WHILE LOADING)           */}
      {/* ------------------------------------------------------------------ */}
      <div
        aria-busy={!isGateReady}
        aria-hidden={!isGateReady}
        inert={!isGateReady ? true : undefined}
        className={`transition-opacity duration-250 ease-out ${
          isGateReady ? 'opacity-100' : 'opacity-30 filter blur-[8px] pointer-events-none select-none'
        }`}
      >
        {isGateReady ? children : <NeutralSkeletonShell />}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. THE BLUR AND MODAL OVERLAY (ONLY IF > 300MS)                   */}
      {/* ------------------------------------------------------------------ */}
      {shouldRenderOverlay && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="appgate-modal-title"
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-250 ease-out ${
            isOverlayFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          style={{
            // Low-end phone fallback: solid Mist at 90% opacity if backdrop-filter is unsupported
            backgroundColor: 'rgba(234, 242, 250, 0.90)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {/* Centered Modal Card: White, 12px radius, soft shadow, ~360px wide, 28px padding */}
          <div
            ref={modalCardRef}
            tabIndex={-1}
            className="w-full max-w-[360px] bg-white dark:bg-[#132635] rounded-[12px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[#D5E0EA] dark:border-[#1E364A] p-[28px] text-center flex flex-col items-center outline-none"
          >
            {/* Live region for accessibility screen readers */}
            <div className="sr-only" role="status" aria-live="polite">
              {getHeadingText()}. {getSubtext()}
            </div>

            {/* Spinner or Error Icon */}
            {!isErrorState ? (
              <div className="relative w-14 h-14 flex items-center justify-center mb-5">
                {/* Rotating Pula Deep #1F5F99 ring with small gap */}
                <svg
                  className="w-14 h-14 animate-spin motion-reduce:animate-none"
                  viewBox="0 0 56 56"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    stroke="#1F5F99"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="115 25"
                  />
                </svg>
                {/* Fixed Amber #E8A33D dot in centre (only one dot, never rotates) */}
                <div
                  className="absolute w-3 h-3 rounded-full bg-[#E8A33D] shadow-sm"
                  aria-hidden="true"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
            )}

            {/* Heading in Sora, 18px */}
            <h2
              id="appgate-modal-title"
              className="font-['Sora',sans-serif] text-[18px] font-semibold text-[#10212E] dark:text-[#EAF2FA] tracking-tight leading-snug mb-1.5"
            >
              {getHeadingText()}
            </h2>

            {/* Subtext in Source Sans 3, 15px, Ink #10212E */}
            <p className="font-['Source_Sans_3',sans-serif] text-[15px] text-[#10212E] dark:text-[#B2C3D2] leading-relaxed max-w-[280px]">
              {getSubtext()}
            </p>

            {/* Error Actions: "Try again" and "Sign out" */}
            {isErrorState && (
              <div className="mt-6 flex flex-col gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setHasTimedOut(false);
                    setIsSlowNotice(false);
                    modalShownTimeRef.current = Date.now();
                    retryProfileLoad();
                  }}
                  className="w-full py-2.5 px-4 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[14px] font-semibold rounded-[6px] transition-colors cursor-pointer"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout('user_initiated');
                  }}
                  className="w-full py-2 px-4 border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD] dark:hover:bg-[#1A3042] text-[#43525F] dark:text-[#B2C3D2] text-[14px] font-medium rounded-[6px] transition-colors cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * NeutralSkeletonShell
 * Renders the same layout as the app with neutral grey placeholder bars.
 * No text like "Supplier Account", "Loading profile...", or any user name.
 */
const NeutralSkeletonShell: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7FAFD] dark:bg-[#0D1A25]">
      {/* Header Skeleton */}
      <header className="h-[72px] border-b border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-8 h-8 rounded-full bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
          <div className="w-32 h-5 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
          <div className="hidden md:flex items-center gap-4 ml-6">
            <div className="w-16 h-4 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
            <div className="w-20 h-4 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
            <div className="w-16 h-4 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
          <div className="hidden sm:flex flex-col gap-1.5">
            <div className="w-24 h-3.5 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
            <div className="w-16 h-2.5 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main Content Area Skeleton */}
      <main className="flex-1 max-w-6xl w-full mx-auto py-8 sm:py-12 px-4 space-y-8">
        <div className="space-y-3">
          <div className="w-64 h-8 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
          <div className="w-96 h-4 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-3">
            <div className="w-24 h-4 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
            <div className="w-36 h-6 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
          </div>
          <div className="h-32 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-3">
            <div className="w-24 h-4 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
            <div className="w-36 h-6 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
          </div>
          <div className="h-32 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-3">
            <div className="w-24 h-4 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
            <div className="w-36 h-6 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
          </div>
        </div>

        <div className="h-64 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
          <div className="w-48 h-5 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
          <div className="w-full h-10 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
          <div className="w-full h-10 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
          <div className="w-3/4 h-10 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
        </div>
      </main>

      {/* Footer Skeleton */}
      <footer className="h-16 border-t border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] px-8 flex items-center justify-between">
        <div className="w-36 h-3.5 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
        <div className="w-48 h-3.5 rounded bg-[#E2EDF8] dark:bg-[#1E364A] animate-pulse" />
      </footer>
    </div>
  );
};
