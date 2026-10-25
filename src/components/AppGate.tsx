import { useEffect, useRef, useState, ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  ready: boolean;
  failed?: boolean;
  title?: string;
  skeleton: ReactNode;
  onRetry: () => void;
  onSignOut: () => void;
  children: ReactNode;
  immediate?: boolean;
};

export default function AppGate({ ready, failed, title = "Loading your profile", skeleton, onRetry, onSignOut, children, immediate = true }: Props) {
  const [showReal, setShowReal] = useState(false);
  const [overlay, setOverlay] = useState<"none" | "in" | "out">(immediate && !ready ? "in" : "none");
  const [slow, setSlow] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const open = useRef(immediate && !ready);
  const shownAt = useRef(immediate && !ready ? Date.now() : 0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!ready) {
      setShowReal(false); setSlow(false); setTimedOut(false);
      if (immediate && !open.current) {
        open.current = true;
        shownAt.current = Date.now();
        setOverlay("in");
      } else if (!immediate && !open.current) {
        timers.push(setTimeout(() => { open.current = true; shownAt.current = Date.now(); setOverlay("in"); }, 300));
      }
      timers.push(setTimeout(() => setSlow(true), 6000));
      timers.push(setTimeout(() => setTimedOut(true), 15000));
    } else {
      const wait = open.current ? Math.max(0, 500 - (Date.now() - shownAt.current)) : 0;
      timers.push(setTimeout(() => {
        setShowReal(true);
        if (open.current) {
          setOverlay("out");
          timers.push(setTimeout(() => { setOverlay("none"); open.current = false; }, 250));
        }
      }, wait));
    }
    return () => timers.forEach(clearTimeout);
  }, [ready, immediate]);

  const error = !ready && (failed || timedOut);
  const showCard = overlay !== "none" || error;

  return (
    <div className="gate-root">
      <div inert={showReal ? undefined : true} aria-busy={!showReal}>{showReal ? children : skeleton}</div>
      {showCard && createPortal(
        <div className={`gate-ov ${overlay === "out" ? "is-out" : ""}`}>
          <div className="gate-card" role="dialog" aria-modal="true" aria-labelledby="gate-title">
            <svg viewBox="0 0 120 120" width="64" height="64" aria-hidden="true" style={{ color: error ? "#C2412D" : "#1F5F99" }}>
              <g className={error ? "" : "gate-spin"}>
                <path d="M 97.59 46.32 A 40 40 0 1 1 73.68 22.41" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
              </g>
              {!error && <circle cx="60" cy="60" r="12" fill="#E8A33D" />}
            </svg>
            <h2 id="gate-title">{error ? "We could not load your profile." : title}</h2>
            <p aria-live="polite">
              {error ? "Check your connection, then try again." : slow ? "Still working. Slow connections can take longer." : "This takes a few seconds."}
            </p>
            {error && (
              <div className="gate-acts">
                <button onClick={onRetry}>Try again</button>
                <button className="alt" onClick={onSignOut}>Sign out</button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function GateSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7FAFD]" style={{ background: '#F7FAFD' }}>
      <header className="h-[72px] border-b border-[#D5E0EA] bg-white px-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-8 h-8 rounded-full" style={{ background: '#DCE7F2' }} />
          <div className="w-32 h-5 rounded" style={{ background: '#DCE7F2' }} />
          <div className="hidden md:flex items-center gap-4 ml-6">
            <div className="w-16 h-4 rounded" style={{ background: '#DCE7F2' }} />
            <div className="w-20 h-4 rounded" style={{ background: '#DCE7F2' }} />
            <div className="w-16 h-4 rounded" style={{ background: '#DCE7F2' }} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded" style={{ background: '#DCE7F2' }} />
          <div className="hidden sm:flex flex-col gap-1.5">
            <div className="w-24 h-3.5 rounded" style={{ background: '#DCE7F2' }} />
            <div className="w-16 h-2.5 rounded" style={{ background: '#DCE7F2' }} />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto py-12 px-4 space-y-8">
        <div className="space-y-3">
          <div className="w-64 h-8 rounded" style={{ background: '#DCE7F2' }} />
          <div className="w-96 h-4 rounded" style={{ background: '#DCE7F2' }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-white rounded-xl border border-[#D5E0EA] p-6 space-y-3">
            <div className="w-24 h-4 rounded" style={{ background: '#DCE7F2' }} />
            <div className="w-36 h-6 rounded" style={{ background: '#DCE7F2' }} />
          </div>
          <div className="h-32 bg-white rounded-xl border border-[#D5E0EA] p-6 space-y-3">
            <div className="w-24 h-4 rounded" style={{ background: '#DCE7F2' }} />
            <div className="w-36 h-6 rounded" style={{ background: '#DCE7F2' }} />
          </div>
          <div className="h-32 bg-white rounded-xl border border-[#D5E0EA] p-6 space-y-3">
            <div className="w-24 h-4 rounded" style={{ background: '#DCE7F2' }} />
            <div className="w-36 h-6 rounded" style={{ background: '#DCE7F2' }} />
          </div>
        </div>
        <div className="h-64 bg-white rounded-xl border border-[#D5E0EA] p-6 space-y-4">
          <div className="w-48 h-5 rounded" style={{ background: '#DCE7F2' }} />
          <div className="w-full h-10 rounded" style={{ background: '#DCE7F2' }} />
          <div className="w-full h-10 rounded" style={{ background: '#DCE7F2' }} />
          <div className="w-3/4 h-10 rounded" style={{ background: '#DCE7F2' }} />
        </div>
      </main>
      <footer className="h-16 border-t border-[#D5E0EA] bg-white px-8 flex items-center justify-between">
        <div className="w-36 h-3.5 rounded" style={{ background: '#DCE7F2' }} />
        <div className="w-48 h-3.5 rounded" style={{ background: '#DCE7F2' }} />
      </footer>
    </div>
  );
}
