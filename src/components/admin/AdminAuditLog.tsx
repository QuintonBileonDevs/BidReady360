import React, { useState, useEffect, useCallback } from 'react';
import { adminApi, AdminAuditEventRecord } from '../../services/api';
import {
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

export const AdminAuditLog: React.FC = () => {
  const [events, setEvents] = useState<AdminAuditEventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);

  // Server-backed filter inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.listAuditLogs({
        search: searchQuery.trim() || undefined,
        actor: actorFilter.trim() || undefined,
        action: actionFilter.trim() || undefined,
        entityType: entityTypeFilter || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        limit: 200,
      });
      setEvents(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load cross-tenant audit log.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, actorFilter, actionFilter, entityTypeFilter, fromDate, toDate]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadLogs();
    }, 200);
    return () => clearTimeout(t);
  }, [loadLogs]);

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    setError(null);
    try {
      const res = await adminApi.verifyAuditChain();
      setVerifyResult(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to verify cryptographic audit chain.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleExportCSV = () => {
    const headers = 'ID,Timestamp,Actor,Role,Action,EntityType,EntityID,RowHash,Details\n';
    const rows = events
      .map(
        (e) =>
          `"${e.id}","${e.timestamp}","${(e.actorName || '').replace(/"/g, '""')}","${(e.actorRole || '').replace(/"/g, '""')}","${(e.action || '').replace(/"/g, '""')}","${(e.entityType || '').replace(/"/g, '""')}","${e.entityId || ''}","${e.rowHash || ''}","${(e.details || '').replace(/"/g, '""')}"`
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
            Cross-tenant append-only cryptographic record of administrative approvals, bids, awards, consent grants, and tender operations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadLogs}
            disabled={isLoading}
            className="px-3.5 py-2 border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] hover:bg-[#F7FAFD] rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
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
            disabled={events.length === 0}
            className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] dark:hover:bg-[#132635] rounded-[6px] text-[14px] font-medium transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Audit Integrity Banner */}
      <div className="p-4 rounded-[12px] bg-[#ECFDF5] dark:bg-[#065F46]/20 border border-[#A7F3D0] dark:border-[#065F46]/40 flex flex-wrap items-center justify-between gap-4 text-[14px] text-[#065F46] dark:text-[#A7F3D0]">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-[#2F8F5B]" />
          <span>
            <strong>Persisted PostgreSQL audit trail:</strong> Showing {events.length} recorded event{events.length === 1 ? '' : 's'} matching your filters.
          </span>
        </div>
      </div>

      {verifyResult && (
        <div
          className={`p-4 rounded-[12px] border text-[13px] flex flex-wrap items-center justify-between gap-3 ${
            verifyResult.valid
              ? 'bg-[#ECFDF5] dark:bg-[#065F46]/20 border-[#A7F3D0] text-[#065F46] dark:text-[#A7F3D0]'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 text-[#8E2A1B] dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {verifyResult.valid ? (
              <CheckCircle2 className="w-4 h-4 text-[#2F8F5B] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#C2412D] shrink-0" />
            )}
            <span>
              <strong>{verifyResult.valid ? 'Global Hash Chain Intact:' : 'Chain Integrity Anomaly:'}</strong>{' '}
              Checked {verifyResult.totalChecked} rows ({verifyResult.brokenLinks} broken link{verifyResult.brokenLinks === 1 ? '' : 's'}, {verifyResult.hashMismatches} hash mismatch{verifyResult.hashMismatches === 1 ? '' : 'es'}).
              {verifyResult.firstBrokenReason ? ` ${verifyResult.firstBrokenReason}` : ''}
            </span>
          </div>
          {verifyResult.latestHash && (
            <span className="font-mono text-[11px]">Tip: {String(verifyResult.latestHash).slice(0, 16)}…</span>
          )}
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[#C2412D] dark:text-rose-200 text-[14px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-[13px]">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-[#6B7A87] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search details, action, actor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
          />
        </div>
        <input
          type="text"
          placeholder="Actor name/email"
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          className="px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
        />
        <select
          value={entityTypeFilter}
          onChange={(e) => setEntityTypeFilter(e.target.value)}
          className="px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
        >
          <option value="">All entities</option>
          <option value="organization">Organization</option>
          <option value="supplier">Supplier</option>
          <option value="supplier_person">Director</option>
          <option value="supplier_document_version">Document</option>
          <option value="Call">Call / Tender</option>
          <option value="Application">Application</option>
          <option value="Bid">Bid Envelope</option>
          <option value="Award">Award Decision</option>
          <option value="ConsentGrant">Consent Grant</option>
          <option value="CallAddendum">Call Addendum</option>
          <option value="EvaluatorAssignment">Evaluation Lock</option>
          <option value="user">User</option>
          <option value="debarment">Debarment</option>
          <option value="risk_flag">Risk flag</option>
          <option value="category">Category</option>
          <option value="document_type">Document type</option>
          <option value="plan">Plan</option>
          <option value="platform_config">Platform config</option>
        </select>
        <input
          type="date"
          aria-label="From date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
        />
        <input
          type="date"
          aria-label="To date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
        />
        <div className="sm:col-span-2 lg:col-span-6 flex items-center justify-between gap-3 pt-1">
          <input
            type="text"
            placeholder="Filter by action code (e.g. ADMIN_APPROVED, ADMIN_UNLOCKED, DEBARMENT)..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="flex-1 px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
          />
          {(searchQuery || actorFilter || actionFilter || entityTypeFilter || fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActorFilter('');
                setActionFilter('');
                setEntityTypeFilter('');
                setFromDate('');
                setToDate('');
              }}
              className="text-[12px] text-[#1F5F99] font-medium hover:underline cursor-pointer shrink-0"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-[#6B7A87] text-[14px]">
            <Loader2 className="w-4 h-4 animate-spin text-[#1F5F99]" />
            <span>Querying audit ledger...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-[#6B7A87] text-[15px]">
            No audit events match your current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
                <tr>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Actor</th>
                  <th className="p-4">Entity & Hash</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]">
                    <td className="p-4 tabular-nums text-[#43525F] dark:text-[#B2C3D2] whitespace-nowrap text-[13px]">
                      {evt.timestamp}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-[13px]">{evt.actorName}</div>
                      <div className="text-[11px] text-[#6B7A87]">{evt.actorRole}</div>
                    </td>
                    <td className="p-4 text-[12px] text-[#43525F] dark:text-[#B2C3D2]">
                      <div className="capitalize">{(evt.entityType || 'system').replace(/_/g, ' ')}</div>
                      {evt.rowHash && (
                        <div className="font-mono text-[10px] text-[#6B7A87]">#{String(evt.rowHash).slice(0, 8)}</div>
                      )}
                    </td>
                    <td className="p-4 font-medium text-[#1F5F99] dark:text-[#6FAEE0] text-[13px]">
                      {evt.action}
                    </td>
                    <td className="p-4 text-[#43525F] dark:text-[#B2C3D2] max-w-md text-[13px]">
                      {evt.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
