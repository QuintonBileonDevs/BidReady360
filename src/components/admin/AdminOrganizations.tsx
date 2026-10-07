import React, { useState } from 'react';
import { PendingOrg } from '../../types/admin';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Users,
  Eye,
  MoreVertical,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { AdminSupportModal } from './AdminSupportModal';

interface AdminOrganizationsProps {
  onStartSupportSession: (entityName: string, reason: string) => void;
}

export const AdminOrganizations: React.FC<AdminOrganizationsProps> = ({
  onStartSupportSession,
}) => {
  const [activeTab, setActiveTab] = useState<'Pending' | 'Active' | 'Suspended'>('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [orgs, setOrgs] = useState<PendingOrg[]>(() => {
    try {
      const saved = localStorage.getItem('bidready_admin_orgs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedOrg, setSelectedOrg] = useState<PendingOrg | null>(null);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportTargetOrg, setSupportTargetOrg] = useState<string>('');

  const filteredOrgs = orgs.filter((o) => {
    const matchesTab = o.status === activeTab;
    const matchesSearch =
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.gazetteRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.contactPerson.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleApprove = (orgId: string) => {
    setOrgs((prev) =>
      prev.map((o) => (o.id === orgId ? { ...o, status: 'Active' as const } : o))
    );
    if (selectedOrg?.id === orgId) {
      setSelectedOrg((prev) => (prev ? { ...prev, status: 'Active' } : null));
    }
  };

  const handleSuspend = (orgId: string) => {
    setOrgs((prev) =>
      prev.map((o) => (o.id === orgId ? { ...o, status: 'Suspended' as const } : o))
    );
    if (selectedOrg?.id === orgId) {
      setSelectedOrg((prev) => (prev ? { ...prev, status: 'Suspended' } : null));
    }
  };

  const handleOpenSupport = (orgName: string) => {
    setSupportTargetOrg(orgName);
    setIsSupportModalOpen(true);
  };

  const pendingCount = orgs.filter((o) => o.status === 'Pending').length;
  const activeCount = orgs.filter((o) => o.status === 'Active').length;
  const suspendedCount = orgs.filter((o) => o.status === 'Suspended').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Procuring organizations
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Review workspace registrations, manage subscription tiers, and audit institutional access.
          </p>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-[#D5E0EA] dark:border-[#1E364A] pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('Pending')}
            className={`pb-2 px-3 text-[15px] font-medium transition-colors border-b-2 -mb-[2px] ${
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
            className={`pb-2 px-3 text-[15px] font-medium transition-colors border-b-2 -mb-[2px] ${
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
            className={`pb-2 px-3 text-[15px] font-medium transition-colors border-b-2 -mb-[2px] ${
              activeTab === 'Suspended'
                ? 'border-[#1F5F99] text-[#10212E] dark:text-white font-semibold'
                : 'border-transparent text-[#6B7A87] hover:text-[#10212E]'
            }`}
          >
            Suspended ({suspendedCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#6B7A87] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, ref, officer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white text-[14px]"
          />
        </div>
      </div>

      {/* Organizations Table Card */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] overflow-hidden">
        {filteredOrgs.length === 0 ? (
          <div className="p-12 text-center text-[#6B7A87] text-[15px]">
            No organizations found in the {activeTab.toLowerCase()} category.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
                <tr>
                  <th className="p-4">Organization name</th>
                  <th className="p-4">Entity type</th>
                  <th className="p-4">Gazette / Ref</th>
                  <th className="p-4">Submitted date</th>
                  <th className="p-4">Plan</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                {filteredOrgs.map((org) => (
                  <tr key={org.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors">
                    <td className="p-4 font-semibold">
                      <button
                        type="button"
                        onClick={() => setSelectedOrg(org)}
                        className="hover:text-[#1F5F99] text-left cursor-pointer"
                      >
                        {org.name}
                      </button>
                    </td>
                    <td className="p-4 text-[#43525F] dark:text-[#B2C3D2]">{org.type}</td>
                    <td className="p-4 font-sans text-[#43525F] dark:text-[#B2C3D2]">{org.gazetteRef}</td>
                    <td className="p-4 tabular-nums text-[#43525F] dark:text-[#B2C3D2]">{org.submittedDate}</td>
                    <td className="p-4">
                      <span className="bg-[#EAF2FA] text-[#1F5F99] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                        {org.plan}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium ${
                          org.status === 'Active'
                            ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                            : org.status === 'Pending'
                            ? 'bg-[#FFFBEB] text-[#92400E]'
                            : 'bg-[#FEF2F2] text-[#C2412D]'
                        }`}
                      >
                        {org.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {org.status === 'Pending' && (
                          <button
                            type="button"
                            onClick={() => handleApprove(org.id)}
                            className="px-3 py-1 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[13px] font-medium rounded-[4px]"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedOrg(org)}
                          className="px-3 py-1 border border-[#D5E0EA] hover:bg-[#F7FAFD] text-[#10212E] dark:text-white text-[13px] font-medium rounded-[4px]"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Organization Detail Drawer */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#10212E]/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-[#132635] h-full shadow-lg p-6 overflow-y-auto space-y-6 text-[14px]">
            <div className="flex items-center justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div className="space-y-1">
                <span className="text-[12px] text-[#6B7A87]">Organization profile</span>
                <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                  {selectedOrg.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrg(null)}
                className="text-[#6B7A87] hover:text-[#10212E] text-[18px] p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E]">
                <div>
                  <span className="text-[12px] text-[#6B7A87] block">Status</span>
                  <span className="font-semibold text-[#10212E] dark:text-white">{selectedOrg.status}</span>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7A87] block">Tier</span>
                  <span className="font-semibold text-[#10212E] dark:text-white">{selectedOrg.plan} Plan</span>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7A87] block">Gazette Ref</span>
                  <span className="font-semibold text-[#10212E] dark:text-white">{selectedOrg.gazetteRef}</span>
                </div>
                <div>
                  <span className="text-[12px] text-[#6B7A87] block">Authorized Officers</span>
                  <span className="font-semibold text-[#10212E] dark:text-white">{selectedOrg.membersCount} members</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-[#10212E] dark:text-white block">Lead officer contact</span>
                <div className="p-3 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] space-y-1 text-[13px]">
                  <div><strong>Name:</strong> {selectedOrg.contactPerson}</div>
                  <div><strong>Email:</strong> {selectedOrg.email}</div>
                  <div><strong>Submitted:</strong> {selectedOrg.submittedDate}</div>
                </div>
              </div>

              {/* Privacy-Gated "View as organization" support action */}
              <div className="p-4 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] space-y-2">
                <span className="font-semibold text-[#10212E] dark:text-white block">Support access</span>
                <p className="text-[13px] text-[#6B7A87]">
                  Launch a diagnostic support session to assist this organization. A written statutory reason is required.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenSupport(selectedOrg.name)}
                  className="w-full py-2 border border-[#1F5F99] text-[#1F5F99] hover:bg-[#EAF2FA] rounded-[6px] font-medium text-[13px] flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>View as organization (Requires audit reason)</span>
                </button>
              </div>

              {/* Action buttons */}
              <div className="space-y-2 pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A]">
                {selectedOrg.status === 'Pending' && (
                  <button
                    type="button"
                    onClick={() => handleApprove(selectedOrg.id)}
                    className="w-full py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px]"
                  >
                    Approve organization workspace
                  </button>
                )}
                {selectedOrg.status === 'Active' && (
                  <button
                    type="button"
                    onClick={() => handleSuspend(selectedOrg.id)}
                    className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-[#C2412D] border border-rose-200 font-medium rounded-[6px]"
                  >
                    Suspend organization access
                  </button>
                )}
                {selectedOrg.status === 'Suspended' && (
                  <button
                    type="button"
                    onClick={() => handleApprove(selectedOrg.id)}
                    className="w-full py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px]"
                  >
                    Reactivate organization
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AdminSupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        targetEntityName={supportTargetOrg}
        targetType="Organization"
        onGrantAccess={(reason) => onStartSupportSession(supportTargetOrg, reason)}
      />
    </div>
  );
};
