import React, { useState, useEffect, useCallback } from 'react';
import { adminApi, AdminManagedUser } from '../../services/api';
import {
  Search,
  Check,
  Unlock,
  UserX,
  UserCheck,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';

function formatDateTime(iso?: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-BW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [filter, setFilter] = useState<'all' | 'locked' | 'admins' | 'suspended'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.listUsers({ filter });
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load platform users.');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const showSuccess = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleUnlock = async (user: AdminManagedUser) => {
    setBusyId(user.id);
    setError(null);
    try {
      await adminApi.unlockUser(user.id);
      await loadUsers();
      showSuccess(`Unlocked account ${user.email} and reset failed login attempts.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to unlock user account.');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleStatus = async (user: AdminManagedUser) => {
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';
    setBusyId(user.id);
    setError(null);
    try {
      await adminApi.updateUserStatus(user.id, nextStatus);
      await loadUsers();
      showSuccess(
        nextStatus === 'suspended'
          ? `Suspended ${user.email} and revoked active sessions.`
          : `Reactivated ${user.email}.`
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to update user status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeSessions = async (user: AdminManagedUser) => {
    setBusyId(user.id);
    setError(null);
    try {
      const res = await adminApi.revokeUserSessions(user.id);
      await loadUsers();
      showSuccess(`Revoked ${res.revokedCount ?? 0} active session(s) for ${user.email}.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to revoke user sessions.');
    } finally {
      setBusyId(null);
    }
  };

  const visibleUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.tenantName.toLowerCase().includes(q) ||
      u.roleLabel.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#244157]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Users &amp; security management
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#D3E3F2]">
            Manage accounts across all tenants, unlock accounts locked by failed logins, suspend access, and revoke active sessions.
          </p>
        </div>

        <button
          type="button"
          onClick={loadUsers}
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

      {/* Filter Tabs + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All users' },
            { id: 'locked', label: 'Locked accounts' },
            { id: 'admins', label: 'Platform admins' },
            { id: 'suspended', label: 'Suspended' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium cursor-pointer ${
                filter === tab.id
                  ? 'bg-[#1F5F99] text-white'
                  : 'bg-white dark:bg-[#1C364B] text-[#43525F] dark:text-[#D3E3F2] border border-[#D5E0EA] dark:border-[#244157]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#6B7A87] absolute left-3 top-1/2 -translate-y-1/2 dark:text-[#9CB4C9]" />
          <input
            type="text"
            placeholder="Search name, email, tenant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#1C364B] text-[#10212E] dark:text-white text-[14px]"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-[#6B7A87] text-[14px] dark:text-[#9CB4C9]">
            <Loader2 className="w-4 h-4 animate-spin text-[#1F5F99] dark:text-[#6FAEE0]" />
            <span>Loading user accounts...</span>
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="p-12 text-center text-[#6B7A87] text-[15px] dark:text-[#9CB4C9]">
            No user accounts match this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#244157]">
              <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px] dark:text-[#9CB4C9]">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Tenant &amp; Role</th>
                  <th className="p-4">Security</th>
                  <th className="p-4">Last sign-in</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#244157] text-[#10212E] dark:text-white">
                {visibleUsers.map((user) => {
                  const isBusy = busyId === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]">
                      <td className="p-4">
                        <div className="font-semibold">{user.fullName}</div>
                        <div className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">{user.email}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-[13px] font-medium text-[#10212E] dark:text-white">
                          {user.tenantName}
                        </div>
                        <span className="inline-block mt-0.5 bg-[#EAF2FA] text-[#1F5F99] text-[11px] px-2 py-0.5 rounded-[4px] font-medium dark:bg-[#162C3D] dark:text-[#6FAEE0]">
                          {user.roleLabel}
                        </span>
                      </td>
                      <td className="p-4 text-[12px] space-y-1">
                        <div>
                          {user.mfaEnabled ? (
                            <span className="bg-[#ECFDF5] text-[#2F8F5B] px-2 py-0.5 rounded-[4px] font-medium inline-flex items-center gap-1 dark:bg-[#2F8F5B]/20">
                              <Check className="w-3 h-3" /> MFA On
                            </span>
                          ) : (
                            <span className="bg-slate-100 dark:bg-slate-800 text-[#6B7A87] px-2 py-0.5 rounded-[4px] font-medium dark:text-[#9CB4C9]">
                              MFA Off
                            </span>
                          )}
                        </div>
                        <div className="text-[#6B7A87] dark:text-[#9CB4C9]">
                          {user.activeSessionsCount} active session{user.activeSessionsCount === 1 ? '' : 's'}
                        </div>
                      </td>
                      <td className="p-4 text-[13px] text-[#6B7A87] tabular-nums dark:text-[#9CB4C9]">
                        {formatDateTime(user.lastLoginAt)}
                      </td>
                      <td className="p-4 space-y-1">
                        <div>
                          <span
                            className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium capitalize ${
                              user.status === 'active'
                                ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                                : user.status === 'suspended'
                                ? 'bg-[#FEF2F2] text-[#C2412D]'
                                : 'bg-[#FFFBEB] text-[#92400E]'
                            }`}
                          >
                            {user.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {user.isLocked && (
                          <div className="text-[11px] font-semibold text-[#C2412D]">
                            Locked ({user.failedLoginAttempts} failed)
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end flex-wrap gap-1.5">
                          {user.isLocked && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleUnlock(user)}
                              className="px-2.5 py-1 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[12px] font-medium rounded-[4px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Unlock</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleStatus(user)}
                            className={`px-2.5 py-1 text-[12px] font-medium rounded-[4px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                              user.status === 'suspended'
                                ? 'bg-[#ECFDF5] text-[#2F8F5B] border border-emerald-200 hover:bg-emerald-100 dark:bg-[#2F8F5B]/20 dark:border-[#2F8F5B]/40'
                                : 'bg-rose-50 text-[#C2412D] border border-rose-200 hover:bg-rose-100 dark:bg-[#C2412D]/20 dark:border-[#C2412D]/40'
                            }`}
                          >
                            {user.status === 'suspended' ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Activate</span>
                              </>
                            ) : (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                <span>Suspend</span>
                              </>
                            )}
                          </button>
                          {user.activeSessionsCount > 0 && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleRevokeSessions(user)}
                              className="px-2.5 py-1 border border-[#D5E0EA] dark:border-[#244157] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] text-[#43525F] dark:text-[#D3E3F2] text-[12px] font-medium rounded-[4px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              <span>Revoke</span>
                            </button>
                          )}
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
    </div>
  );
};
