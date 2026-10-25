import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { inFlightTracker } from '../services/api';

export interface ContractState {
  id: string;
  isReady: boolean;
  mountedAt: number;
  readyAt?: number;
}

export interface DomVerifyTarget {
  supplierName?: string;
  completenessScore?: number;
  documentsCount?: number;
  applicationsCount?: number;
  userId?: string;
  tenantId?: string;
  resolvedSupplierId?: string;
  serverFingerprint?: string;
}

export interface DomVerificationResult {
  ok: boolean;
  errors: string[];
  bindingsChecked: number;
  details: Record<string, { expected: any; actual: string; match: boolean }>;
}

interface ReadinessContextType {
  registerContract: (id: string) => void;
  unregisterContract: (id: string) => void;
  markContractReady: (id: string, isReady: boolean) => void;
  contracts: Record<string, ContractState>;
  allContractsReady: boolean;
  inFlightCount: number;
  verifyDomBindings: (target: DomVerifyTarget) => DomVerificationResult;
  waitForPaintAndSettle: (
    target: DomVerifyTarget,
    quietMs?: number
  ) => Promise<{ ok: boolean; reason?: string }>;
  isDebugOpen: boolean;
}

const ReadinessContext = createContext<ReadinessContextType | null>(null);

export const ReadinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [contracts, setContracts] = useState<Record<string, ContractState>>({});
  const [inFlightCount, setInFlightCount] = useState<number>(inFlightTracker.getCount());
  const contractsRef = useRef(contracts);
  contractsRef.current = contracts;

  // Track global in-flight requests from api.ts
  useEffect(() => {
    const unsub = inFlightTracker.subscribe((cnt) => {
      setInFlightCount(cnt);
    });
    return () => {
      unsub();
    };
  }, []);

  const registerContract = useCallback((id: string) => {
    setContracts((prev) => {
      if (prev[id]) return prev;
      return {
        ...prev,
        [id]: { id, isReady: false, mountedAt: Date.now() },
      };
    });
  }, []);

  const unregisterContract = useCallback((id: string) => {
    setContracts((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const markContractReady = useCallback((id: string, isReady: boolean) => {
    setContracts((prev) => {
      const existing = prev[id];
      if (existing && existing.isReady === isReady) return prev;
      return {
        ...prev,
        [id]: {
          id,
          isReady,
          mountedAt: existing?.mountedAt || Date.now(),
          readyAt: isReady ? Date.now() : undefined,
        },
      };
    });
  }, []);

  const contractList = Object.values(contracts);
  const allContractsReady =
    contractList.length > 0 && contractList.every((c) => c.isReady);

  // Layer 4 - DOM Binding Verification
  const verifyDomBindings = useCallback(
    (target: DomVerifyTarget): DomVerificationResult => {
      const elements = Array.from(document.querySelectorAll('[data-bind]'));
      const errors: string[] = [];
      const details: Record<string, { expected: any; actual: string; match: boolean }> = {};

      const normalize = (val: string) => val.trim().replace(/\s+/g, ' ').toLowerCase();

      elements.forEach((el) => {
        const bindKey = el.getAttribute('data-bind');
        if (!bindKey) return;
        const actualText = (el.textContent || '').trim();

        if (bindKey === 'supplier.name') {
          const expected = target.supplierName || '';
          const match =
            expected.length > 0 &&
            actualText.length > 0 &&
            actualText !== 'Registered Supplier' &&
            actualText !== 'Supplier Account' &&
            actualText !== 'Loading profile...' &&
            (normalize(actualText).includes(normalize(expected)) ||
              normalize(expected).includes(normalize(actualText)));

          details['supplier.name'] = { expected, actual: actualText, match };
          if (!match) {
            errors.push(
              `[data-bind="supplier.name"] mismatch: expected "${expected}", rendered "${actualText}"`
            );
          }
        }

        if (bindKey === 'completeness.score') {
          const expected = target.completenessScore ?? 0;
          const match =
            actualText.includes(`${expected}%`) ||
            actualText === `${expected}` ||
            (expected > 0 && actualText.includes(`${expected}`));

          details['completeness.score'] = { expected: `${expected}%`, actual: actualText, match };
          if (!match) {
            errors.push(
              `[data-bind="completeness.score"] mismatch: expected "${expected}%", rendered "${actualText}"`
            );
          }
        }

        if (bindKey === 'documents.count') {
          const expected = target.documentsCount ?? 0;
          // Matches exact number or formatted string
          const match = actualText.includes(String(expected));
          details['documents.count'] = { expected, actual: actualText, match };
          if (!match) {
            errors.push(
              `[data-bind="documents.count"] mismatch: expected "${expected}", rendered "${actualText}"`
            );
          }
        }

        if (bindKey === 'applications.count') {
          const expected = target.applicationsCount ?? 0;
          const match = actualText.includes(String(expected));
          details['applications.count'] = { expected, actual: actualText, match };
          if (!match) {
            errors.push(
              `[data-bind="applications.count"] mismatch: expected "${expected}", rendered "${actualText}"`
            );
          }
        }

        if (bindKey === 'tenant.id' || bindKey === 'supplier.id') {
          const expected = target.resolvedSupplierId || target.tenantId || '';
          const match = !expected || actualText === expected || actualText.includes(expected);
          details['tenant.id'] = { expected, actual: actualText, match };
          if (!match) {
            errors.push(
              `[data-bind="tenant.id"] mismatch: expected "${expected}", rendered "${actualText}"`
            );
          }
        }
      });

      return {
        ok: errors.length === 0,
        errors,
        bindingsChecked: elements.length,
        details,
      };
    },
    []
  );

  // Layer 5 - Paint confirmation and settle quiet window (250ms)
  const waitForPaintAndSettle = useCallback(
    async (
      target: DomVerifyTarget,
      quietMs = 250
    ): Promise<{ ok: boolean; reason?: string }> => {
      const maxWait = 3500;
      const startTime = Date.now();
      let quietStart: number | null = null;

      if (target.serverFingerprint && process.env.NODE_ENV !== 'production') {
        console.log('[GATE DATABASE TRUTH FINGERPRINT]', target.serverFingerprint, {
          resolvedSupplierId: target.resolvedSupplierId,
          completenessScore: target.completenessScore,
        });
      }

      while (Date.now() - startTime < maxWait) {
        // Wait for two consecutive requestAnimationFrame callbacks to guarantee paint
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });

        const inFlight = inFlightTracker.getCount();
        const domResult = verifyDomBindings(target);

        if (inFlight === 0 && domResult.ok) {
          if (quietStart === null) {
            quietStart = Date.now();
          } else if (Date.now() - quietStart >= quietMs) {
            return { ok: true };
          }
        } else {
          quietStart = null;
        }

        await new Promise((r) => setTimeout(r, 40));
      }

      const finalDom = verifyDomBindings(target);
      return {
        ok: finalDom.ok,
        reason: finalDom.ok ? undefined : finalDom.errors[0] || 'SETTLE_TIMEOUT',
      };
    },
    [verifyDomBindings]
  );

  const isDebugOpen =
    typeof window !== 'undefined' &&
    window.location.search.includes('gate-debug=1');

  return (
    <ReadinessContext.Provider
      value={{
        registerContract,
        unregisterContract,
        markContractReady,
        contracts,
        allContractsReady,
        inFlightCount,
        verifyDomBindings,
        waitForPaintAndSettle,
        isDebugOpen,
      }}
    >
      {children}
      {isDebugOpen && <GateInspectorHUD />}
    </ReadinessContext.Provider>
  );
};

export const useReadiness = (contractId: string) => {
  const ctx = useContext(ReadinessContext);
  if (!ctx) {
    throw new Error('useReadiness must be used within a ReadinessProvider');
  }

  const { registerContract, unregisterContract, markContractReady, contracts } = ctx;

  useEffect(() => {
    registerContract(contractId);
    return () => {
      unregisterContract(contractId);
    };
  }, [contractId, registerContract, unregisterContract]);

  const contract = contracts[contractId];
  const isReady = Boolean(contract?.isReady);

  const setReady = useCallback(
    (ready: boolean) => {
      markContractReady(contractId, ready);
    },
    [contractId, markContractReady]
  );

  return { isReady, setReady };
};

export const useReadinessContext = () => {
  const ctx = useContext(ReadinessContext);
  if (!ctx) {
    throw new Error('useReadinessContext must be used within a ReadinessProvider');
  }
  return ctx;
};

// Step 5 Polish: Gate Inspector HUD component for ?gate-debug=1
const GateInspectorHUD: React.FC = () => {
  const { contracts, inFlightCount } = useReadinessContext();
  const [dataBinds, setDataBinds] = useState<
    Array<{ key: string; text: string }>
  >([]);

  useEffect(() => {
    const update = () => {
      const els = Array.from(document.querySelectorAll('[data-bind]'));
      setDataBinds(
        els.map((el) => ({
          key: el.getAttribute('data-bind') || '',
          text: (el.textContent || '').trim(),
        }))
      );
    };
    update();
    const interval = setInterval(update, 300);
    return () => clearInterval(interval);
  }, []);

  const contractList = Object.values(contracts);

  return (
    <div
      className="fixed bottom-4 right-4 z-[999999] bg-[#10212E]/95 border border-[#1E364A] text-white p-3 rounded-xl shadow-2xl text-[12px] font-mono max-w-[360px] max-h-[380px] overflow-auto backdrop-blur-md"
      style={{ fontFamily: 'monospace' }}
    >
      <div className="flex items-center justify-between pb-2 border-b border-[#1E364A] mb-2 font-bold text-[#6FAEE0]">
        <span>⚡ Gate Inspector (?gate-debug=1)</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] ${
            inFlightCount === 0 ? 'bg-green-950 text-green-300' : 'bg-amber-950 text-amber-300'
          }`}
        >
          In-Flight: {inFlightCount}
        </span>
      </div>

      <div className="mb-2">
        <div className="text-[#B2C3D2] text-[11px] mb-1 font-semibold uppercase tracking-wider">
          Contracts ({contractList.filter((c) => c.isReady).length}/{contractList.length})
        </div>
        <div className="space-y-1">
          {contractList.map((c) => (
            <div key={c.id} className="flex items-center justify-between">
              <span className="truncate max-w-[200px]">{c.id}</span>
              <span
                className={`font-bold ${
                  c.isReady ? 'text-[#2F8F5B]' : 'text-[#E8A33D] animate-pulse'
                }`}
              >
                {c.isReady ? 'READY ✓' : 'WAITING …'}
              </span>
            </div>
          ))}
          {contractList.length === 0 && (
            <div className="text-gray-500 italic">No contracts mounted</div>
          )}
        </div>
      </div>

      <div>
        <div className="text-[#B2C3D2] text-[11px] mb-1 font-semibold uppercase tracking-wider">
          Rendered [data-bind] ({dataBinds.length})
        </div>
        <div className="space-y-1">
          {dataBinds.map((b, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <span className="text-[#6FAEE0] truncate max-w-[120px]">{b.key}:</span>
              <span className="text-white truncate max-w-[180px]">"{b.text}"</span>
            </div>
          ))}
          {dataBinds.length === 0 && (
            <div className="text-gray-500 italic">No data-bind elements found in DOM</div>
          )}
        </div>
      </div>
    </div>
  );
};
