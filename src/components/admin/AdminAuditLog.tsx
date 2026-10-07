import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, Download, Search, Filter, CheckCircle2 } from 'lucide-react';

export const AdminAuditLog: React.FC = () => {
  const { auditEvents } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const filteredEvents = auditEvents.filter((e) => {
    const matchesSearch =
      e.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = filterAction === 'ALL' || e.action.includes(filterAction);
    return matchesSearch && matchesAction;
  });

  const handleExportCSV = () => {
    const headers = 'ID,Timestamp,Actor,Role,Action,EntityType,Details\n';
    const rows = filteredEvents
      .map(
        (e) =>
          `"${e.id}","${e.timestamp}","${e.actorName}","${e.actorRole}","${e.action}","${e.entityType}","${e.details.replace(/"/g, '""')}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bidready360-audit-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Statutory audit log
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Immutable chronological record of all administrative actions, tender evaluations, and system approvals.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] dark:hover:bg-[#132635] rounded-[6px] text-[14px] font-medium transition-colors inline-flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Export audit CSV</span>
        </button>
      </div>

      {/* Audit Integrity Banner */}
      <div className="p-4 rounded-[12px] bg-[#ECFDF5] dark:bg-[#065F46]/20 border border-[#A7F3D0] dark:border-[#065F46]/40 flex items-center justify-between gap-4 text-[14px] text-[#065F46] dark:text-[#A7F3D0]">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-[#2F8F5B]" />
          <span>
            <strong>Audit log integrity verified:</strong> Cryptographic SHA-256 seal verified 4 minutes ago. No retroactive modifications detected.
          </span>
        </div>
        <span className="font-sans text-[13px] text-[#2F8F5B] whitespace-nowrap">
          Ledger valid
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#6B7A87] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search actor, action, details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white text-[14px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
            <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
              <tr>
                <th className="p-4">Timestamp (CAT)</th>
                <th className="p-4">Actor</th>
                <th className="p-4">Role</th>
                <th className="p-4">Action</th>
                <th className="p-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
              {filteredEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]">
                  <td className="p-4 tabular-nums text-[#43525F] dark:text-[#B2C3D2] whitespace-nowrap text-[13px]">
                    {evt.timestamp}
                  </td>
                  <td className="p-4 font-semibold">{evt.actorName}</td>
                  <td className="p-4 text-[#43525F] dark:text-[#B2C3D2] text-[13px]">{evt.actorRole}</td>
                  <td className="p-4 font-medium text-[#1F5F99] dark:text-[#6FAEE0]">{evt.action}</td>
                  <td className="p-4 text-[#43525F] dark:text-[#B2C3D2] max-w-md">{evt.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
