import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Application } from '../../types';
import { StatusChip } from '../common/StatusChip';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  Building2,
  Users,
  ShieldCheck,
  Eye,
  FileText,
  Search,
  Filter,
  ArrowRight,
  Send,
  X,
  Lock,
} from 'lucide-react';

export const BuyerReviewQueue: React.FC = () => {
  const { applications, supplier, allSuppliers, documents, updateApplicationStatus, calls } = useApp();
  const [selectedAppId, setSelectedAppId] = useState<string>(applications[0]?.id || '');
  const [filterCallId, setFilterCallId] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Request More Info modal state
  const [isRequestingInfo, setIsRequestingInfo] = useState(false);
  const [infoRequestReason, setInfoRequestReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const selectedApp = applications.find((a) => a.id === selectedAppId) || applications[0];

  const appSupplier = allSuppliers.find((s) => s.id === selectedApp?.supplierId) || supplier;

  const filteredApps = applications.filter((a) => {
    const matchesCall = filterCallId === 'ALL' || a.callId === filterCallId;
    const matchesStatus = filterStatus === 'ALL' || a.status === filterStatus;
    const matchesSearch =
      a.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.callNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.callTitle.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCall && matchesStatus && matchesSearch;
  });

  const handleApprove = () => {
    if (!selectedApp) return;
    updateApplicationStatus(
      selectedApp.id,
      'Approved',
      'Verified all compliance documents, CIPA registry, and questionnaire responses. Approved by procurement committee.',
      'K. Tau (Lead Procurement Specialist)'
    );
    setActionSuccess(`Application for ${selectedApp.supplierName} Approved.`);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleRequestInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !infoRequestReason.trim()) return;

    updateApplicationStatus(
      selectedApp.id,
      'More information requested',
      infoRequestReason.trim(),
      'K. Tau (Lead Procurement Specialist)'
    );
    setIsRequestingInfo(false);
    setInfoRequestReason('');
    setActionSuccess(`Requested supplementary details from ${selectedApp.supplierName}.`);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !rejectReason.trim()) return;

    updateApplicationStatus(
      selectedApp.id,
      'Rejected',
      rejectReason.trim(),
      'K. Tau (Lead Procurement Specialist)'
    );
    setIsRejecting(false);
    setRejectReason('');
    setActionSuccess(`Application rejected: ${selectedApp.supplierName}.`);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Toast */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-[#2F8F5B] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Header */}
      <div className="card-elevated p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border-l-4 border-l-[#1F5F99]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
              Evaluation Desk
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">· Side-by-Side Verification Checklist</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white">
            Supplier Application Review Queue
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Compare candidate company registration data and verified vault documents beside your procurement checklist.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#EAF2FA]/50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate company or tender..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div>
          <select
            value={filterCallId}
            onChange={(e) => setFilterCallId(e.target.value)}
            className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
          >
            <option value="ALL">All Tenders & Drives</option>
            {calls.map((c) => (
              <option key={c.id} value={c.id}>
                {c.callNumber} — {c.title.substring(0, 30)}...
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
          >
            <option value="ALL">All Application Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Under review">Under review</option>
            <option value="More information requested">More information requested</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Split-View: Applications Table / Selector on Left (4 cols), Detail Checklist on Right (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Submissions Queue List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="font-heading font-semibold text-sm text-[#10212E]">
            Submissions ({filteredApps.length})
          </h3>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto">
            {filteredApps.map((app) => {
              const isSelected = selectedApp?.id === app.id;
              return (
                <div
                  key={app.id}
                  onClick={() => setSelectedAppId(app.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-white border-[#1F5F99] ring-2 ring-[#1F5F99]/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-xs text-[#10212E] leading-snug">
                      {app.supplierName}
                    </span>
                    <StatusChip status={app.status} />
                  </div>

                  <p className="text-[11px] text-slate-500 font-mono mt-1">
                    {app.callNumber} · {app.callType}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
                    <span>Submitted: {app.submittedAt}</span>
                    {app.bid && (
                      <span className="font-mono font-bold text-slate-800">
                        BWP {app.bid.totalAmountBWP.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Split Detail View & Verification Actions (7 cols) */}
        {selectedApp && (
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-2xs">
            {/* Header with Title and Current Status */}
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#1F5F99]">{selectedApp.callNumber}</span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-600 font-medium">{selectedApp.callType}</span>
                </div>
                <h3 className="font-heading font-bold text-lg text-[#10212E] mt-0.5">
                  {selectedApp.supplierName}
                </h3>
                <span className="text-xs text-slate-500">
                  Target Call: {selectedApp.callTitle}
                </span>
              </div>

              <StatusChip status={selectedApp.status} />
            </div>

            {/* Candidate Company Profile Summary */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#2F8F5B]" />
                <span>Verified CIPA & PPRA Profile</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px]">CIPA UIN</span>
                  <span className="font-mono font-bold text-slate-800">{appSupplier.cipaNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">BURS TIN</span>
                  <span className="font-mono font-bold text-slate-800">{appSupplier.tinNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CITIZEN SHAREHOLDING</span>
                  <span className="font-bold text-[#2F8F5B]">{appSupplier.citizenOwnedPercentage}% Citizen</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">PRIMARY SUPPLY CATEGORY</span>
                  <span className="font-medium text-slate-800">{appSupplier.ppraCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">PREMISES PLOT</span>
                  <span className="text-slate-700 truncate block">{appSupplier.physicalAddress}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">EDD STATUS</span>
                  <span className="font-bold text-[#1F5F99]">
                    {appSupplier.eddCertified ? 'EDD Certified' : 'Standard'}
                  </span>
                </div>
              </div>
            </div>

            {/* Submitted Vault Documents Checklist */}
            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Attached Vault Compliance Documents ({documents.length})
              </h4>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-3 bg-white flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-[#1F5F99] shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-900 block">{doc.documentType}</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Doc: {doc.documentNumber} · Exp: {doc.expiryDate}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusChip status={doc.status} />
                      <button
                        onClick={() => alert(`Simulated document view: ${doc.fileName}`)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                        title="View File"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Questionnaire Responses (if any) */}
            {selectedApp.responses.length > 0 && (
              <div className="space-y-3 text-xs">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Custom Questionnaire Responses
                </h4>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  {selectedApp.responses.map((resp, idx) => (
                    <div key={idx} className="pb-2 border-b border-slate-200/60 last:border-0 last:pb-0">
                      <span className="font-semibold text-slate-700 block text-[11px]">{resp.label}</span>
                      <span className="font-medium text-slate-900 block mt-0.5">
                        {typeof resp.value === 'boolean'
                          ? resp.value ? 'Yes' : 'No'
                          : String(resp.value || 'N/A')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Procurement Officer Actions Bar */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-700 block">Evaluation Decision & Status Action:</span>

              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={handleApprove}
                  className="px-4 py-2 bg-[#2F8F5B] hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Admit to Roster</span>
                </button>

                <button
                  onClick={() => setIsRequestingInfo(true)}
                  className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4 text-[#E8A33D]" />
                  <span>Request More Information</span>
                </button>

                <button
                  onClick={() => setIsRejecting(true)}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-[#C2412D] border border-rose-200 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject</span>
                </button>
              </div>
            </div>

            {/* Request Info Dialog */}
            {isRequestingInfo && (
              <form onSubmit={handleRequestInfoSubmit} className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900">Specify Missing or Clarification Requirements:</span>
                  <button type="button" onClick={() => setIsRequestingInfo(false)} className="text-amber-800">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <textarea
                  rows={3}
                  required
                  value={infoRequestReason}
                  onChange={(e) => setInfoRequestReason(e.target.value)}
                  placeholder="e.g. Please provide updated bank rating certificate from a commercial bank in Botswana..."
                  className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-slate-900"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRequestingInfo(false)}
                    className="px-3 py-1.5 text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#1F5F99] text-white font-semibold rounded-lg hover:bg-[#184a77]"
                  >
                    Send Inquiry to Supplier
                  </button>
                </div>
              </form>
            )}

            {/* Reject Dialog */}
            {isRejecting && (
              <form onSubmit={handleRejectSubmit} className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-900">Enter Statutory Reason for Rejection:</span>
                  <button type="button" onClick={() => setIsRejecting(false)} className="text-rose-800">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <textarea
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Non-compliance with mandatory technical qualification criteria..."
                  className="w-full p-2.5 bg-white border border-rose-300 rounded-lg text-slate-900"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRejecting(false)}
                    className="px-3 py-1.5 text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#C2412D] text-white font-semibold rounded-lg hover:bg-rose-800"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
