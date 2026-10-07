import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Search,
  Download,
  Filter,
  Clock,
  User,
  Activity,
} from 'lucide-react';

export const BuyerAuditLog: React.FC = () => {
  const { auditEvents } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');
  const [selectedEntityFilter, setSelectedEntityFilter] = useState('ALL');

  const filteredEvents = auditEvents.filter((ev) => {
    const matchesSearch =
      ev.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.entityId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = selectedRoleFilter === 'ALL' || ev.actorRole === selectedRoleFilter;
    const matchesEntity = selectedEntityFilter === 'ALL' || ev.entityType === selectedEntityFilter;

    return matchesSearch && matchesRole && matchesEntity;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="card-elevated p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border-l-4 border-l-[#1F5F99]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
              Immutable Trail
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">· {auditEvents.length} Recorded Forensic Actions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white">
            Statutory Procurement Audit Log
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Cryptographically timestamped log of bids submitted, documents replaced, clarifications answered, and scoring activities.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const headers = 'ID,Timestamp,Actor,Role,Organization,Action,EntityType,EntityID,Details,IPAddress\n';
              const rows = filteredEvents.map(e => 
                `"${e.id}","${e.timestamp}","${e.actorName}","${e.actorRole}","${e.organizationName}","${e.action}","${e.entityType}","${e.entityId}","${e.details.replace(/"/g, '""')}","${e.ipAddress || ''}"`
              ).join('\n');
              const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Procurement-Audit-Trail-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-3.5 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] dark:hover:bg-[#132635] rounded-[6px] text-[13px] font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Download className="w-4 h-4 text-[#1F5F99]" />
            <span>Export Audit CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                exportDate: new Date().toISOString(),
                framework: 'Public Procurement Act Compliant',
                jurisdiction: 'Republic of Botswana',
                totalForensicEvents: filteredEvents.length,
                records: filteredEvents,
              }, null, 2));
              const a = document.createElement('a');
              a.href = dataStr;
              a.download = `Statutory-Forensic-Ledger-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
            }}
            className="px-3.5 py-2 bg-[#1F5F99] hover:bg-[#184B7A] text-white rounded-[6px] text-[13px] font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Export Forensic JSON</span>
          </button>
        </div>
      </div>

      {/* Filter controls */}
      <div className="bg-[#EAF2FA]/50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search actor, action, or entity ID..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div>
          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
          >
            <option value="ALL">All Actor Roles</option>
            <option value="Supplier">Supplier</option>
            <option value="Procurement Officer">Procurement Officer</option>
            <option value="Evaluator">Evaluator</option>
            <option value="Approver">Approver</option>
            <option value="Auditor">Auditor</option>
          </select>
        </div>

        <div>
          <select
            value={selectedEntityFilter}
            onChange={(e) => setSelectedEntityFilter(e.target.value)}
            className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
          >
            <option value="ALL">All Entity Types</option>
            <option value="Bid">Bid Envelope</option>
            <option value="Call">Call / Tender</option>
            <option value="Application">Application</option>
            <option value="Document">Vault Document</option>
            <option value="Consent">Consent Grant</option>
            <option value="Evaluation">Evaluation Mark</option>
            <option value="Award">Award Decision</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4 w-44">Timestamp (CAT)</th>
                <th className="py-3 px-4 w-48">Actor & Organization</th>
                <th className="py-3 px-4 w-44">Action</th>
                <th className="py-3 px-4">Event Details</th>
                <th className="py-3 px-4 w-28 font-mono">IP / Node</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEvents.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono text-slate-500 tabular-nums">
                    {ev.timestamp}
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-bold text-[#10212E]">{ev.actorName}</div>
                    <span className="text-[11px] text-slate-500 block truncate max-w-[180px]">
                      {ev.actorRole} · {ev.organizationName}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <span className="font-semibold text-[#1F5F99] block">{ev.action}</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {ev.entityType}: {ev.entityId}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-slate-700 leading-relaxed">
                    {ev.details}
                  </td>

                  <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                    {ev.ipAddress || '168.167.4.10'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
