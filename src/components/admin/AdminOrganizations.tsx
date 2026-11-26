import React, { useState, useEffect, useCallback } from 'react';
import { adminApi, AdminOrganizationRecord } from '../../services/api';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Lock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { AdminSupportModal } from './AdminSupportModal';

interface AdminOrganizationsProps {
  onStartSupportSession: (entityName: string, reason: string) => void;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-BW', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getOrgTabBucket(org: AdminOrganizationRecord): 'Pending' | 'Active' | 'Suspended' {
  if (org.status === 'pending' || org.verificationStatus === 'pending_review') return 'Pending';
  if (org.status === 'active') return 'Active';
  return 'Suspended';
}

export const AdminOrganizations: React.FC<AdminOrganizationsProps> = ({
  onStartSupportSession,
}) => {
  const [activeTab, setActiveTab] = useState<'Pending' | 'Active' | 'Suspended'>('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [orgs, setOrgs] = useState<AdminOrganizationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [selectedOrg, setSelectedOrg] = useState<AdminOrganizationRecord | null>(null);

  // Reject / Suspend modal
  const [reasonModal, setReasonModal] = useState<{
    mode: 'reject' | 'suspend';
    org: AdminOrganizationRecord;
  } | null>(null);
  const [reasonText, setReasonText] = useState('');

  // Support session modal
  const [supportTarget, setSupportTarget] = useState<{ id: string; name: string } | null>(null);

  const loadOrganizations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.listOrganizations();
      setOrgs(Array.isArray(data) ? data : []);
      setSelectedOrg((prev) => (prev ? data.find((o) => o.id === prev.id) || null : null));
    } catch (err: any) {
      setError(err?.message || 'Unable to load procuring organizations.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const showSuccess = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleApprove = async (org: AdminOrganizationRecord) => {
    setBusyId(org.id);
    setError(null);
    try {
      await adminApi.approveOrganization(org.id);
      await loadOrganizations();
      showSuccess(`Approved "${org.name}". Organization is now active and can publish tender calls.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to approve organization.');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmReasonAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonModal) return;
    const trimmed = reasonText.trim();
    if (reasonModal.mode === 'reject' && trimmed.length < 5) {
      setError('Please enter a rejection reason of at least 5 characters.');
      return;
    }

    setBusyId(reasonModal.org.id);
    setError(null);
    try {
      if (reasonModal.mode === 'reject') {
        await adminApi.rejectOrganization(reasonModal.org.id, trimmed);
        showSuccess(`Rejected "${reasonModal.org.name}" with recorded reason.`);
      } else {
        await adminApi.suspendOrganization(reasonModal.org.id, trimmed || undefined);
        showSuccess(`Suspended "${reasonModal.org.name}".`);
      }
      setReasonModal(null);
      setReasonText('');
      await loadOrganizations();
    } catch (err: any) {
      setError(err?.message || 'Unable to update organization status.');
    } finally {
      setBusyId(null);
    }
  };

  const filteredOrgs = orgs.filter((o) => {
    const matchesTab = getOrgTabBucket(o) === activeTab;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      o.name.toLowerCase().includes(q) ||
      (o.registrationNumber || '').toLowerCase().includes(q) ||
      (o.contactPerson || '').toLowerCase().includes(q) ||
      (o.leadEmail || o.contactEmail || '').toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const pendingCount = orgs.filter((o) => getOrgTabBucket(o) === 'Pending').length;
  const activeCount = orgs.filter((o) => getOrgTabBucket(o) === 'Active').length;
  const suspendedCount = orgs.filter((o) => getOrgTabBucket(o) === 'Suspended').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#244157]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Procuring organizations
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#D3E3F2]">
            Approve pending buyer registrations, enforce gatekeeping before tender publishing, and manage institutional access.
          </p>
        </div>
        <button
          type="button"
          onClick={loadOrganizations}
          disabled={isLoading}
          className="px-3.5 py-2 border border-[#D5E0EA] dark:border-[#244157] bg-white dark:bg-[#1C364B] hover:bg-[#F7FAFD] text-[#10212E] dark:text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto dark:hover:bg-[#162C3D]"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[#C2412D] dark:text-rose-200 text-[14px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div className="p-3.5 rounded-[8px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[14px] flex items-center gap-2 dark:bg-[#2F8F5B]/20 dark:text-[#6EE7B7] dark:border-[#2F8F5B]/40">
          <CheckCircle2 className="w-4 h-4 text-[#2F8F5B] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Tabs and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 border-b border-[#D5E0EA] dark:border-[#244157] pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('Pending')}
            className={`pb-2 px-3 text-[15px] font-medium transition-colors border-b-2 -mb-[2px] cursor-pointer ${
              activeTab === 'Pending'
                ? 'border-[#1F5F99] text-[#10212E] dark:text-white font-semibold'
                : 'border-transparent text-[#6B7A87] hover:text-[#10212E]'
            }`}
          >
            Pending review ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('Active')}
            className={`pb-2 px-3 text-[15px] font-medium transition-colors border-b-2 -mb-[2px] cursor-pointer ${
              activeTab === 'Active'
                ? 'border-[#1F5F99] text-[#10212E] dark:text-white font-semibold'
                : 'border-transparent text-[#6B7A87] hover:text-[#10212E]'
            }`}
          >
            Active organizations ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('Suspended')}
            className={`pb-2 px-3 text-[15px] font-medium transition-colors border-b-2 -mb-[2px] cursor-pointer ${
              activeTab === 'Suspended'
                ? 'border-[#1F5F99] text-[#10212E] dark:text-white font-semibold'
                : 'border-transparent text-[#6B7A87] hover:text-[#10212E]'
            }`}
          >
            Suspended / Rejected ({suspendedCount})
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#6B7A87] absolute left-3 top-1/2 -translate-y-1/2 dark:text-[#9CB4C9]" />
          <input
            type="text"
            placeholder="Search by name, ref, officer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#1C364B] text-[#10212E] dark:text-white text-[14px]"
          />
        </div>
      </div>

      {/* Organizations Table Card */}
      <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-[#6B7A87] text-[14px] dark:text-[#9CB4C9]">
            <Loader2 className="w-4 h-4 animate-spin text-[#1F5F99] dark:text-[#6FAEE0]" />
            <span>Loading procuring organizations...</span>
          </div>
        ) : filteredOrgs.length === 0 ? (
          <div className="p-12 text-center text-[#6B7A87] text-[15px] dark:text-[#9CB4C9]">
            No organizations found in the {activeTab.toLowerCase()} category.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#244157]">
              <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px] dark:text-[#9CB4C9]">
                <tr>
                  <th className="p-4">Organization name</th>
                  <th className="p-4">Entity type</th>
                  <th className="p-4">Registration / Ref</th>
                  <th className="p-4">Registered</th>
                  <th className="p-4">Plan</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#244157] text-[#10212E] dark:text-white">
                {filteredOrgs.map((org) => {
                  const bucket = getOrgTabBucket(org);
                  const isBusy = busyId === org.id;
                  return (
                    <tr key={org.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors">
                      <td className="p-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => setSelectedOrg(org)}
                          className="hover:text-[#1F5F99] text-left cursor-pointer dark:hover:text-[#6FAEE0]"
                        >
                          {org.name}
                        </button>
                      </td>
                      <td className="p-4 text-[#43525F] dark:text-[#D3E3F2] capitalize">
                        {(org.organizationType || 'organization').replace(/_/g, ' ')}
                      </td>
                      <td className="p-4 font-sans text-[#43525F] dark:text-[#D3E3F2]">
                        {org.registrationNumber || '—'}
                      </td>
                      <td className="p-4 tabular-nums text-[#43525F] dark:text-[#D3E3F2]">
                        {formatDate(org.createdAt)}
                      </td>
                      <td className="p-4">
                        <span className="bg-[#EAF2FA] text-[#1F5F99] text-[12px] px-2 py-0.5 rounded-[4px] font-medium dark:bg-[#162C3D] dark:text-[#6FAEE0]">
                          {org.planName}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium ${
                            bucket === 'Active'
                              ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                              : bucket === 'Pending'
                              ? 'bg-[#FFFBEB] text-[#92400E]'
                              : 'bg-[#FEF2F2] text-[#C2412D]'
                          }`}
                        >
                          {org.verificationStatus === 'rejected' ? 'Rejected' : bucket}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {bucket === 'Pending' && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleApprove(org)}
                                className="px-3 py-1 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[13px] font-medium rounded-[4px] cursor-pointer disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setReasonText('');
                                  setReasonModal({ mode: 'reject', org });
                                }}
                                className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-[#C2412D] border border-rose-200 text-[13px] font-medium rounded-[4px] cursor-pointer disabled:opacity-50 dark:bg-[#C2412D]/20 dark:border-[#C2412D]/40"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedOrg(org)}
                            className="px-3 py-1 border border-[#D5E0EA] dark:border-[#244157] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] text-[#10212E] dark:text-white text-[13px] font-medium rounded-[4px] cursor-pointer"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Organization Detail Drawer */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#10212E]/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-[#1C364B] h-full shadow-lg p-6 overflow-y-auto space-y-6 text-[14px]">
            <div className="flex items-center justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#244157]">
              <div className="space-y-1">
                <span className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">Organization profile</span>
                <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                  {selectedOrg.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrg(null)}
                className="text-[#6B7A87] hover:text-[#10212E] text-[18px] p-1 cursor-pointer dark:text-[#9CB4C9] dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E]">
                <div>
                  <span className="text-[12px] text-[#6B7A87] block dark:text-[#9CB4C9]">Account status</span>
                  <span className="font-semibold text-[#10212E] dark:text-white capitalize">{selectedOrg.status}</span>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7A87] block dark:text-[#9CB4C9]">Verification</span>
                  <span className="font-semibold text-[#10212E] dark:text-white capitalize">
                    {selectedOrg.verificationStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7A87] block dark:text-[#9CB4C9]">Registration / Gazette ref</span>
                  <span className="font-semibold text-[#10212E] dark:text-white">
                    {selectedOrg.registrationNumber || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7A87] block dark:text-[#9CB4C9]">Authorized officers</span>
                  <span className="font-semibold text-[#10212E] dark:text-white">
                    {selectedOrg.membersCount} member{selectedOrg.membersCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {selectedOrg.rejectionReason && (
                <div className="p-3.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[13px] text-[#C2412D] dark:text-rose-200">
                  <strong>Recorded reason:</strong> {selectedOrg.rejectionReason}
                </div>
              )}

              <div className="space-y-2">
                <span className="font-semibold text-[#10212E] dark:text-white block">Lead officer contact</span>
                <div className="p-3 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] space-y-1 text-[13px]">
                  <div><strong>Name:</strong> {selectedOrg.contactPerson || '—'}</div>
                  <div><strong>Email:</strong> {selectedOrg.leadEmail || selectedOrg.contactEmail || '—'}</div>
                  <div><strong>Location:</strong> {[selectedOrg.city, selectedOrg.district].filter(Boolean).join(', ') || '—'}</div>
                  <div><strong>Registered:</strong> {formatDate(selectedOrg.createdAt)}</div>
                  {selectedOrg.approvedAt && (
                    <div><strong>Approved:</strong> {formatDate(selectedOrg.approvedAt)}</div>
                  )}
                </div>
              </div>

              <div className="p-4 border border-[#D5E0EA] dark:border-[#244157] rounded-[8px] space-y-2">
                <span className="font-semibold text-[#10212E] dark:text-white block">Support access</span>
                <p className="text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">
                  Launch a logged diagnostic support session for this organization. A ticket reference and written reason are required.
                </p>
                <button
                  type="button"
                  onClick={() => setSupportTarget({ id: selectedOrg.id, name: selectedOrg.name })}
                  className="w-full py-2 border border-[#1F5F99] text-[#1F5F99] hover:bg-[#EAF2FA] rounded-[6px] font-medium text-[13px] flex items-center justify-center gap-1.5 cursor-pointer dark:text-[#6FAEE0] dark:hover:bg-[#162C3D]"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Start logged support session</span>
                </button>
              </div>

              {/* Action buttons */}
              <div className="space-y-2 pt-4 border-t border-[#D5E0EA] dark:border-[#244157]">
                {getOrgTabBucket(selectedOrg) === 'Pending' && (
                  <>
                    <button
                      type="button"
                      disabled={busyId === selectedOrg.id}
                      onClick={() => handleApprove(selectedOrg)}
                      className="w-full py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px] cursor-pointer disabled:opacity-50"
                    >
                      Approve organization workspace
                    </button>
                    <button
                      type="button"
                      disabled={busyId === selectedOrg.id}
                      onClick={() => {
                        setReasonText('');
                        setReasonModal({ mode: 'reject', org: selectedOrg });
                      }}
                      className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-[#C2412D] border border-rose-200 font-medium rounded-[6px] cursor-pointer disabled:opacity-50 dark:bg-[#C2412D]/20 dark:border-[#C2412D]/40"
                    >
                      Reject registration...
                    </button>
                  </>
                )}
                {getOrgTabBucket(selectedOrg) === 'Active' && (
                  <button
                    type="button"
                    disabled={busyId === selectedOrg.id}
                    onClick={() => {
                      setReasonText('');
                      setReasonModal({ mode: 'suspend', org: selectedOrg });
                    }}
                    className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-[#C2412D] border border-rose-200 font-medium rounded-[6px] cursor-pointer disabled:opacity-50 dark:bg-[#C2412D]/20 dark:border-[#C2412D]/40"
                  >
                    Suspend organization access...
                  </button>
                )}
                {getOrgTabBucket(selectedOrg) === 'Suspended' && (
                  <button
                    type="button"
                    disabled={busyId === selectedOrg.id}
                    onClick={() => handleApprove(selectedOrg)}
                    className="w-full py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px] cursor-pointer disabled:opacity-50"
                  >
                    Approve &amp; reactivate organization
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject / Suspend Reason Modal */}
      {reasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/70 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmReasonAction}
            className="w-full max-w-md bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 space-y-4"
          >
            <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              {reasonModal.mode === 'reject'
                ? `Reject organization: ${reasonModal.org.name}`
                : `Suspend organization: ${reasonModal.org.name}`}
            </h3>
            <p className="text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">
              {reasonModal.mode === 'reject'
                ? 'Provide the official rejection reason. This will be recorded in the audit trail and shown to the buyer organization.'
                : 'Specify the reason for suspending tender operations for this procuring entity.'}
            </p>
            <textarea
              rows={3}
              required={reasonModal.mode === 'reject'}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="e.g. Unverified Gazette registration reference or missing authorization letter."
              className="w-full p-3 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="px-4 py-2 text-[14px] text-[#43525F] dark:text-[#D3E3F2] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === reasonModal.org.id}
                className="px-4 py-2 bg-[#C2412D] hover:bg-[#a63423] text-white rounded-[6px] text-[14px] font-medium cursor-pointer disabled:opacity-50"
              >
                {busyId === reasonModal.org.id
                  ? 'Saving...'
                  : reasonModal.mode === 'reject'
                  ? 'Confirm rejection'
                  : 'Confirm suspension'}
              </button>
            </div>
          </form>
        </div>
      )}

      <AdminSupportModal
        isOpen={Boolean(supportTarget)}
        onClose={() => setSupportTarget(null)}
        targetEntityId={supportTarget?.id}
        targetEntityName={supportTarget?.name || ''}
        targetType="Organization"
        onGrantAccess={(reason) => {
          if (supportTarget) onStartSupportSession(supportTarget.name, reason);
        }}
      />
    </div>
  );
};
