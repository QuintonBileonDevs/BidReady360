import React, { useState } from 'react';
import { RiskFlag, DebarmentRecord } from '../../types/admin';
import { ShieldAlert, AlertTriangle, CheckCircle2, UserX, Plus } from 'lucide-react';

export const AdminRiskDebarments: React.FC = () => {
  const [flags, setFlags] = useState<RiskFlag[]>(() => {
    try {
      const saved = localStorage.getItem('bidready_risk_flags');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [debarments, setDebarments] = useState<DebarmentRecord[]>(() => {
    try {
      const saved = localStorage.getItem('bidready_debarments');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);

  const handleResolveFlag = (id: string) => {
    setResolvedIds((prev) => [...prev, id]);
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Risk & debarments
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Enforce statutory procurement integrity rules, anti-collusion filters, and regulatory debarment orders.
          </p>
        </div>
      </div>

      {/* 1. Open Risk Flags Section */}
      <div className="space-y-4">
        <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
          Active integrity flags
        </h2>

        <div className="space-y-4">
          {flags.length === 0 ? (
            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-8 text-center text-[#6B7A87]">
              No active integrity flags detected. All cross-entity directorships and statutory filings are normal.
            </div>
          ) : (
            flags.map((flag) => {
              const isResolved = resolvedIds.includes(flag.id);
              return (
                <div
                  key={flag.id}
                  className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[12px] px-2.5 py-1 rounded-[4px] font-semibold ${
                          flag.severity === 'High'
                            ? 'bg-[#FEF2F2] text-[#C2412D]'
                            : 'bg-[#FFFBEB] text-[#92400E]'
                        }`}
                      >
                        {flag.severity} Severity
                      </span>
                      <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
                        {flag.flagType}
                      </h3>
                    </div>
                    <span className="text-[13px] text-[#6B7A87]">
                      Detected {flag.detectedAt}
                    </span>
                  </div>

                  <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                    {flag.description}
                  </p>

                  <div className="p-3 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[6px] text-[13px] space-y-1">
                    <div><strong>Suppliers involved:</strong> {flag.suppliersInvolved.join(', ')}</div>
                    <div><strong>Procuring entity:</strong> {flag.organizationsInvolved.join(', ')}</div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A]">
                    <span className="text-[13px] text-[#6B7A87]">
                      Status: {isResolved ? 'Resolved' : flag.status}
                    </span>
                    {!isResolved ? (
                      <button
                        type="button"
                        onClick={() => handleResolveFlag(flag.id)}
                        className="px-4 py-1.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[13px] font-medium rounded-[4px]"
                      >
                        Mark investigation resolved
                      </button>
                    ) : (
                      <span className="text-[13px] text-[#2F8F5B] font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Case resolved & logged</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Debarment Records Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
            Statutory debarment registry
          </h2>
          <span className="text-[13px] text-[#6B7A87]">
            {debarments.length} active debarment orders
          </span>
        </div>

        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
                <tr>
                  <th className="p-4">Entity name</th>
                  <th className="p-4">CIPA number</th>
                  <th className="p-4">Scope</th>
                  <th className="p-4">Period</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Issuing authority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                {debarments.map((deb) => (
                  <tr key={deb.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]">
                    <td className="p-4 font-semibold text-[#C2412D]">{deb.entityName}</td>
                    <td className="p-4 font-sans text-[#43525F] dark:text-[#B2C3D2]">{deb.cipaNumber}</td>
                    <td className="p-4">
                      <span className="bg-[#FEF2F2] text-[#C2412D] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                        {deb.scope}
                      </span>
                    </td>
                    <td className="p-4 tabular-nums text-[#43525F] dark:text-[#B2C3D2]">
                      {deb.startDate} – {deb.endDate}
                    </td>
                    <td className="p-4 text-[#43525F] dark:text-[#B2C3D2] max-w-xs">{deb.reason}</td>
                    <td className="p-4 text-[13px] text-[#6B7A87]">{deb.issuedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
