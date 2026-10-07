import React, { useState } from 'react';
import { AdminUserRecord } from '../../types/admin';
import { UserPlus, ShieldCheck, Check, Mail, Lock } from 'lucide-react';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUserRecord[]>(() => {
    try {
      const saved = localStorage.getItem('bidready_admin_users');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<AdminUserRecord['role']>('Operations analyst');

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newFullName) return;

    const newUser: AdminUserRecord = {
      id: `adm-${Date.now()}`,
      fullName: newFullName,
      email: newEmail,
      role: newRole,
      mfaEnabled: false,
      lastSignIn: 'Invitation pending',
      status: 'Invited',
    };

    setUsers((prev) => [...prev, newUser]);
    setIsInviteModalOpen(false);
    setNewEmail('');
    setNewFullName('');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Admin users & permissions
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Manage platform operator accounts, security credentials, and mandatory hardware/authenticator 2FA enforcement.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsInviteModalOpen(true)}
          className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[14px] font-medium rounded-[6px] transition-colors inline-flex items-center gap-2 cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite operator</span>
        </button>
      </div>

      {/* Admin Users Table */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
            <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
              <tr>
                <th className="p-4">Full name</th>
                <th className="p-4">Official email</th>
                <th className="p-4">Role</th>
                <th className="p-4">MFA status</th>
                <th className="p-4">Last sign-in</th>
                <th className="p-4">Account status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]">
                  <td className="p-4 font-semibold">{user.fullName}</td>
                  <td className="p-4 font-sans text-[#43525F] dark:text-[#B2C3D2]">{user.email}</td>
                  <td className="p-4">
                    <span className="bg-[#EAF2FA] text-[#1F5F99] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4">
                    {user.mfaEnabled ? (
                      <span className="bg-[#ECFDF5] text-[#2F8F5B] text-[12px] px-2 py-0.5 rounded-[4px] font-medium inline-flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Hardware / Authenticator</span>
                      </span>
                    ) : (
                      <span className="bg-[#FFFBEB] text-[#92400E] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                        Pending setup
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-[13px] text-[#6B7A87]">{user.lastSignIn}</td>
                  <td className="p-4">
                    <span
                      className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium ${
                        user.status === 'Active'
                          ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                          : 'bg-[#EAF2FA] text-[#1F5F99]'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
            <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              Invite platform operator
            </h3>
            <form onSubmit={handleInviteSubmit} className="space-y-4 text-[14px]">
              <div className="space-y-1">
                <label className="font-medium text-[#10212E] dark:text-white block">Full name *</label>
                <input
                  type="text"
                  placeholder="e.g. Neo Morapedi"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-[#10212E] dark:text-white block">Official email address *</label>
                <input
                  type="email"
                  placeholder="operator@bidready360.gov.bw"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-[#10212E] dark:text-white block">Assigned administrative role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px]"
                >
                  <option value="Operations analyst">Operations analyst</option>
                  <option value="Compliance officer">Compliance officer</option>
                  <option value="Support specialist">Support specialist</option>
                  <option value="Super admin">Super admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A]">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 text-[14px] text-[#43525F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1F5F99] text-white rounded-[6px] text-[14px] font-medium"
                >
                  Send invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
