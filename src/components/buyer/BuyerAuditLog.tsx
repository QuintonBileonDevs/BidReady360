import React, { useState, useEffect, useCallback } from 'react';
import { auditApi } from '../../services/api';
import {
  ShieldCheck,
  Search,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

export const BuyerAuditLog: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');
  const [selectedEntityFilter, setSelectedEntityFilter] = useState('ALL');

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const rows = await auditApi.listLogs(
        selectedEntityFilter !== 'ALL' ? selectedEntityFilter : undefined
      );
      setEvents(
        (Array.isArray(rows) ? rows : []).map((e: any) => ({
          ...e,
          timestamp: e.occurredAt
            ? new Date(e.occurredAt).toLocaleString('en-BW', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : e.timestamp || '—',
        }))
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load procurement audit ledger.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEntityFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const res = await auditApi.verifyChain();
      setVerifyResult(res);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to verify cryptographic audit chain.');
    } finally {
      setIsVerifying(false);
    }
  };

  const filteredEvents = events.filter((ev) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      String(ev.actorName || '').toLowerCase().includes(q) ||
      String(ev.action || '').toLowerCase().includes(q) ||
      String(ev.details || '').toLowerCase().includes(q) ||
      String(ev.entityId || '').toLowerCase().includes(q);

    const matchesRole = selectedRoleFilter === 'ALL' || ev.actorRole === selectedRoleFilter;
    return matchesSearch && matchesRole;
  });

  const handleExportCSV = async () => {
    const headers = 'ID,Timestamp,Actor,Role,Organization,Action,EntityType,EntityID,RowHash,Details,IPAddress\n';
    const rows = filteredEvents
      .map(
        (e) =>
          `"${e.id}","${e.timestamp}","${(e.actorName || '').replace(/"/g, '""')}","${(e.actorRole || '').replace(/"/g, '""')}","${(e.organizationName || '').replace(/"/g, '""')}","${(e.action || '').replace(/"/g, '""')}","${(e.entityType || '').replace(/"/g, '""')}","${e.entityId || ''}","${e.rowHash || ''}","${(e.details || '').replace(/"/g, '""')}","${e.ipAddress || ''}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Procurement-Audit-Trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    await auditApi.recordExport({
      exportType: 'audit_trail_csv',
      recordsCount: filteredEvents.length,
    }).catch(() => {});
  };

  const handleExportJSON = async () => {
    const payload = JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        framework: 'Public Procurement Act Compliant',
        jurisdiction: 'Republic of Botswana',
        totalForensicEvents: filteredEvents.length,
        records: filteredEvents,
      },
      null,
      2
    );
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Statutory-Forensic-Ledger-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    await auditApi.recordExport({
      exportType: 'forensic_ledger_json',
      recordsCount: filteredEvents.length,
    }).catch(() => {});
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="card-elevated p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border-l-4 border-l-[#1F5F99]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
              Immutable Trail
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">· {events.length} Persisted Forensic Actions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white">
            Statutory Procurement Audit Log
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Append-only, SHA-256 hash-chained log of bids submitted, addenda issued, clarifications answered, scoring locks, and award decisions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={loadLogs}
            disabled={isLoading}
            className="px-3.5 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleVerifyChain}
            disabled={isVerifying}
            className="px-3.5 py-2 border border-[#2F8F5B] text-[#2F8F5B] hover:bg-emerald-50 rounded-[6px] text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isVerifying ? 'Verifying...' : 'Verify Ledger Integrity'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#1F5F99]" />
            <span>Export Audit CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            className="px-3.5 py-2 bg-[#1F5F99] hover:bg-[#184B7A] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Export Forensic JSON</span>
          </button>
        </div>
      </div>

      {verifyResult && (
        <div
          className={`p-4 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
            verifyResult.valid
              ? 'bg-emerald-50 border-emerald-200 text-[#065F46]'
              : 'bg-rose-50 border-rose-200 text-[#8E2A1B]'
          }`}
        >
          <div className="flex items-center gap-2">
            {verifyResult.valid ? (
              <CheckCircle2 className="w-4 h-4 text-[#2F8F5B] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#C2412D] shrink-0" />
            )}
            <span>
              <strong>
                {verifyResult.valid
                  ? 'Hash chain intact:'
                  : 'Hash chain anomaly detected:'}
              </strong>{' '}
              Checked {verifyResult.totalChecked} ledger entries ({verifyResult.brokenLinks} broken link{verifyResult.brokenLinks === 1 ? '' : 's'}, {verifyResult.hashMismatches} payload hash mismatch{verifyResult.hashMismatches === 1 ? '' : 'es'}).
              {verifyResult.firstBrokenReason ? ` ${verifyResult.firstBrokenReason}` : ''}
            </span>
          </div>
          {verifyResult.latestHash && (
            <span className="font-mono text-[11px]">
              Tip: {String(verifyResult.latestHash).slice(0, 16)}…
            </span>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-[#C2412D]">
          {errorMsg}
        </div>
      )}

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

        <select
          value={selectedRoleFilter}
          onChange={(e) => setSelectedRoleFilter(e.target.value)}
          className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
        >
          <option value="ALL">All Actor Roles</option>
          <option value="Supplier">Supplier</option>
          <option value="Procurement Officer">Procurement Officer</option>
          <option value="Org admin">Org admin</option>
          <option value="Evaluator">Evaluator</option>
          <option value="Approver">Approver</option>
          <option value="Auditor">Auditor</option>
        </select>

        <select
          value={selectedEntityFilter}
          onChange={(e) => setSelectedEntityFilter(e.target.value)}
          className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
        >
          <option value="ALL">All Entity Types</option>
          <option value="Bid">Bid Envelope</option>
          <option value="Call">Call / Tender</option>
          <option value="Application">Application</option>
          <option value="ConsentGrant">Consent Grant</option>
          <option value="EvaluatorAssignment">Evaluation / Scorecard</option>
          <option value="Award">Award Decision</option>
          <option value="CallAddendum">Addendum</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Querying append-only audit ledger...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4 w-44">Timestamp (CAT)</th>
                  <th className="py-3 px-4 w-48">Actor & Organization</th>
                  <th className="py-3 px-4 w-48">Action & Hash</th>
                  <th className="py-3 px-4">Event Details</th>
                  <th className="py-3 px-4 w-28 font-mono">IP / Node</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No audit events match your current filters.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-slate-500 tabular-nums">
                        {ev.timestamp}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-[#10212E]">{ev.actorName}</div>
                        <span className="text-[11px] text-slate-500 block truncate max-w-[180px]">
                          {ev.actorRole} · {ev.organizationName || 'Organization'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-[#1F5F99] block">{ev.action}</span>
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded inline-block mt-0.5">
                          {ev.entityType}
                          {ev.rowHash ? ` · #${String(ev.rowHash).slice(0, 8)}` : ''}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-700 leading-relaxed">
                        {ev.details}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {ev.ipAddress || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
