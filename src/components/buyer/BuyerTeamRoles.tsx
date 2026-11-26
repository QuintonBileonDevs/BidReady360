import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { buyerApi } from '../../services/api';
import {
  Users,
  UserPlus,
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Clock,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check,
  Loader2,
  Lock,
  Mail,
  Send,
  X,
} from 'lucide-react';

interface TeamMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  roleId: string | null;
  roleName: string;
  roleCode: string;
  department: string;
  jobTitle: string;
  approvalLimitBWP: number | null;
  status: string;
  mfaEnabled: boolean;
  conflictDeclared: boolean;
  joinedAt: string | null;
  lastActiveAt: string | null;
}

interface PendingInvitation {
  id: string;
  email: string;
  roleId: string | null;
  role: string;
  roleCode: string;
  department: string;
  jobTitle: string;
  approvalLimitBWP: number | null;
  invitedBy: string;
  sentAt: string;
  expiresAt: string;
  status: string;
}

interface OrgRole {
  id: string;
  code: string;
  name: string;
  description: string;
  approvalLimitBWP: number | null;
  isSystem: boolean;
  permissions: string[];
}

export const BuyerTeamRoles: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'roles'>('members');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [roles, setRoles] = useState<OrgRole[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Generated invite link banner (one-time token returned by server)
  const [generatedInvite, setGeneratedInvite] = useState<{
    email: string;
    token: string;
    url: string;
    expiresAt: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modals
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<TeamMember | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviteDepartment, setInviteDepartment] = useState('Procurement Unit');
  const [inviteJobTitle, setInviteJobTitle] = useState('Procurement Officer');
  const [inviteLimitBWP, setInviteLimitBWP] = useState('');

  // Edit member form state
  const [editRoleId, setEditRoleId] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editLimitBWP, setEditLimitBWP] = useState('');
  const [editConflictDeclared, setEditConflictDeclared] = useState(false);

  const showToast = (msg: string) => {
    setErrorMsg(null);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const loadTeam = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await buyerApi.getTeam();
      setMembers(Array.isArray(data?.members) ? data.members : []);
      setInvitations(Array.isArray(data?.pendingInvitations) ? data.pendingInvitations : []);
      const fetchedRoles: OrgRole[] = Array.isArray(data?.roles) ? data.roles : [];
      setRoles(fetchedRoles);
      if (!inviteRoleId && fetchedRoles.length > 0) {
        setInviteRoleId(fetchedRoles[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load organization team and roles.');
    } finally {
      setIsLoading(false);
    }
  }, [inviteRoleId]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const buildInviteUrl = (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/accept-invite?inviteToken=${encodeURIComponent(token)}`;
  };

  const handleCopyLink = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const selectedRole = roles.find((r) => r.id === inviteRoleId);
      const parsedLimit = inviteLimitBWP.trim() !== '' ? Number(inviteLimitBWP) : null;
      const res = await buyerApi.inviteMember({
        email: inviteEmail.trim(),
        roleId: selectedRole?.id,
        roleName: selectedRole?.name || 'Procurement Officer',
        department: inviteDepartment.trim() || 'Procurement',
        jobTitle: inviteJobTitle.trim() || selectedRole?.name || 'Procurement Officer',
        approvalLimitBWP: Number.isFinite(parsedLimit) ? parsedLimit : null,
      });

      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteLimitBWP('');
      if (res?.inviteToken) {
        setGeneratedInvite({
          email: res.email,
          token: res.inviteToken,
          url: buildInviteUrl(res.inviteToken),
          expiresAt: res.expiresAt,
        });
      }
      await loadTeam();
      setActiveTab('invitations');
      showToast(`Invitation created for ${res.email}. Share the one-time acceptance link below.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to send invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (m: TeamMember) => {
    setEditingMember(m);
    const matchedRole = roles.find((r) => r.id === m.roleId || r.name === m.roleName);
    setEditRoleId(matchedRole?.id || roles[0]?.id || '');
    setEditDepartment(m.department || '');
    setEditJobTitle(m.jobTitle || '');
    setEditLimitBWP(m.approvalLimitBWP != null ? String(m.approvalLimitBWP) : '');
    setEditConflictDeclared(Boolean(m.conflictDeclared));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const selectedRole = roles.find((r) => r.id === editRoleId);
      const parsedLimit = editLimitBWP.trim() !== '' ? Number(editLimitBWP) : null;
      await buyerApi.updateMember(editingMember.id, {
        roleId: selectedRole?.id,
        roleName: selectedRole?.name,
        department: editDepartment.trim(),
        jobTitle: editJobTitle.trim(),
        approvalLimitBWP: Number.isFinite(parsedLimit) ? parsedLimit : null,
        conflictDeclared: editConflictDeclared,
      });
      setEditingMember(null);
      await loadTeam();
      showToast(`Updated permissions for ${editingMember.fullName}.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to update team member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (m: TeamMember) => {
    const nextStatus: 'active' | 'suspended' = m.status === 'active' ? 'suspended' : 'active';
    setErrorMsg(null);
    try {
      await buyerApi.updateMemberStatus(m.id, nextStatus);
      await loadTeam();
      showToast(`${m.fullName} is now ${nextStatus === 'active' ? 'Active' : 'Suspended'}.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update member status.');
    }
  };

  const handleRemoveMember = async () => {
    if (!confirmRemoveMember || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await buyerApi.removeMember(confirmRemoveMember.id);
      const name = confirmRemoveMember.fullName;
      setConfirmRemoveMember(null);
      await loadTeam();
      showToast(`Removed ${name} from the organization workspace.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to remove team member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendInvite = async (inv: PendingInvitation) => {
    setErrorMsg(null);
    try {
      const res = await buyerApi.resendTeamInvitation(inv.id);
      if (res?.inviteToken) {
        setGeneratedInvite({
          email: res.email,
          token: res.inviteToken,
          url: buildInviteUrl(res.inviteToken),
          expiresAt: res.expiresAt,
        });
      }
      await loadTeam();
      showToast(`Generated a fresh invitation link for ${inv.email}.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to resend invitation.');
    }
  };

  const handleRevokeInvite = async (inv: PendingInvitation) => {
    setErrorMsg(null);
    try {
      await buyerApi.revokeTeamInvitation(inv.id);
      await loadTeam();
      showToast(`Revoked invitation for ${inv.email}.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to revoke invitation.');
    }
  };

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      const matchesSearch =
        !q ||
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q) ||
        m.jobTitle.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'ALL' || m.roleName === roleFilter;
      const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [members, searchQuery, roleFilter, statusFilter]);

  const activeCount = members.filter((m) => m.status === 'active').length;
  const mfaCount = members.filter((m) => m.mfaEnabled).length;
  const uniqueRoleNames = Array.from(new Set(members.map((m) => m.roleName))).sort();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {toastMessage && (
        <div className="p-4 bg-emerald-50 text-[#2F8F5B] border border-emerald-300 rounded-xl text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 text-[#C2412D] border border-rose-300 rounded-xl text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* One-time Invite Link Banner */}
      {generatedInvite && (
        <div className="p-5 bg-[#EAF2FA] border border-[#1F5F99]/30 rounded-2xl space-y-2.5 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <strong className="text-[#10212E] text-sm block">
                One-time invitation link for {generatedInvite.email}
              </strong>
              <p className="text-slate-600">
                Only the SHA-256 hash of this token is stored in the database. Copy and share this link now (expires{' '}
                {new Date(generatedInvite.expiresAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
                ).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGeneratedInvite(null)}
              className="text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2.5 bg-white border border-slate-300 rounded-lg font-mono text-[11px] text-[#10212E] break-all">
              {generatedInvite.url}
            </code>
            <button
              type="button"
              onClick={() => handleCopyLink(generatedInvite.url)}
              className="px-3.5 py-2.5 bg-[#1F5F99] hover:bg-[#184a77] text-white rounded-lg font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="card-elevated p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border-l-4 border-l-[#1F5F99]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#1F5F99] bg-[#EAF2FA] px-2.5 py-0.5 rounded-md">
              Governance & RBAC
            </span>
            <span className="text-xs text-slate-500">· Approval Limits & Separation of Duties</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900">
            Team Members, Roles & Invitations
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
            Manage procurement officers, evaluation panel members, and award approvers. Authority limits and role assignments persist directly to PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTeam}
            disabled={isLoading}
            className="px-3.5 py-2.5 border border-slate-200 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!inviteRoleId && roles.length > 0) setInviteRoleId(roles[0].id);
              setIsInviteModalOpen(true);
            }}
            className="btn-primary py-2.5 px-4 text-xs shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Team Member</span>
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <span className="text-slate-500 block">Total Workspace Members</span>
          <strong className="text-2xl font-heading font-bold text-[#10212E] mt-1 block">{members.length}</strong>
          <span className="text-[11px] text-[#2F8F5B]">{activeCount} active seats</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <span className="text-slate-500 block">Pending Invitations</span>
          <strong className="text-2xl font-heading font-bold text-[#1F5F99] mt-1 block">{invitations.length}</strong>
          <span className="text-[11px] text-slate-500">Token-secured email invites</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <span className="text-slate-500 block">Configured Roles</span>
          <strong className="text-2xl font-heading font-bold text-[#10212E] mt-1 block">{roles.length}</strong>
          <span className="text-[11px] text-slate-500">Enforced across buyer APIs</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <span className="text-slate-500 block">MFA Protected</span>
          <strong className="text-2xl font-heading font-bold text-[#2F8F5B] mt-1 block">
            {mfaCount} / {members.length}
          </strong>
          <span className="text-[11px] text-slate-500">Active members with MFA</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 rounded-lg font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'members' ? 'bg-[#1F5F99] text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Members ({members.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('invitations')}
          className={`px-4 py-2 rounded-lg font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'invitations' ? 'bg-[#1F5F99] text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Pending Invitations ({invitations.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 rounded-lg font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'roles' ? 'bg-[#1F5F99] text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Role Permissions ({roles.length})</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-10 bg-white border border-slate-200 rounded-2xl flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading workspace team directory...</span>
        </div>
      ) : activeTab === 'members' ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-[#EAF2FA]/50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, department..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
            >
              <option value="ALL">All Roles</option>
              {uniqueRoleNames.map((rn) => (
                <option key={rn} value={rn}>
                  {rn}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Role & Department</th>
                    <th className="py-3 px-4">Award Authority (BWP)</th>
                    <th className="py-3 px-4">Status & Security</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No team members match your current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#10212E]">{m.fullName}</div>
                          <div className="text-[11px] text-slate-500">{m.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-[#EAF2FA] text-[#1F5F99] font-semibold">
                            {m.roleName}
                          </span>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {m.jobTitle} · {m.department}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          {m.approvalLimitBWP != null ? (
                            <span className="font-bold text-[#10212E]">
                              P {Number(m.approvalLimitBWP).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400">No award limit</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              m.status === 'active'
                                ? 'bg-emerald-50 text-[#2F8F5B]'
                                : 'bg-rose-50 text-[#C2412D]'
                            }`}
                          >
                            {m.status}
                          </span>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2">
                            <span>{m.mfaEnabled ? 'MFA On' : 'MFA Off'}</span>
                            {m.conflictDeclared && (
                              <span className="text-amber-700 font-semibold">· COI Declared</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(m)}
                              className="p-1.5 rounded border border-slate-200 text-slate-600 hover:text-[#1F5F99] hover:border-[#1F5F99] cursor-pointer"
                              title="Edit role & approval limit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(m)}
                              className="px-2.5 py-1 rounded border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              {m.status === 'active' ? 'Suspend' : 'Reactivate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveMember(m)}
                              className="p-1.5 rounded border border-slate-200 text-slate-500 hover:text-[#C2412D] hover:border-rose-300 cursor-pointer"
                              title="Remove member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'invitations' ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Invited Email</th>
                  <th className="py-3 px-4">Role & Unit</th>
                  <th className="py-3 px-4">Approval Limit</th>
                  <th className="py-3 px-4">Expires</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invitations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No pending invitations. Click "Invite Team Member" to add procurement staff.
                    </td>
                  </tr>
                ) : (
                  invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#10212E]">{inv.email}</div>
                        <div className="text-[11px] text-slate-500">Invited by {inv.invitedBy}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-[#EAF2FA] text-[#1F5F99] font-semibold">
                          {inv.role}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {inv.jobTitle} · {inv.department}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {inv.approvalLimitBWP != null
                          ? `P ${Number(inv.approvalLimitBWP).toLocaleString()}`
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {inv.expiresAt
                              ? new Date(inv.expiresAt).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '7 days'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleResendInvite(inv)}
                            className="px-2.5 py-1 rounded border border-[#1F5F99] text-[#1F5F99] hover:bg-[#EAF2FA] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Regenerate Link</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevokeInvite(inv)}
                            className="px-2.5 py-1 rounded border border-rose-200 text-[#C2412D] hover:bg-rose-50 font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Revoke</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {roles.map((r) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading font-bold text-sm text-[#10212E]">{r.name}</h3>
                  <p className="text-slate-500 mt-0.5">{r.description || 'Organization role'}</p>
                </div>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {r.code}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <Lock className="w-3.5 h-3.5 text-[#1F5F99]" />
                <span>
                  Default Award Limit:{' '}
                  <strong className="font-mono text-[#10212E]">
                    {r.approvalLimitBWP != null
                      ? `P ${Number(r.approvalLimitBWP).toLocaleString()}`
                      : 'None / Inherited'}
                  </strong>
                </span>
              </div>
              {r.permissions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {r.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="px-2 py-0.5 rounded bg-[#F7FAFD] border border-slate-200 font-mono text-[10px] text-slate-700"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-heading font-bold text-base text-[#10212E]">Invite Organization Member</h3>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleInviteSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="officer@organization.gov.bw"
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Role *</label>
                <select
                  value={inviteRoleId}
                  onChange={(e) => setInviteRoleId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={inviteDepartment}
                    onChange={(e) => setInviteDepartment(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    value={inviteJobTitle}
                    onChange={(e) => setInviteJobTitle(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Award Approval Limit (BWP, optional)
                </label>
                <input
                  type="number"
                  min={0}
                  step="1000"
                  value={inviteLimitBWP}
                  onChange={(e) => setInviteLimitBWP(e.target.value)}
                  placeholder="e.g. 500000"
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184a77] text-white rounded-lg font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Creating...' : 'Create Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-heading font-bold text-base text-[#10212E]">Edit Member Permissions</h3>
                <p className="text-slate-500">{editingMember.fullName}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={editRoleId}
                  onChange={(e) => setEditRoleId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    value={editJobTitle}
                    onChange={(e) => setEditJobTitle(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Award Approval Limit (BWP)</label>
                <input
                  type="number"
                  min={0}
                  step="1000"
                  value={editLimitBWP}
                  onChange={(e) => setEditLimitBWP(e.target.value)}
                  placeholder="Leave blank for role default"
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editConflictDeclared}
                  onChange={(e) => setEditConflictDeclared(e.target.checked)}
                  className="rounded border-slate-300 text-[#1F5F99]"
                />
                <span className="font-semibold text-slate-700">Annual Conflict of Interest (COI) Declared</span>
              </label>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-3.5 py-2 border border-slate-200 rounded-lg text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184a77] text-white rounded-lg font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Remove Modal */}
      {confirmRemoveMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <h3 className="font-heading font-bold text-base text-[#10212E]">Remove team member?</h3>
            <p className="text-slate-600 leading-relaxed">
              Removing <strong>{confirmRemoveMember.fullName}</strong> ({confirmRemoveMember.email}) will revoke their access to this buyer workspace immediately.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemoveMember(null)}
                className="px-3.5 py-2 border border-slate-200 rounded-lg text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleRemoveMember}
                className="px-4 py-2 bg-[#C2412D] hover:bg-[#9e3322] text-white rounded-lg font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Removing...' : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
