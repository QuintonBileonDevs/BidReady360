import React, { useState, useEffect } from 'react';
import { Lock, Loader2, AlertCircle } from 'lucide-react';
import { adminApi } from '../../services/api';
import { AdminSupportModal } from './AdminSupportModal';

interface AdminSupportProps {
  onStartSupportSession: (entityName: string, reason: string) => void;
}

interface TargetOption {
  id: string;
  name: string;
  type: 'Organization' | 'Supplier';
}

export const AdminSupport: React.FC<AdminSupportProps> = ({ onStartSupportSession }) => {
  const [targets, setTargets] = useState<TargetOption[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadTargets = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [orgs, suppliers] = await Promise.all([
          adminApi.listOrganizations(),
          adminApi.listSuppliers(),
        ]);
        if (!active) return;
        const options: TargetOption[] = [
          ...orgs.map((o) => ({ id: o.id, name: o.name, type: 'Organization' as const })),
          ...suppliers.map((s) => ({ id: s.id, name: s.legalName, type: 'Supplier' as const })),
        ];
        setTargets(options);
        if (options.length > 0) {
          setSelectedKey(`${options[0].type}:${options[0].id}`);
        }
      } catch (err: any) {
        if (active) setError(err?.message || 'Unable to load tenant directory.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadTargets();
    return () => {
      active = false;
    };
  }, []);

  const selectedTarget =
    targets.find((t) => `${t.type}:${t.id}` === selectedKey) || targets[0] || null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#244157]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Support &amp; privacy governance
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#D3E3F2]">
            Enforce statutory data isolation, tenant privacy boundaries, and audited administrative support sessions.
          </p>
        </div>
      </div>

      {/* Privacy Rules Card */}
      <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 space-y-4">
        <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
          Data isolation and support privacy rules
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[14px]">
          <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] space-y-2">
            <span className="font-semibold text-[#10212E] dark:text-white block">
              1. Account metadata only
            </span>
            <p className="text-[13px] text-[#43525F] dark:text-[#D3E3F2] leading-relaxed">
              Standard admin views display account status, verification pins, and billing logs only. Confidential bidder vaults remain isolated.
            </p>
          </div>

          <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] space-y-2">
            <span className="font-semibold text-[#10212E] dark:text-white block">
              2. Mandatory audit reasoning
            </span>
            <p className="text-[13px] text-[#43525F] dark:text-[#D3E3F2] leading-relaxed">
              Starting a diagnostic session requires a formal ticket reference and written reason before access is logged.
            </p>
          </div>

          <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] space-y-2">
            <span className="font-semibold text-[#10212E] dark:text-white block">
              3. Permanent banner &amp; audit log
            </span>
            <p className="text-[13px] text-[#43525F] dark:text-[#D3E3F2] leading-relaxed">
              Every authorized session is marked with a persistent top banner and written directly to PostgreSQL audit_log.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[#C2412D] text-[14px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Direct Launch Diagnostic Card */}
      <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 space-y-4">
        <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
          Start logged support session
        </h2>

        {isLoading ? (
          <div className="flex items-center gap-2 text-[14px] text-[#6B7A87] dark:text-[#9CB4C9]">
            <Loader2 className="w-4 h-4 animate-spin text-[#1F5F99] dark:text-[#6FAEE0]" />
            <span>Loading registered organizations and suppliers...</span>
          </div>
        ) : targets.length === 0 ? (
          <p className="text-[14px] text-[#6B7A87] dark:text-[#9CB4C9]">
            No buyer organizations or suppliers are registered yet.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row items-end gap-3 max-w-xl">
            <div className="flex-1 space-y-1 w-full text-[14px]">
              <label className="font-medium text-[#10212E] dark:text-white block">
                Target organization or supplier
              </label>
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E]"
              >
                {targets.map((t) => (
                  <option key={`${t.type}:${t.id}`} value={`${t.type}:${t.id}`}>
                    {t.name} ({t.type === 'Organization' ? 'Buyer' : 'Supplier'})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={!selectedTarget}
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px] text-[14px] flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>Request session access</span>
            </button>
          </div>
        )}
      </div>

      <AdminSupportModal
        isOpen={isModalOpen && Boolean(selectedTarget)}
        onClose={() => setIsModalOpen(false)}
        targetEntityId={selectedTarget?.id}
        targetEntityName={selectedTarget?.name || ''}
        targetType={selectedTarget?.type || 'Organization'}
        onGrantAccess={(reason) => {
          if (selectedTarget) onStartSupportSession(selectedTarget.name, reason);
        }}
      />
    </div>
  );
};
