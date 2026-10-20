import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Share2, X, Smartphone } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check session storage for dismissed preference
    const dismissed = sessionStorage.getItem('bidready360_pwa_dismissed') === 'true';
    if (dismissed) {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('bidready360_pwa_dismissed', 'true');
  };

  // If already installed or dismissed, render nothing
  if (isInstalled || isDismissed) {
    return null;
  }

  // 1. Android / Chrome / Edge / Desktop (Fired beforeinstallprompt)
  if (isInstallable) {
    return (
      <aside
        aria-label="Install BidReady360 App"
        className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-blue-900/40 bg-[#10212E] p-3 text-white shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-3"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white">BidReady360 App</p>
          <p className="text-[11px] text-gray-300 truncate">Install for faster tender access and offline vault</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={install}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-500 active:scale-95 transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            Install app
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="rounded-lg p-1 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </aside>
    );
  }

  // 2. iOS Safari (Shows hint: "Tap Share, then Add to Home Screen")
  if (isIOS) {
    return (
      <aside
        aria-label="Install BidReady360 on iOS"
        className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border border-blue-900/40 bg-[#10212E] p-3.5 text-white shadow-2xl backdrop-blur-md sm:left-auto sm:right-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 mt-0.5">
            <Share2 className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-white">Install on iPhone / iPad</p>
            <p className="mt-0.5 text-[11px] text-gray-300 leading-relaxed">
              Tap <span className="inline-flex items-center font-semibold text-amber-300"><Share2 className="inline h-3 w-3 mx-0.5" /> Share</span>, then tap <strong className="text-white">Add to Home Screen</strong>.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss iOS install hint"
            className="rounded-lg p-1 text-gray-400 hover:bg-white/10 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </aside>
    );
  }

  return null;
};
